
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Image as ImageIcon, Wifi, WifiOff, RefreshCw, ChevronDown, Eye, AlertCircle, Home, BookOpen, Clock, CheckCircle2, Bold, Italic, List, Table as TableIcon, Link, Type, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading3, Calculator, X, Search, Edit2, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { supabase } from '../supabaseClient';
import { ForumComment, Student } from '../types';
import ConfirmModal from './ConfirmModal';

// Import Katex CSS
const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

interface HomeworkPanelProps {
  nodeId: string;
  student: Student | null;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
}

const MATH_FORMULAS = [
  { label: 'PHÂN SỐ', display: 'a/b', value: '$\\frac{a}{b}$' },
  { label: 'CĂN BẬC 2', display: '√x', value: '$\\sqrt{x}$' },
  { label: 'CĂN BẬC N', display: 'ⁿ√x', value: '$\\sqrt[n]{x}$' },
  { label: 'MŨ', display: 'xⁿ', value: '$x^{n}$' },
  { label: 'SỐ HẠ', display: 'xi', value: '$x_{i}$' },
  { label: 'TỔNG (Σ)', display: 'Σ', value: '$\\sum_{i=1}^{n}$' },
  { label: 'TÍCH PHÂN (∫)', display: '∫', value: '$\\int_{a}^{b}$' },
  { label: 'GIỚI HẠN (LIM)', display: 'lim', value: '$\\lim_{x \\to \\infty}$' },
  { label: 'VECTOR', display: '→v', value: '$\\vec{v}$' },
  { label: 'GÓC', display: '∠A', value: '$\\widehat{A}$' },
  { label: 'TAM GIÁC', display: 'Δ', value: '$\\Delta ABC$' },
  { label: 'HỆ PHƯƠNG TRÌNH', display: '{', value: '$\\begin{cases} x =  \\\\ y =  \\end{cases}$' },
];

const FONT_SIZES = [
  { label: 'XS (12PX)', value: '12px' },
  { label: 'SM (14PX)', value: '14px' },
  { label: 'REG (16PX)', value: '16px' },
  { label: 'LG (20PX)', value: '20px' },
  { label: 'XL (24PX)', value: '24px' },
  { label: '2XL (32PX)', value: '32px' },
  { label: '3XL (48PX)', value: '48px' },
];

const FONTS = [
  { label: 'Sans (Inter)', value: 'Inter, sans-serif' },
  { label: 'Serif (Times)', value: 'serif' },
  { label: 'Mono (Space)', value: 'monospace' },
  { label: 'Display (Outfit)', value: 'Outfit, sans-serif' },
];

const COLORS = [
  { label: 'ĐEN', value: '#000000', bg: 'bg-black' },
  { label: 'XÁM', value: '#64748b', bg: 'bg-slate-500' },
  { label: 'ĐỎ', value: '#ef4444', bg: 'bg-red-500' },
  { label: 'CAM', value: '#f97316', bg: 'bg-orange-500' },
  { label: 'VÀNG', value: '#eab308', bg: 'bg-yellow-500' },
  { label: 'XANH LÁ', value: '#22c55e', bg: 'bg-green-500' },
  { label: 'XANH DƯƠNG', value: '#3b82f6', bg: 'bg-blue-500' },
  { label: 'TÍM', value: '#a855f7', bg: 'bg-purple-500' },
  { label: 'HỒNG', value: '#ec4899', bg: 'bg-pink-500' },
];

const HomeworkPanel: React.FC<HomeworkPanelProps> = ({ nodeId, student, isAdmin, themeColor, gradeId }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [content, setContent] = useState('');
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const homeworkNodeId = `homework_${nodeId}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Inject Katex CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = KATEX_CSS;
      document.head.appendChild(link);
    }
  }, []);

  const wrapText = (tag: string, endTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + tag + (endTag || ""));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + tag + selectedText + (endTag || "") + after;
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length + selectedText.length);
    }, 0);
  };

  const applyStyle = (property: string, value: string) => {
    wrapText(`<span style="${property}: ${value}">`, "</span>");
    setActiveDropdown(null);
  };

  const fetchComments = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    
    try {
      // Lấy tất cả dữ liệu có node_id tương ứng
      const { data, error } = await supabase
        .from('forum_comments')
        .select('*');
      
      if (error) {
        console.error("Supabase Select Error:", error);
        return;
      }
      
      if (data) {
        const mappedData = data
          .filter((item: any) => {
            const id = item.nodeId || item.node_id || '';
            const itemGradeId = item.gradeId || item.grade_id;
            
            // So khớp node_id gốc hoặc câu trả lời
            const isTargetNode = id === homeworkNodeId || id.startsWith(`${homeworkNodeId}_ans_`);
            if (!isTargetNode) return false;

            // KIỂM TRA KHỐI LỚP:
            // 1. Nếu có grade_id rõ ràng, phải khớp
            if (gradeId && itemGradeId) {
              return itemGradeId == gradeId;
            }

            // 2. Nếu node_id bắt đầu bằng tiền tố khối (ví dụ: g10-...)
            const cleanId = id.replace('homework_', '');
            if (cleanId.startsWith('g10-')) return gradeId == 10;
            if (cleanId.startsWith('g11-')) return gradeId == 11;
            if (cleanId.startsWith('g12-')) return gradeId == 12;

            // 3. Nếu là dữ liệu cũ chưa phân loại, cho hiện ở mọi khối để quản trị viên có thể thấy và lưu lại
            return true;
          })
          .map((item: any) => ({
            id: item.id,
            nodeId: item.nodeId || item.node_id,
            author: item.author,
            content: item.content,
            imageUrl: item.imageUrl || item.image_url,
            createdAt: item.createdAt || item.created_at,
            // Robust isAdmin detection
            isAdmin: item.isAdmin === true || 
                    item.isAdmin === 'true' || 
                    item.is_admin === true || 
                    item.is_admin === 'true' || 
                    item.author === 'Giáo viên',
          }))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        setComments(mappedData);
      }
    } catch (err: any) {
      console.error("Fetch Exception:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComments();
    
    const channel = supabase.channel(`homework:${nodeId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'forum_comments' 
      }, () => {
        fetchComments(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nodeId, homeworkNodeId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('resources').upload(`homework/${fileName}`, file);
    if (error) return null;
    return supabase.storage.from('resources').getPublicUrl(`homework/${fileName}`).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!content.trim() && !selectedFile) return;
    setLoading(true);

    let imageUrl = undefined;
    if (selectedFile) {
      setUploading(true);
      imageUrl = (await uploadImage(selectedFile)) || undefined;
      setUploading(false);
    }

    const createdAt = new Date().toISOString();
    const authorName = isAdmin ? "Giáo viên" : (student ? `[${student.name}] ${student.full_name || ''}` : "Học sinh");
    const targetNodeId = (isAdmin || !replyingToId) ? homeworkNodeId : `${homeworkNodeId}_ans_${replyingToId}`;

    const commentData = { 
      nodeId: targetNodeId, 
      node_id: targetNodeId,
      author: authorName, 
      content, 
      imageUrl, 
      image_url: imageUrl,
      isAdmin, 
      is_admin: isAdmin,
      createdAt,
      created_at: createdAt,
      grade_id: gradeId,
      gradeId: gradeId
    };
    
    try {
      let result;
      if (editingId) {
        // UPDATE existing comment
        result = await supabase
          .from('forum_comments')
          .update(commentData)
          .eq('id', editingId);
        
        if (result.error) {
          // Fallback update for schema variations
          const fallbackData = { content, imageUrl, image_url: imageUrl };
          result = await supabase.from('forum_comments').update(fallbackData).eq('id', editingId);
        }
      } else {
        // INSERT new comment
        result = await supabase.from('forum_comments').insert([commentData]);
        
        if (result.error) {
          console.error("Insert error, retrying with fallback:", result.error);
          const fallback1 = { nodeId: targetNodeId, author: authorName, content, imageUrl, isAdmin, createdAt, grade_id: gradeId };
          result = await supabase.from('forum_comments').insert([fallback1]);
          if (result.error) {
            const fallback2 = { node_id: targetNodeId, author: authorName, content, image_url: imageUrl, is_admin: isAdmin, created_at: createdAt, grade_id: gradeId };
            result = await supabase.from('forum_comments').insert([fallback2]);
            if (result.error) {
              const fallback3 = { node_id: targetNodeId, author: authorName, content, image_url: imageUrl, is_admin: isAdmin };
              result = await supabase.from('forum_comments').insert([fallback3]);
            }
          }
        }
      }

      if (result.error) throw result.error;
      
      setContent(''); 
      setSelectedFile(null); 
      setPreviewUrl(null);
      setReplyingToId(null);
      setEditingId(null);
      // Immediately refresh list for better UX
      fetchComments(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      alert("Lỗi khi gửi nội dung: " + (err.message || "Kiểm tra kết nối"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setConfirmConfig({
      isOpen: true,
      title: "Xóa bài tập nộp",
      message: "Bạn có chắc chắn muốn xóa bài làm này khỏi phần bài nộp?",
      onConfirm: async () => {
        await supabase.from('forum_comments').delete().eq('id', id);
        setComments(prev => prev.filter(c => c.id !== id));
      }
    });
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId || comments.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Cập nhật khối lớp hàng loạt",
      message: `Gắn nhãn Khối ${gradeId} cho toàn bộ bài viết và câu trả lời trong bài học này?`,
      onConfirm: async () => {
        setLoading(true);
        let successCount = 0;
        try {
          const gStr = String(gradeId);
          
          const tryUpdate = async (colNode: string, colGrade: string) => {
            const { data, error } = await supabase
              .from('forum_comments')
              .update({ [colGrade]: gStr })
              .or(`${colNode}.eq.${homeworkNodeId},${colNode}.ilike.${homeworkNodeId}_ans_%`)
              .select('id');
            
            if (!error && data) {
              successCount += data.length;
              return true;
            }
            return false;
          };

          await tryUpdate('node_id', 'grade_id');
          await tryUpdate('node_id', 'gradeId');
          await tryUpdate('nodeId', 'grade_id');
          await tryUpdate('nodeId', 'gradeId');

          if (successCount > 0) {
            alert(`Đã đồng bộ nhãn Khối ${gradeId} cho ${successCount} mục thảo luận.`);
            fetchComments();
          } else {
            alert("Không tìm thấy dữ liệu cũ để đồng bộ hoặc bảng chưa có cột grade_id.");
          }
        } catch (err: any) {
          alert("Lỗi: " + err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const renderToolbar = () => (
    <div className="flex flex-wrap gap-1 items-center px-2 py-2 bg-slate-50/50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button onClick={() => wrapText("**", "**")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Bold"><Bold size={18} /></button>
        <button onClick={() => wrapText("_", "_")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Italic"><Italic size={18} /></button>
        <button onClick={() => wrapText("### ")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Heading"><Heading3 size={18}/></button>
      </div>

      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button onClick={() => wrapText("- ")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Unordered List"><List size={18} /></button>
        <button onClick={() => wrapText("\n| Header | Header |\n| :--- | :--- |\n| Cell | Cell |\n")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Table"><TableIcon size={18} /></button>
        <button onClick={() => wrapText("[", "](url)")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Link"><Link size={18} /></button>
        
        <div className="relative">
          <button onClick={() => setShowMathDialog(!showMathDialog)} className={`p-2 rounded-lg transition-all flex items-center gap-1 ${showMathDialog ? 'bg-orange-50 text-orange-600' : 'text-slate-500 hover:text-orange-600 hover:bg-white'}`} title="Math Formula">
            <Calculator size={18}/> <ChevronDown size={12}/>
          </button>
          {showMathDialog && (
            <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-slate-100 rounded-[32px] shadow-2xl z-50 p-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CÔNG THỨC LATEX</span>
                 <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">PRO</span>
              </div>
              <div className="grid grid-cols-3 gap-6">
                 {MATH_FORMULAS.map(m => (
                   <button 
                     key={m.label} 
                     onClick={() => { wrapText(m.value); setShowMathDialog(false); }} 
                     className="flex flex-col items-center gap-2 group transition-all"
                   >
                      <div className="text-lg font-black text-orange-600 group-hover:scale-125 transition-transform">{m.display}</div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight text-center">{m.label}</span>
                   </button>
                 ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button onClick={() => wrapText('<div align="left">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Align Left"><AlignLeft size={18}/></button>
        <button onClick={() => wrapText('<div align="center">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Align Center"><AlignCenter size={18}/></button>
        <button onClick={() => wrapText('<div align="right">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Align Right"><AlignRight size={18}/></button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === 'size' ? null : 'size')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
             <Type size={14}/> SIZE <ChevronDown size={12} />
          </button>
          {activeDropdown === 'size' && (
            <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2">
              {FONT_SIZES.map(s => (
                <button key={s.label} onClick={() => applyStyle('font-size', s.value)} className="w-full px-4 py-2 text-left text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase">{s.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === 'font' ? null : 'font')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
             <Type size={14}/> FONT <ChevronDown size={12} />
          </button>
          {activeDropdown === 'font' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2">
              {FONTS.map(f => (
                <button key={f.label} onClick={() => applyStyle('font-family', f.value)} className="w-full px-4 py-2 text-left text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase">{f.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
             <Palette size={14}/> MÀU <ChevronDown size={12} />
          </button>
          {activeDropdown === 'color' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-3 grid grid-cols-3 gap-2">
              {COLORS.map(c => (
                <button 
                  key={c.label} 
                  onClick={() => applyStyle('color', c.value)} 
                  className={`w-full aspect-square ${c.bg} rounded-lg border border-slate-200 hover:scale-110 transition-transform`}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>

        <button onClick={() => wrapText("![Alt text](", ")")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Insert Image Link"><ImageIcon size={18}/></button>
      </div>
    </div>
  );

  const renderInputArea = () => (
    <div className="relative bg-white group flex flex-col min-h-[300px]">
      <textarea 
        ref={textareaRef}
        value={content} 
        onChange={e => setContent(e.target.value)} 
        placeholder={isAdmin ? "Nhập nội dung bài viết tin tức tại đây (sử dụng Markdown)..." : "Em viết bài trả lời tại đây (sử dụng Markdown)..."} 
        className="w-full flex-1 p-8 text-slate-600 text-lg font-medium outline-none transition-all resize-none selection:bg-indigo-100 leading-relaxed placeholder:text-slate-300 min-h-[300px]" 
      />
    </div>
  );

  const renderPreviewArea = () => (
    <div className="bg-slate-50/50 flex flex-col min-h-[300px] border-t lg:border-t-0 border-slate-100">
       <div className="bg-slate-100/50 px-8 py-3 border-b border-slate-200 flex items-center gap-3">
          <Eye size={14} className="text-indigo-600"/>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">XEM TRƯỚC NỘI DUNG</span>
       </div>
       <div className="flex-1 p-8 overflow-y-auto max-h-[500px] prose prose-slate max-w-none prose-sm">
          {content.trim() ? (
            <div className="prose-p:my-0 prose-headings:mb-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} 
                rehypePlugins={[rehypeRaw, rehypeKatex]}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 italic font-medium py-20">
              Đang đợi nội dung...
            </div>
          )}
       </div>
    </div>
  );

  const renderActionBar = () => (
    <div className="bg-slate-50/80 p-6 flex items-center justify-end border-t border-slate-100">
      <button onClick={() => handleSubmit()} disabled={loading} className={`px-10 py-4 ${isAdmin ? 'bg-amber-600 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'} text-white rounded-2xl hover:scale-105 shadow-2xl disabled:opacity-50 transition-all flex items-center gap-3 group font-black uppercase text-xs tracking-widest`}>
        {loading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />}
        {isAdmin ? (editingId ? 'Cập nhật nhiệm vụ' : 'Giao nhiệm vụ') : (editingId ? 'Cập nhật bài nộp' : 'Gửi bài nộp')}
      </button>
    </div>
  );

  const renderEditor = () => (
    <div className="bg-white overflow-hidden border border-slate-100">
       <div className="bg-white p-2 border-b border-slate-100">
          {renderToolbar()}
       </div>
       <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`}>
          {renderInputArea()}
          {showPreview && renderPreviewArea()}
       </div>
       {renderActionBar()}
    </div>
  );

  const questions = comments.filter(c => c.isAdmin);
  const answers = comments.filter(c => !c.isAdmin);
  
  const getAnswersForQuestion = (qId: string) => {
    return answers.filter(a => a.nodeId === `${homeworkNodeId}_ans_${qId}`);
  };

  const getMyAnswerForQuestion = (qId: string) => {
    if (!student) return null;
    const qAnswers = getAnswersForQuestion(qId);
    return qAnswers.find(a => a.author.includes(`[${student.name}]`));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <BookOpen className={`text-${themeColor}-600`} size={20} />
            Hệ thống Bài tập
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {isAdmin ? 'Soạn thảo & Quản lý kết quả học tập' : 'Nhiệm vụ từ giáo viên & Nộp bài làm'}
          </p>
        </div>
        <div className="flex items-center gap-2">
            {isAdmin && comments.length > 0 && (
              <button 
                onClick={handleBatchUpdateGrade}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
                title="Đồng bộ khối cho dữ liệu cũ"
              >
                <RefreshCw size={12} /> Đồng bộ Khối
              </button>
            )}
            {isConnected ? <span className="text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1"><Wifi size={10}/> Trực tiếp</span> : <span className="text-[8px] font-black text-amber-500 flex items-center gap-1"><WifiOff size={10}/> Kết nối...</span>}
            <button onClick={() => fetchComments()} className="p-2 text-slate-300 hover:text-indigo-600 transition-all"><RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      {/* STUDENT MISSION LIST VIEW */}
      {!isAdmin && (
        <div className="space-y-8">
           {questions.length === 0 ? (
             <div className="bg-white p-16 rounded-[48px] border-2 border-dashed border-slate-200 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                   <BookOpen size={40} className="text-slate-200" />
                </div>
                <p className="text-slate-400 font-black uppercase text-xs tracking-widest leading-relaxed">
                   Chào {student?.full_name || student?.name},<br/> hiện chưa có nhiệm vụ nào được giao cho bài học này.
                </p>
             </div>
           ) : (
             <div className="space-y-12">
                {questions.map((q, idx) => {
                  const myAnswer = getMyAnswerForQuestion(q.id);
                  const isReplying = replyingToId === q.id;

                  return (
                    <div key={q.id} className="space-y-6">
                       {/* QUESTION CARD */}
                       <div className={`bg-white rounded-[40px] border-2 transition-all overflow-hidden ${isReplying ? 'border-amber-400 shadow-2xl scale-[1.02]' : 'border-slate-100 shadow-xl'}`}>
                          <div className="p-8">
                             <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-black border border-amber-100 shadow-sm leading-none shrink-0">
                                      {idx + 1}
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Nhiệm vụ {idx + 1}</p>
                                      <div className="flex items-center gap-2">
                                         <Clock size={12} className="text-slate-300" />
                                         <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(q.createdAt).toLocaleString('vi-VN')}</p>
                                      </div>
                                   </div>
                                </div>
                                
                                {!myAnswer && !isReplying && (
                                   <button 
                                     onClick={() => { setReplyingToId(q.id); setContent(''); }}
                                     className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-100 flex items-center gap-2 group"
                                   >
                                      <Send size={14} className="group-hover:translate-x-1 transition-all" /> Trả lời
                                   </button>
                                )}
                                
                                {myAnswer && !isReplying && (
                                   <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                      <CheckCircle2 size={14} /> Đã hoàn thành
                                   </div>
                                )}
                             </div>

                             <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed mb-6">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                   {q.content}
                                </ReactMarkdown>
                             </div>
                             
                             {q.imageUrl && (
                                <div className="rounded-[32px] overflow-hidden border border-slate-100 mb-6">
                                   <img src={q.imageUrl} className="max-w-full h-auto" />
                                </div>
                             )}

                             {/* STUDENT ANSWER (IF EXISTS) */}
                             {myAnswer && !isReplying && (
                                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                                   <div className="flex items-center gap-3 mb-2">
                                      <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-emerald-50">
                                         EM
                                      </div>
                                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Nội dung em đã trả lời</p>
                                   </div>
                                   <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 prose prose-emerald max-w-none prose-sm text-emerald-900 font-bold italic leading-relaxed">
                                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                         {myAnswer.content}
                                      </ReactMarkdown>
                                   </div>
                                   {myAnswer.imageUrl && (
                                      <div className="rounded-2xl overflow-hidden border border-emerald-100 max-w-md">
                                         <img src={myAnswer.imageUrl} className="w-full h-auto opacity-80" />
                                      </div>
                                   )}
                                   <button 
                                     onClick={() => { setReplyingToId(q.id); setContent(myAnswer.content); setEditingId(myAnswer.id); }}
                                     className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all"
                                   >
                                      Sửa lại câu trả lời
                                   </button>
                                </div>
                             )}
                          </div>

                          {/* INLINE EDITOR FOR REPLIES */}
                          {isReplying && (
                            <div className="bg-slate-50/50 border-t border-amber-100 animate-in slide-in-from-top-4 duration-300">
                                <div className="p-4 bg-amber-50/50 flex items-center justify-between">
                                   <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                      <Edit2 size={12}/> Đang soạn thảo câu trả lời cho nhiệm vụ {idx + 1}
                                   </p>
                                   <button onClick={() => { setReplyingToId(null); setEditingId(null); setContent(''); }} className="p-2 hover:bg-white rounded-lg text-amber-600 transition-all">
                                      <X size={16} />
                                   </button>
                                </div>
                                {renderEditor()}
                            </div>
                          )}
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>
      )}

      {/* ADMIN EDITOR SECTION */}
      {isAdmin && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border-t-8 border-t-indigo-50">
          <div className="bg-white p-4 border-b border-slate-100">
             <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                   CỬA SỔ SOẠN THẢO NHIỆM VỤ
                </h4>
                <div className="flex items-center gap-4">
                   <button onClick={() => setShowPreview(!showPreview)} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showPreview ? 'text-indigo-600' : 'text-slate-400'}`}>
                      <Eye size={14}/> {showPreview ? 'Bản xem trước (ON)' : 'Bản xem trước (OFF)'}
                   </button>
                </div>
             </div>
             {renderToolbar()}
          </div>

          <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`}>
             {renderInputArea()}
             {showPreview && renderPreviewArea()}
          </div>
          {renderActionBar()}
        </div>
      )}

      {/* ADMIN MANAGEMENT SECTION: MISSION LIST */}
      {isAdmin && (
        <div className="space-y-6 pt-10">
           <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-amber-500 pl-3">
                 NHIỆM VỤ ĐÃ GIAO ({questions.length})
              </h4>
           </div>
           
           <div className="grid grid-cols-1 gap-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative group hover:border-amber-200 transition-all">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-black border border-amber-100 uppercase tracking-widest">
                           {idx + 1}
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhiệm vụ soạn thảo lúc:</span>
                            <p className="text-[10px] font-bold text-slate-800">{new Date(q.createdAt).toLocaleString()}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                         <button onClick={() => { setSelectedQuestionId(q.id); setShowAnswersModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-100 transition-all border border-emerald-100">
                            <Eye size={14} /> Xem bài nộp
                         </button>
                         <button onClick={() => { setContent(q.content); setEditingId(q.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Sửa nội dung">
                            <Edit2 size={16} />
                         </button>
                         <button onClick={() => handleDelete(q.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Xóa nhiệm vụ">
                            <Trash2 size={16} />
                         </button>
                      </div>
                   </div>
                   
                   <div className="prose prose-slate max-w-none prose-sm text-slate-600 leading-relaxed font-medium">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                        {q.content}
                      </ReactMarkdown>
                   </div>
                   {q.imageUrl && <div className="mt-4 rounded-xl overflow-hidden border border-slate-100"><img src={q.imageUrl} className="max-w-md h-auto" /></div>}
                </div>
              ))}
              
              {questions.length === 0 && (
               <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-10 text-center">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic mb-2">Chưa tìm thấy bản ghi nhiệm vụ nào trong CSDL cho bài học này</p>
                  <p className="text-[10px] text-slate-300 font-mono">Current ID: {homeworkNodeId}</p>
                  <button onClick={() => fetchComments()} className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition-all">THỬ TẢI LẠI DỮ LIỆU</button>
                </div>
              )}
           </div>
        </div>
      )}

      {/* STUDENT ANSWERS MODAL */}
      {showAnswersModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 bg-slate-50 border-b border-slate-100 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                     <CheckCircle2 size={24} />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                        {selectedQuestionId ? `Bài nộp - Nhiệm vụ ${questions.findIndex(q => q.id === selectedQuestionId) + 1}` : 'Danh sách bài nộp'}
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {selectedQuestionId 
                          ? `${getAnswersForQuestion(selectedQuestionId).length} Bài làm cho nhiệm vụ này` 
                          : `${answers.length} Tổng số bài nộp`
                        }
                     </p>
                  </div>
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="relative group flex-1 md:w-80">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-all" size={16} />
                     <input 
                       type="text" 
                       placeholder="Tìm theo Mã HS hoặc Họ tên..." 
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                       className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 focus:border-emerald-400 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all shadow-sm"
                     />
                  </div>
                  <button onClick={() => { setShowAnswersModal(false); setSelectedQuestionId(null); }} className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                     <X size={20} />
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
               {(selectedQuestionId ? getAnswersForQuestion(selectedQuestionId) : answers)
                 .filter(a => a.author.toLowerCase().includes(searchTerm.toLowerCase()))
                 .map(a => (
                    <div key={a.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row gap-8 animate-in slide-in-from-bottom-8">
                       <div className="bg-slate-50 rounded-3xl p-6 md:w-56 shrink-0 border border-slate-100 flex flex-col items-center text-center">
                          <div className={`w-16 h-16 rounded-[24px] bg-white shadow-xl flex items-center justify-center text-xl font-black text-emerald-600 mb-4 border-2 border-emerald-50`}>
                             {a.author.split(']').pop()?.trim().split(' ').pop()?.charAt(0).toUpperCase() || 'S'}
                          </div>
                          <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight mb-1">{a.author}</h5>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-[10px]">Học sinh</p>
                          
                          <div className="mt-4 pt-4 border-t border-slate-100 w-full space-y-3">
                             <div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Ngày nộp</p>
                                <p className="text-[9px] font-bold text-slate-500">{new Date(a.createdAt).toLocaleDateString('vi-VN')}</p>
                             </div>
                             <div>
                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Giờ nộp</p>
                                <p className="text-[9px] font-bold text-slate-500">{new Date(a.createdAt).toLocaleTimeString('vi-VN')}</p>
                             </div>
                          </div>

                          {isAdmin && (
                            <button onClick={() => handleDelete(a.id)} className="mt-6 p-2.5 bg-red-50 text-red-400 hover:text-red-500 hover:bg-red-100 rounded-xl transition-all shadow-sm border border-red-100" title="Gỡ bài">
                               <Trash2 size={16} />
                            </button>
                          )}
                       </div>
                       
                       <div className="flex-1 min-w-0">
                          <div className="prose prose-emerald max-w-none prose-sm text-slate-600 leading-relaxed font-bold marker:text-emerald-500 text-lg">
                             <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                {a.content}
                             </ReactMarkdown>
                          </div>
                          {a.imageUrl && (
                            <div className="mt-8 rounded-[32px] overflow-hidden border-4 border-slate-50 shadow-2xl">
                               <img src={a.imageUrl} className="w-full h-auto" />
                            </div>
                          )}
                       </div>
                    </div>
                 ))
               }
               
               {answers.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                     <CheckCircle2 size={64} className="text-slate-200 mb-4" />
                     <p className="text-sm font-black uppercase tracking-widest text-slate-400">Chưa có bài nộp nào</p>
                  </div>
               )}
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default HomeworkPanel;
