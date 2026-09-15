
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Image as ImageIcon, Wifi, WifiOff, RefreshCw, ChevronDown, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ForumComment } from '../types';
import { renderLatex } from '../utils';
import ConfirmModal from './ConfirmModal';

interface ForumProps {
  nodeId: string;
  isAdmin: boolean;
  themeColor: string;
}

const MATH_TEMPLATES = [
  { label: 'Phân số', value: '$\\frac{a}{b}$' },
  { label: 'Mũ', value: '$x^{n}$' },
  { label: 'Dưới', value: '$x_{i}$' },
  { label: 'Căn', value: '$\\sqrt{x}$' },
  { label: 'Pi', value: '$\\pi$' },
  { label: 'Véc-tơ', value: '$\\vec{F}$' },
];

const Forum: React.FC<ForumProps> = ({ nodeId, isAdmin, themeColor }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [name, setName] = useState(isAdmin ? 'Giáo viên' : (localStorage.getItem('forum_name') || ''));
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const fetchComments = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    // Try to fetch everything and handle potential column name differences in mapping
    const { data, error } = await supabase.from('forum_comments').select('*');
    if (data) {
      // Manual filtering and mapping to handle potential node_id vs nodeId naming issues
      const filtered = data.filter((item: any) => (item.nodeId || item.node_id) === nodeId);
      const mappedData = filtered.map((item: any) => ({
        id: item.id,
        nodeId: item.nodeId || item.node_id,
        author: item.author,
        content: item.content,
        imageUrl: item.imageUrl || item.image_url,
        createdAt: item.createdAt || item.created_at,
        isAdmin: item.isAdmin !== undefined ? item.isAdmin : item.is_admin,
      })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      setComments(mappedData);
      if (!silent) setTimeout(() => scrollToBottom('auto'), 50);
    }
    if (error) {
      console.error("Fetch error:", error);
      // Fallback specific query if total fetch fails
      const { data: retryData } = await supabase.from('forum_comments').select('*').eq('nodeId', nodeId);
      if (retryData) setComments(retryData);
    }
    setIsRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setConfirmConfig({
      isOpen: true,
      title: "Xóa thảo luận",
      message: "Bạn có chắc chắn muốn xoá câu hỏi/bình luận này?",
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('forum_comments').delete().eq('id', id);
          if (error) throw error;
          setComments(prev => prev.filter(c => c.id !== id));
        } catch (err) {
          alert("Lỗi khi xoá bình luận. Vui lòng thử lại.");
        }
      }
    });
  };

  useEffect(() => {
    fetchComments();
    const channel = supabase.channel(`public:forum_comments`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            const newC: ForumComment = {
              id: row.id,
              nodeId: row.nodeId || row.node_id,
              author: row.author,
              content: row.content,
              imageUrl: row.imageUrl || row.image_url,
              createdAt: row.createdAt || row.created_at,
              isAdmin: row.isAdmin !== undefined ? row.isAdmin : row.is_admin,
            };
            if (newC.nodeId === nodeId) {
              setComments(prev => {
                if (prev.some(c => c.id === newC.id)) return prev;
                return [...prev, newC];
              });
              setTimeout(() => scrollToBottom('smooth'), 100);
            }
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
  }, [nodeId, scrollToBottom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    // Use 'resources' bucket instead of forum_attachments for simpler setup
    const { error } = await supabase.storage.from('resources').upload(`forum/${fileName}`, file);
    if (error) {
      console.error("Forum Upload error:", error);
      alert(`Không thể tải ảnh thảo luận: ${error.message}\n\nBạn cần cấp quyền 'INSERT' cho bucket 'resources' trong phần Policies của Supabase.`);
      return null;
    }
    return supabase.storage.from('resources').getPublicUrl(`forum/${fileName}`).data.publicUrl;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = name.trim() || "Ẩn danh";
    if (!content.trim() && !selectedFile) return;
    setLoading(true);

    if (!isAdmin) localStorage.setItem('forum_name', finalName);

    let imageUrl = undefined;
    if (selectedFile) {
      setUploading(true);
      const url = await uploadImage(selectedFile);
      if (url) imageUrl = url;
      setUploading(false);
    }

    const createdAt = new Date().toISOString();
    
    // Try both camelCase and snake_case to ensure it lands somewhere or let Supabase handle it
    const newComment = { 
      nodeId, 
      node_id: nodeId,
      author: finalName, 
      content, 
      imageUrl: imageUrl, 
      image_url: imageUrl,
      isAdmin: isAdmin, 
      is_admin: isAdmin,
      createdAt,
      created_at: createdAt
    };
    
    const { error } = await supabase.from('forum_comments').insert([newComment]);
    if (error) {
      console.error("Insert error, retrying without duplicates:", error);
      // If error, try a simpler version in case some columns don't exist
      const fallbackComment = { nodeId, author: finalName, content, imageUrl, isAdmin, createdAt };
      const { error: error2 } = await supabase.from('forum_comments').insert([fallbackComment]);
      if (error2) {
         const snakeComment = { node_id: nodeId, author: finalName, content, image_url: imageUrl, is_admin: isAdmin, created_at: createdAt };
         const { error: error3 } = await supabase.from('forum_comments').insert([snakeComment]);
         if (error3) alert("Không thể gửi bình luận. Lỗi cấu trúc bảng.");
      }
    }
    
    setContent(''); setSelectedFile(null); setPreviewUrl(null); scrollToBottom('smooth');
    setLoading(false);
  };

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

  const themeBorderClasses = {
    'indigo-600': 'focus:border-indigo-400',
    'emerald-600': 'focus:border-emerald-400',
    'rose-600': 'focus:border-rose-400',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeBgClass = themeBgClasses[themeColor as keyof typeof themeBgClasses] || themeBgClasses['indigo-600'];
  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white px-4 py-2 border-b flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          {isConnected ? <span className="text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1"><Wifi size={10}/> Trực tiếp</span> : <span className="text-[8px] font-black text-amber-500 flex items-center gap-1"><WifiOff size={10}/> Kết nối...</span>}
        </div>
        <div className="flex items-center gap-3">
           <button onClick={()=>setShowPreview(!showPreview)} className={`p-1 text-[9px] font-bold uppercase tracking-widest transition-all ${showPreview ? currentThemeTextClass : 'text-slate-300'}`}>Xem trước</button>
           <button onClick={() => fetchComments()} className={`p-1 text-slate-300 hover:${currentThemeTextClass} transition-all`}><RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {comments.length === 0 && !isRefreshing && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
             <AlertCircle size={32} className="mb-2" />
             <p className="text-[10px] font-black uppercase tracking-widest">Chưa có thảo luận</p>
          </div>
        )}
        {comments.map((c, idx) => (
          <div key={c.id || idx} className={`flex flex-col ${c.isAdmin ? 'items-end' : 'items-start'} animate-in fade-in duration-300 group`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border relative ${c.isAdmin ? `${currentThemeBgClass} border-${themeColor.split('-')[0]}-600 text-white` : 'bg-white border-slate-100 text-slate-800'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${c.isAdmin ? 'text-white/80' : currentThemeTextClass}`}>{c.author}</span>
                <span className={`text-[8px] opacity-40 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(c.id)} 
                    className="ml-auto p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Xoá bình luận"
                  >
                    <Trash2 size={10}/>
                  </button>
                )}
              </div>
              {c.imageUrl && <div className="mb-3 rounded-lg overflow-hidden border border-white/10"><img src={c.imageUrl} className="max-w-full max-h-80 object-contain mx-auto" alt="attachment" /></div>}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{renderLatex(c.content)}</div>
            </div>
          </div>
        ))}
      </div>

      {showScrollBtn && <button onClick={() => scrollToBottom()} className={`absolute bottom-40 right-6 p-3 bg-white shadow-xl rounded-full ${currentThemeTextClass} border border-slate-100 animate-bounce z-20`}><ChevronDown size={20} /></button>}

      <div className="p-4 bg-white border-t space-y-3 shadow-2xl">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setContent(prev => prev + ' ' + t.value)} className={`shrink-0 px-3 py-1.5 bg-slate-50 hover:bg-${themeColor.split('-')[0]}-50 border border-slate-100 rounded-lg text-[9px] font-bold uppercase transition-all`}>
              {t.label}
            </button>
          ))}
        </div>

        {showPreview && content.trim() && (
          <div className={`p-3 bg-${themeColor.split('-')[0]}-50/30 border border-${themeColor.split('-')[0]}-100 rounded-xl text-sm italic text-slate-500 animate-in fade-in zoom-in-95`}>
             <div className={`text-[9px] font-black ${currentThemeTextClass} opacity-70 uppercase tracking-widest mb-1 flex items-center gap-1`}><Eye size={10}/> Preview:</div>
             <div className="not-italic whitespace-pre-wrap">{renderLatex(content)}</div>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            {!isAdmin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên em..." className={`w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase outline-none ${currentThemeBorderClass}`} />}
            <textarea 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
              placeholder="Nhập câu hỏi... (Nhấn Ctrl + Enter để gửi)" 
              className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none ${currentThemeBorderClass} focus:bg-white transition-all min-h-[50px] max-h-[120px]`} 
            />
          </div>
          <div className="flex flex-col gap-2 shrink-0">
             <button onClick={() => handleSubmit()} disabled={loading} className={`p-4 ${currentThemeBgClass} text-white rounded-2xl hover:opacity-90 shadow-xl shadow-${themeColor.split('-')[0]}-100 disabled:opacity-50 transition-all`}>
               {loading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
             </button>
          </div>
        </div>

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
    </div>
  );
};

export default Forum;
