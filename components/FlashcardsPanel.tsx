
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight, RotateCcw, Save, X, Loader2, FileUp } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Flashcard } from '../types';
import { renderLatex } from '../utils';
import ConfirmModal from './ConfirmModal';

interface FlashcardsPanelProps {
  nodeId: string;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
}

const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({ nodeId, isAdmin, themeColor, gradeId }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const themeTextClasses = {
    'indigo-600': 'text-indigo-600',
    'emerald-600': 'text-emerald-600',
    'rose-600': 'text-rose-600',
  };

  const themeBgClasses = {
    'indigo-600': 'bg-indigo-600',
    'emerald-600': 'bg-emerald-600',
    'rose-600': 'bg-rose-600',
  };

  const themeHoverBgClasses = {
    'indigo-600': 'hover:bg-indigo-700',
    'emerald-600': 'hover:bg-emerald-700',
    'rose-600': 'hover:bg-rose-700',
  };

  const themeBorderClasses = {
    'indigo-600': 'focus:border-indigo-400',
    'emerald-600': 'focus:border-emerald-400',
    'rose-600': 'focus:border-rose-400',
  };

  const themeShadowClasses = {
    'indigo-600': 'shadow-indigo-200',
    'emerald-600': 'shadow-emerald-200',
    'rose-600': 'shadow-rose-200',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeBgClass = themeBgClasses[themeColor as keyof typeof themeBgClasses] || themeBgClasses['indigo-600'];
  const currentThemeHoverBgClass = themeHoverBgClasses[themeColor as keyof typeof themeHoverBgClasses] || themeHoverBgClasses['indigo-600'];
  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];
  const currentThemeShadowClass = themeShadowClasses[themeColor as keyof typeof themeShadowClasses] || themeShadowClasses['indigo-600'];
  
  // Admin state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ front: '', back: '' });

  const fetchFlashcards = useCallback(async () => {
    setLoading(true);
    console.log(`Đang tải flashcards cho bài học: ${nodeId}`);
    try {
      const mapRecord = (f: any) => ({
        id: f.id,
        nodeId: f.nodeId || f.node_id,
        front: f.front,
        back: f.back,
        createdAt: f.createdAt || f.created_at
      });

      // Ưu tiên truy vấn trực tiếp bằng node_id
      let query = supabase
        .from('flashcards')
        .select('*')
        .eq('node_id', nodeId);
      
      let { data, error } = await query;
      
      // Nếu không có node_id (phòng trường hợp dự án cũ dùng nodeId)
      if (error || !data || data.length === 0) {
        let q2 = supabase
          .from('flashcards')
          .select('*')
          .eq('nodeId', nodeId);
        const { data: camelData } = await q2;
        if (camelData && camelData.length > 0) data = camelData;
      }

      if (data) {
        // Lọc theo gradeId trong bộ nhớ nếu bản ghi có grade_id
        // Điều này giúp tránh lỗi nếu cột grade_id chưa tồn tại trong Supabase
        const filtered = data.filter((item: any) => {
          const id = item.node_id || item.nodeId || '';
          const itemGradeId = item.grade_id || item.gradeId;
          
          // 1. So khớp nghiêm ngặt nếu bản ghi có grade_id
          if (gradeId && itemGradeId) {
            return String(itemGradeId) === String(gradeId);
          }
          
          // 2. Kiểm tra tiền tố ID bài học (g10-, g11-, g12-)
          if (id.startsWith('g10-')) return gradeId === 10;
          if (id.startsWith('g11-')) return gradeId === 11;
          if (id.startsWith('g12-')) return gradeId === 12;

          // 3. Với dữ liệu cũ chưa có nhãn:
          // Cho phép hiện để giáo viên có thể dùng nút ĐỒNG BỘ KHỐI
          return true;
        });

        const mapped = filtered.map(mapRecord).sort((a, b) => 
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
        );
        console.log(`Kết quả: Tìm thấy ${mapped.length} thẻ.`);
        setFlashcards(mapped);
      } else {
        setFlashcards([]);
      }
      
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error('Lỗi khi tải flashcards:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    fetchFlashcards();
  }, [fetchFlashcards]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.front || !formData.back) return;

    try {
      const now = new Date().toISOString();
      if (editingId) {
        const { error } = await supabase
          .from('flashcards')
          .update({ front: formData.front, back: formData.back, createdAt: now, created_at: now })
          .eq('id', editingId);
        if (error) {
           // Retry with minimal set
           await supabase.from('flashcards').update({ front: formData.front, back: formData.back }).eq('id', editingId);
        }
      } else {
        // Try bulk-injecting both column names in case one is missing from schema
        const payload = { 
          nodeId, 
          node_id: nodeId, 
          front: formData.front, 
          back: formData.back, 
          createdAt: now, 
          created_at: now,
          grade_id: gradeId
        };
        const { error } = await supabase.from('flashcards').insert([payload]);
        
        if (error) {
           console.warn('First robust insert failed, trying camelCase:', error);
           const { error: e2 } = await supabase.from('flashcards').insert([{ 
             nodeId, 
             front: formData.front, 
             back: formData.back, 
             createdAt: now, 
             grade_id: String(gradeId) 
           }]);
           if (e2) {
             console.warn('camelCase insert failed, trying snake_case:', e2);
             const { error: e3 } = await supabase.from('flashcards').insert([{ 
               node_id: nodeId, 
               front: formData.front, 
               back: formData.back, 
               created_at: now, 
               grade_id: String(gradeId) 
             }]);
             if (e3) {
                console.warn('Snake_case with grade_id failed, trying absolute minimal:', e3);
                const { error: e4 } = await supabase.from('flashcards').insert([{ node_id: nodeId, front: formData.front, back: formData.back }]);
                if (e4) throw e4;
             }
           }
        }
      }
      
      setFormData({ front: '', back: '' });
      setIsAdding(false);
      setEditingId(null);
      fetchFlashcards();
    } catch (err: any) {
      console.error('Error saving flashcard:', err);
      alert('Lỗi: ' + (err.message || 'Không thể lưu flashcard.'));
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('File CSV không hợp lệ hoặc trống. Cần ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
        return;
      }

      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const parsedData: { front: string; back: string }[] = [];
      
      const parseCSVLine = (line: string, sep: string) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === sep && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
          } else current += char;
        }
        result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
      };

      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i], separator);
        if (parts.length >= 2 && parts[0] && parts[1]) {
          parsedData.push({
            front: parts[0],
            back: parts[1]
          });
        }
      }

      if (parsedData.length === 0) {
        alert('Không tìm thấy dữ liệu hợp lệ trong file (Yêu cầu ít nhất 2 cột: Câu hỏi và Trả lời).');
        return;
      }

      setConfirmConfig({
        isOpen: true,
        title: "Tải lên Flashcards",
        message: `Tìm thấy ${parsedData.length} thẻ flashcard. Bạn có muốn nhập vào bài học này không?`,
        onConfirm: async () => {
          setLoading(true);
          try {
            const now = new Date().toISOString();
            
            // Final check on columns mapping by trying to insert with both possible column names
            const robustPayload = parsedData.map(d => ({
              nodeId,
              node_id: nodeId,
              front: d.front,
              back: d.back,
              createdAt: now,
              created_at: now,
              grade_id: gradeId
            }));
            
            const { error: error1 } = await supabase.from('flashcards').insert(robustPayload);
            
            if (error1) {
              console.warn('CSV robust insert failed, trying camelCase:', error1);
              const camelPayload = parsedData.map(d => ({ nodeId, front: d.front, back: d.back, createdAt: now, grade_id: gradeId }));
              const { error: error2 } = await supabase.from('flashcards').insert(camelPayload);
              
              if (error2) {
                 console.warn('CSV camelCase insert failed, trying snake_case:', error2);
                 const snakePayload = parsedData.map(d => ({ node_id: nodeId, front: d.front, back: d.back, created_at: now, grade_id: gradeId }));
                 const { error: error3 } = await supabase.from('flashcards').insert(snakePayload);
                 if (error3) {
                    console.warn('CSV snake_case with grade_id failed, trying absolute minimal');
                    const minimalPayload = parsedData.map(d => ({ node_id: nodeId, front: d.front, back: d.back }));
                    const { error: error4 } = await supabase.from('flashcards').insert(minimalPayload);
                    if (error4) throw error4;
                 }
              }
            }

            alert(`Đã nhập thành công ${parsedData.length} thẻ.`);
            // Small delay to ensure DB sync before refresh
            setTimeout(() => fetchFlashcards(), 500);
          } catch (err: any) {
            console.error('Error importing CSV:', err);
            alert('Lỗi nhập CSV: ' + (err.message || 'Vui lòng kiểm tra lại cấu trúc bảng flashcards trên Supabase.'));
          } finally {
            setLoading(false);
          }
        }
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa thẻ ghi nhớ",
      message: "Bạn có chắc chắn muốn xóa vĩnh viễn thẻ Flashcard này?",
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('flashcards').delete().eq('id', id);
          if (error) throw error;
          fetchFlashcards();
        } catch (err) {
          console.error('Error deleting flashcard:', err);
        }
      }
    });
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId || flashcards.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Đồng bộ cấp lớp",
      message: `Bạn có muốn cập nhật Khối ${gradeId} cho tất cả ${flashcards.length} thẻ trong bài học này không?`,
      onConfirm: async () => {
        setLoading(true);
        let successCount = 0;
        try {
          const stringGrade = String(gradeId);
          let totalUpdated = 0;
          let actualDbValue: string | null = null;
          let usedColumn = "";
          
          const tryUpdate = async (colNode: string, colGrade: string) => {
            const { data, error } = await supabase
              .from('flashcards')
              .update({ [colGrade]: stringGrade })
              .eq(colNode, nodeId)
              .select('*'); // Lấy lại dữ liệu thực tế từ DB sau khi lưu
            
            if (!error && data && data.length > 0) {
              totalUpdated += data.length;
              // Kiểm tra bản ghi đầu tiên xem cột đó có giá trị chưa
              actualDbValue = data[0][colGrade];
              usedColumn = colGrade;
              return true;
            }
            return false;
          };

          // Thử lần lượt các tổ hợp
          await tryUpdate('node_id', 'grade_id');
          await tryUpdate('node_id', 'gradeId');
          await tryUpdate('nodeId', 'grade_id');
          await tryUpdate('nodeId', 'gradeId');

          if (totalUpdated > 0) {
            alert(`KẾT QUẢ ĐỒNG BỘ:\n- Số thẻ đã xử lý: ${totalUpdated}\n- Cột đã nhận dữ liệu: ${usedColumn}\n- Giá trị thực tế trong CSDL: "${actualDbValue}"\n\n(Nếu giá trị là "null" hoặc trống, có thể cột này đang bị khóa bởi chính sách RLS trên Supabase)`);
            fetchFlashcards();
          } else {
            alert("KHÔNG THÀNH CÔNG:\nKhông tìm thấy thẻ nào khớp với bài học này để cập nhật hoặc cấu trúc bảng không khớp.");
          }
        } catch (err: any) {
          console.error("Batch update error:", err);
          alert("Lỗi khi cập nhật: " + (err.message || "Không xác định"));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const nextCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className={`animate-spin ${currentThemeTextClass}`} size={40} />
        <p className="text-slate-400 font-medium animate-pulse">Đang tải bộ thẻ ghi nhớ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <RotateCcw className={currentThemeTextClass} size={20} />
            FLASHCARDS
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {flashcards.length} thẻ ghi nhớ trong bài học này
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCSVUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              title="Nhập từ file CSV (Cột 1: Câu hỏi, Cột 2: Trả lời)"
            >
              <FileUp size={16} /> Nhập CSV
            </button>
            <button 
              onClick={handleBatchUpdateGrade}
              className={`flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-100 transition-all ${flashcards.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Gắn nhãn khối hiện tại cho dữ liệu cũ (Sửa lỗi hiển thị)"
            >
              <Save size={16} /> Đồng bộ Khối
            </button>
            <button 
              onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ front: '', back: '' }); }}
              className={`flex items-center gap-2 px-4 py-2 ${currentThemeBgClass} text-white rounded-xl font-bold text-xs uppercase tracking-widest ${currentThemeHoverBgClass} transition-all shadow-lg ${currentThemeShadowClass}`}
            >
              <Plus size={16} /> Thêm thẻ mới
            </button>
          </div>
        )}
      </div>

      {isAdding || editingId ? (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-4 animate-in zoom-in-95">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mặt trước (Câu hỏi/Thuật ngữ)</label>
              <textarea 
                value={formData.front}
                onChange={(e) => setFormData({ ...formData, front: e.target.value })}
                className={`w-full p-4 bg-slate-50 border-2 border-transparent ${currentThemeBorderClass} rounded-2xl outline-none transition-all min-h-[120px] font-medium`}
                placeholder="Nhập câu hỏi hoặc thuật ngữ..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mặt sau (Câu trả lời/Định nghĩa)</label>
              <textarea 
                value={formData.back}
                onChange={(e) => setFormData({ ...formData, back: e.target.value })}
                className={`w-full p-4 bg-slate-50 border-2 border-transparent ${currentThemeBorderClass} rounded-2xl outline-none transition-all min-h-[120px] font-medium`}
                placeholder="Nhập câu trả lời hoặc định nghĩa..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit"
              className={`flex items-center gap-2 px-8 py-2 ${currentThemeBgClass} text-white rounded-xl font-bold text-xs uppercase tracking-widest ${currentThemeHoverBgClass} transition-all shadow-lg ${currentThemeShadowClass}`}
            >
              <Save size={16} /> {editingId ? 'Cập nhật' : 'Lưu thẻ'}
            </button>
          </div>
        </form>
      ) : null}

      {flashcards.length > 0 ? (
        <div className="flex flex-col items-center space-y-4">
          {/* Card Display */}
          <div 
            className="relative w-full max-w-2xl h-[280px] cursor-pointer perspective-1000 group"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div 
                className="absolute inset-0 bg-amber-50 rounded-[32px] shadow-2xl border border-amber-200/60 flex flex-col items-center justify-center p-8 backface-hidden overflow-hidden"
                style={{ transform: 'translateZ(1px)', WebkitTransform: 'translateZ(1px)' }}
              >
                {/* Real card texture/lines effect */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-200/40"></div>
                
                <div className="absolute top-6 left-8 text-[10px] font-black text-amber-600/40 uppercase tracking-[0.3em]">Câu hỏi</div>
                <div className="text-2xl font-black text-slate-800 text-center leading-tight tracking-tight z-10">
                  {renderLatex(flashcards[currentIndex].front)}
                </div>
                <div className="absolute bottom-6 text-[10px] font-bold text-amber-600/40 uppercase tracking-widest group-hover:text-amber-600 transition-colors">Chạm để xem đáp án</div>
              </div>
              
              {/* Back */}
              <div 
                className={`absolute inset-0 ${currentThemeBgClass} rounded-[32px] shadow-2xl border border-white/10 flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180 overflow-hidden`}
                style={{ transform: 'rotateY(180deg) translateZ(1px)', WebkitTransform: 'rotateY(180deg) translateZ(1px)' }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-white/10"></div>
                <div className="absolute top-6 left-8 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Đáp án</div>
                <div className="text-xl font-bold text-white text-center leading-relaxed z-10">
                  {renderLatex(flashcards[currentIndex].back)}
                </div>
                <div className="absolute bottom-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Chạm để quay lại</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); prevCard(); }}
              className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:${currentThemeTextClass} hover:shadow-xl transition-all border border-slate-100`}
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-slate-800 tracking-tighter">
                {currentIndex + 1} <span className="text-slate-300">/</span> {flashcards.length}
              </span>
              <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div 
                  className={`h-full ${currentThemeBgClass} transition-all duration-300`} 
                  style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                />
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); nextCard(); }}
              className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:${currentThemeTextClass} hover:shadow-xl transition-all border border-slate-100`}
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Admin Actions for current card */}
          {isAdmin && !isAdding && !editingId && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const card = flashcards[currentIndex];
                  setEditingId(card.id);
                  setFormData({ front: card.front, back: card.back });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                <Edit2 size={12} /> Sửa thẻ này
              </button>
              <button 
                onClick={() => handleDelete(flashcards[currentIndex].id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-red-100 transition-all"
              >
                <Trash2 size={12} /> Xóa thẻ này
              </button>
            </div>
          )}
        </div>
      ) : (
        !isAdding && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
              <RotateCcw size={40} className="text-slate-200" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-400 uppercase tracking-tight">Chưa có Flashcard nào</h4>
              <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
                {isAdmin ? 'Hãy bắt đầu bằng cách thêm thẻ ghi nhớ đầu tiên cho bài học này.' : 'Giáo viên chưa cập nhật bộ thẻ ghi nhớ cho bài học này.'}
              </p>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsAdding(true)}
                className={`mt-4 flex items-center gap-2 px-8 py-3 ${currentThemeBgClass} text-white rounded-2xl font-bold text-xs uppercase tracking-widest ${currentThemeHoverBgClass} transition-all shadow-lg ${currentThemeShadowClass}`}
              >
                <Plus size={18} /> Tạo thẻ đầu tiên
              </button>
            )}
          </div>
        )
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <style>{`
        .perspective-1000 { 
          perspective: 1000px; 
          -webkit-perspective: 1000px; 
        }
        .preserve-3d { 
          transform-style: preserve-3d; 
          -webkit-transform-style: preserve-3d; 
        }
        .backface-hidden { 
          backface-visibility: hidden; 
          -webkit-backface-visibility: hidden; 
        }
        .rotate-y-180 { 
          transform: rotateY(180deg); 
          -webkit-transform: rotateY(180deg); 
        }
      `}</style>
    </div>
  );
};

export default FlashcardsPanel;
