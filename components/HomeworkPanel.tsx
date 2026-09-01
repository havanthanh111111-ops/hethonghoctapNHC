
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Image as ImageIcon, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff, AlertCircle, Home, BookOpen, Clock, CheckCircle2, Bold, Italic, List, Table as TableIcon, Link, Type, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading3, Calculator, X, Search, Edit2, Users, Cloud, Lock, Check, Filter, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { supabase } from '../supabaseClient';
import { uploadFileToGoogleDrive, signInWithGoogleForDrive, getDriveAccessToken } from '../googleDrive';
import { ForumComment, Student } from '../types';
import { ConfirmModal, ToastNotification, ConfirmState, ToastState } from './CustomDialog';

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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [filterApprovalTab, setFilterApprovalTab] = useState<'all' | 'pending' | 'approved'>('all');
  const [expandedAnswersQId, setExpandedAnswersQId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ isOpen: false, message: '' });

  const isGuest = !isAdmin && (!student || student.is_guest === true || student.name === 'Khách' || student.name === 'Khách vãng lai' || student.full_name === 'Khách vãng lai' || (student.id ? student.id.startsWith('00000000-0000-4000-a000-') : false));

  const displayMarkdown = (rawText: string) => {
    if (!rawText) return '';
    return rawText.replace(/<!--status:(approved|pending)-->/g, '').trim();
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    setToastState({ isOpen: true, message, type, title });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, isOpen: false }));
    }, 5000);
  };
  
  const homeworkNodeId = `homework_${nodeId}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const driveFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const triggerGoogleDriveUpload = async () => {
    try {
      if (!getDriveAccessToken()) {
        setIsUploadingDrive(true);
        await signInWithGoogleForDrive();
        setIsUploadingDrive(false);
      }
      driveFileInputRef.current?.click();
    } catch (err: any) {
      setIsUploadingDrive(false);
      showToast(err.message || 'Lỗi khi đăng nhập Google Drive.', 'error', 'Đăng nhập Google thất bại');
    }
  };

  const handleDriveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDrive(true);
    try {
      const result = await uploadFileToGoogleDrive(file);
      const fileName = result.name || file.name;
      const isPdf = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

      let snippet = '';
      if (isPdf) {
        snippet = `\n\n<iframe src="${result.previewUrl}" width="100%" height="500px" style="border:none; border-radius:12px;"></iframe>\n\n[📄 Xem/Tải tài liệu PDF: ${fileName}](${result.previewUrl})\n\n`;
      } else if (file.type.startsWith('image/')) {
        snippet = `\n\n![${fileName}](${result.previewUrl})\n\n`;
      } else {
        snippet = `\n\n[📎 Tài liệu đính kèm Google Drive: ${fileName}](${result.previewUrl})\n\n`;
      }

      setContent(prev => prev + snippet);
      showToast(`Đã tải file "${fileName}" lên Google Drive và chèn xem trực tiếp thành công!`, 'success', 'Thành công');
    } catch (err: any) {
      console.error("Google Drive upload error in HomeworkPanel:", err);
      showToast(err.message || 'Lỗi khi tải file lên Google Drive.', 'error', 'Tải tệp thất bại');
    } finally {
      setIsUploadingDrive(false);
      e.target.value = '';
    }
  };

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
          .map((item: any) => {
            const isTeacher = item.isAdmin === true || 
                            item.isAdmin === 'true' || 
                            item.is_admin === true || 
                            item.is_admin === 'true' || 
                            item.author === 'Giáo viên';
            
            const rawContent = item.content || '';
            const isApproved = isTeacher ? true : (
              item.isApproved === true || 
              item.isApproved === 'true' || 
              item.is_approved === true || 
              item.is_approved === 'true' || 
              item.approved === true || 
              item.approved === 'true' ||
              rawContent.includes('<!--status:approved-->')
            );

            return {
              id: item.id,
              nodeId: item.nodeId || item.node_id,
              author: item.author,
              content: rawContent,
              imageUrl: item.imageUrl || item.image_url,
              createdAt: item.createdAt || item.created_at,
              isAdmin: isTeacher,
              isApproved: isApproved,
            };
          })
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
    if (isGuest) {
      showToast("Tính năng nộp bài chỉ dành cho học sinh có tài khoản được cấp.", "error", "Không được phép");
      return;
    }
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

    // Clean any prior status tags
    const cleanUserContent = content.replace(/<!--status:(approved|pending)-->/g, '').trim();
    // Default: admin post is auto-approved, student answer starts with pending status
    const finalContent = isAdmin ? cleanUserContent : `${cleanUserContent}\n\n<!--status:pending-->`;
    const isInitialApproved = isAdmin ? true : false;

    const commentData = { 
      nodeId: targetNodeId, 
      node_id: targetNodeId,
      author: authorName, 
      content: finalContent, 
      imageUrl, 
      image_url: imageUrl,
      isAdmin, 
      is_admin: isAdmin,
      isApproved: isInitialApproved,
      is_approved: isInitialApproved,
      approved: isInitialApproved,
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
          const fallbackData = { content: finalContent, imageUrl, image_url: imageUrl, is_approved: isInitialApproved };
          result = await supabase.from('forum_comments').update(fallbackData).eq('id', editingId);
        }
      } else {
        // INSERT new comment
        result = await supabase.from('forum_comments').insert([commentData]);
        
        if (result.error) {
          console.error("Insert error, retrying with fallback:", result.error);
          const fallback1 = { nodeId: targetNodeId, author: authorName, content: finalContent, imageUrl, isAdmin, is_approved: isInitialApproved, createdAt, grade_id: gradeId };
          result = await supabase.from('forum_comments').insert([fallback1]);
          if (result.error) {
            const fallback2 = { node_id: targetNodeId, author: authorName, content: finalContent, image_url: imageUrl, is_admin: isAdmin, created_at: createdAt, grade_id: gradeId };
            result = await supabase.from('forum_comments').insert([fallback2]);
            if (result.error) {
              const fallback3 = { node_id: targetNodeId, author: authorName, content: finalContent, image_url: imageUrl, is_admin: isAdmin };
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

      if (!isAdmin) {
        showToast("Đã nộp bài thành công! Bài làm của em đang chờ giáo viên duyệt trước khi hiển thị công khai.", "success", "Nộp bài thành công");
      } else {
        showToast(editingId ? "Đã cập nhật nhiệm vụ thành công!" : "Đã giao nhiệm vụ thành công!", "success");
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      showToast("Lỗi khi gửi nội dung: " + (err.message || "Kiểm tra kết nối"), 'error', 'Thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApprove = async (answer: ForumComment) => {
    if (!isAdmin) return;
    const newStatus = !answer.isApproved;
    
    // Clean and tag content
    const cleanContent = answer.content.replace(/<!--status:(approved|pending)-->/g, '').trim();
    const updatedContent = newStatus 
      ? `${cleanContent}\n\n<!--status:approved-->`
      : `${cleanContent}\n\n<!--status:pending-->`;

    // Optimistic UI update
    setComments(prev => prev.map(c => c.id === answer.id ? { ...c, isApproved: newStatus, content: updatedContent } : c));

    try {
      let { error } = await supabase
        .from('forum_comments')
        .update({
          is_approved: newStatus,
          isApproved: newStatus,
          approved: newStatus,
          content: updatedContent
        })
        .eq('id', answer.id);

      if (error) {
        // Fallback update content only if column is not supported in schema
        const { error: fallbackError } = await supabase
          .from('forum_comments')
          .update({ content: updatedContent })
          .eq('id', answer.id);
        
        if (fallbackError) throw fallbackError;
      }

      const studentDisplayName = answer.author.split(']').pop()?.trim() || answer.author;
      showToast(
        newStatus ? `Đã duyệt & công khai bài nộp của ${studentDisplayName}` : `Đã chuyển bài nộp về trạng thái Chờ duyệt`,
        'success',
        newStatus ? 'Đã duyệt công khai' : 'Đã hủy duyệt'
      );
    } catch (err: any) {
      console.error("Approve error:", err);
      showToast("Lỗi khi cập nhật trạng thái duyệt: " + err.message, 'error');
      fetchComments(true);
    }
  };

  const handleBatchApproveAll = async (targetQId?: string) => {
    if (!isAdmin) return;
    const targetAnswers = (targetQId ? getAnswersForQuestion(targetQId) : answers).filter(a => !a.isApproved);
    if (targetAnswers.length === 0) {
      showToast("Không có bài nộp nào đang chờ duyệt.", "info");
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Duyệt tất cả bài nộp',
      message: `Bạn có chắc chắn muốn duyệt và công khai toàn bộ ${targetAnswers.length} bài nộp đang chờ duyệt?`,
      type: 'info',
      confirmText: 'Duyệt tất cả',
      onConfirm: async () => {
        setLoading(true);
        try {
          for (const ans of targetAnswers) {
            const cleanContent = ans.content.replace(/<!--status:(approved|pending)-->/g, '').trim();
            const updatedContent = `${cleanContent}\n\n<!--status:approved-->`;
            
            await supabase
              .from('forum_comments')
              .update({
                is_approved: true,
                isApproved: true,
                approved: true,
                content: updatedContent
              })
              .eq('id', ans.id);
          }
          showToast(`Đã duyệt thành công ${targetAnswers.length} bài nộp!`, 'success');
          fetchComments(true);
        } catch (err: any) {
          showToast("Lỗi: " + err.message, 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    setConfirmState({
      isOpen: true,
      title: 'Xác nhận xoá bài đăng',
      message: 'Bạn có chắc chắn muốn xoá bài viết / câu trả lời này không?',
      type: 'danger',
      confirmText: 'Xóa bài',
      onConfirm: async () => {
        await supabase.from('forum_comments').delete().eq('id', id);
        setComments(prev => prev.filter(c => c.id !== id));
        showToast('Đã xóa bài viết thành công', 'success');
      },
    });
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId || comments.length === 0) return;
    
    setConfirmState({
      isOpen: true,
      title: `Gắn nhãn Khối ${gradeId}`,
      message: `Bạn có chắc chắn muốn gắn nhãn Khối ${gradeId} cho toàn bộ bài viết và câu trả lời trong bài học này?`,
      type: 'info',
      confirmText: 'Gắn nhãn',
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
            showToast(`Đã đồng bộ nhãn Khối ${gradeId} cho ${successCount} mục thảo luận.`, 'success');
            fetchComments();
          } else {
            showToast("Không tìm thấy dữ liệu cũ để đồng bộ hoặc bảng chưa có cột grade_id.", 'info');
          }
        } catch (err: any) {
          showToast("Lỗi: " + err.message, 'error');
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
      
      {previewUrl && (
         <div className="absolute bottom-4 left-8 group/preview">
           <img src={previewUrl} className="h-16 w-16 object-cover rounded-xl border-2 border-indigo-100 shadow-lg" />
           <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition-all shadow-md"><X size={10}/></button>
         </div>
      )}
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
    <div className="bg-slate-50/80 p-6 flex items-center justify-between border-t border-slate-100 flex-wrap gap-4">
      <div className="flex items-center gap-3 flex-wrap">
         <button 
           type="button" 
           onClick={triggerGoogleDriveUpload} 
           disabled={isUploadingDrive}
           className="flex items-center gap-2 px-5 py-3 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 border border-emerald-200 transition-all font-black uppercase text-[10px] tracking-widest shadow-sm"
         >
            <Cloud size={18} /> {isUploadingDrive ? 'Đang lên Drive...' : 'Tải file lên Google Drive'}
         </button>
         <input type="file" ref={driveFileInputRef} onChange={handleDriveFileUpload} className="hidden" />

         {isAdmin && (
           <>
             <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-white text-slate-500 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 transition-all font-black uppercase text-[10px] tracking-widest shadow-sm">
                <ImageIcon size={18} /> Đính kèm ảnh
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
           </>
         )}
      </div>

      <button 
        onClick={() => handleSubmit()} 
        disabled={loading || uploading || isUploadingDrive || isGuest} 
        className={`px-10 py-4 ${isAdmin ? 'bg-amber-600 shadow-amber-200' : isGuest ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 shadow-indigo-200 text-white hover:scale-105 shadow-2xl'} rounded-2xl disabled:opacity-50 transition-all flex items-center gap-3 group font-black uppercase text-xs tracking-widest`}
      >
        {loading ? <RefreshCw size={20} className="animate-spin" /> : isGuest ? <Lock size={18} /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />}
        {isAdmin ? (editingId ? 'Cập nhật nhiệm vụ' : 'Giao nhiệm vụ') : isGuest ? 'Khóa nộp bài (Khách)' : (editingId ? 'Cập nhật bài nộp' : 'Gửi bài nộp')}
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
           {isGuest && (
             <div className="bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200/80 rounded-3xl p-5 flex items-center gap-4 text-amber-900 shadow-sm animate-in fade-in duration-300">
                <div className="w-11 h-11 rounded-2xl bg-amber-100/90 text-amber-700 flex items-center justify-center shrink-0 shadow-sm">
                   <Lock size={20} />
                </div>
                <div className="space-y-0.5">
                   <p className="font-black uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-2">
                      <span>Chế độ xem Khách vãng lai</span>
                      <span className="text-[9px] bg-amber-200/70 text-amber-800 px-2 py-0.5 rounded-md font-bold">Chỉ xem</span>
                   </p>
                   <p className="text-xs text-amber-800/90 font-medium leading-relaxed">
                      Nút trả lời và nộp bài tập đã được đóng băng đối với khách vãng lai. Tính năng làm bài và chấm điểm chỉ kích hoạt khi học sinh đăng nhập bằng tài khoản được giáo viên cấp.
                   </p>
                </div>
             </div>
           )}

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
                                   isGuest ? (
                                     <button 
                                       disabled
                                       className="px-5 py-2.5 bg-slate-100 border border-slate-200/80 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed flex items-center gap-2 select-none opacity-80"
                                       title="Đã đóng băng nút trả lời đối với khách vãng lai. Vui lòng đăng nhập tài khoản học sinh để làm bài."
                                     >
                                        <Lock size={13} className="text-slate-400" /> Khóa trả lời
                                     </button>
                                   ) : (
                                     <button 
                                       onClick={() => { setReplyingToId(q.id); setContent(''); }}
                                       className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-100 flex items-center gap-2 group"
                                     >
                                        <Send size={14} className="group-hover:translate-x-1 transition-all" /> Trả lời
                                     </button>
                                   )
                                )}
                                
                                {myAnswer && !isReplying && (
                                   <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${myAnswer.isApproved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                      {myAnswer.isApproved ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                                      {myAnswer.isApproved ? 'Đã được duyệt' : 'Chờ duyệt'}
                                   </div>
                                )}
                             </div>

                             <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed mb-6">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                   {displayMarkdown(q.content)}
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
                                   <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
                                      <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-xl ${myAnswer.isApproved ? 'bg-emerald-600' : 'bg-amber-500'} text-white flex items-center justify-center text-[10px] font-black shadow-md`}>
                                            EM
                                         </div>
                                         <div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${myAnswer.isApproved ? 'text-emerald-700' : 'text-amber-700'}`}>
                                               Nội dung em đã trả lời
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400">
                                               Nộp lúc: {new Date(myAnswer.createdAt).toLocaleString('vi-VN')}
                                            </p>
                                         </div>
                                      </div>

                                      {myAnswer.isApproved ? (
                                         <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">
                                            <CheckCircle2 size={13} className="text-emerald-600" /> Đã được giáo viên duyệt & công nhận
                                         </span>
                                      ) : (
                                         <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">
                                            <Clock size={13} className="text-amber-600" /> Đang chờ giáo viên duyệt
                                         </span>
                                      )}
                                   </div>

                                   {!myAnswer.isApproved && (
                                      <div className="p-3.5 bg-amber-50/80 border border-amber-200/70 rounded-2xl text-[11px] text-amber-900 font-medium flex items-center gap-2.5">
                                         <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                                         <span>Bài làm của em đã gửi thành công và đang chờ giáo viên kiểm duyệt để bảo đảm chất lượng nội dung trước khi xuất hiện trên màn hình chung.</span>
                                      </div>
                                   )}

                                   <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-100 prose prose-slate max-w-none prose-sm text-slate-700 font-medium leading-relaxed">
                                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                         {displayMarkdown(myAnswer.content)}
                                      </ReactMarkdown>
                                   </div>
                                   {myAnswer.imageUrl && (
                                      <div className="rounded-2xl overflow-hidden border border-slate-200 max-w-md">
                                         <img src={myAnswer.imageUrl} className="w-full h-auto opacity-90" />
                                      </div>
                                   )}
                                   <button 
                                     onClick={() => { setReplyingToId(q.id); setContent(displayMarkdown(myAnswer.content)); setEditingId(myAnswer.id); }}
                                     className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all flex items-center gap-1.5 pt-1"
                                   >
                                      <Edit2 size={12} /> Sửa lại câu trả lời
                                   </button>
                                </div>
                             )}

                             {/* APPROVED CLASSMATE ANSWERS (CLEAN & COLLAPSIBLE) */}
                             {(() => {
                                const otherApprovedAnswers = getAnswersForQuestion(q.id).filter(a => a.isApproved && (!student || !a.author.includes(`[${student.name}]`)));
                                if (otherApprovedAnswers.length === 0) return null;
                                const isExpanded = expandedAnswersQId === q.id;

                                return (
                                   <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                                      <button 
                                        onClick={() => setExpandedAnswersQId(isExpanded ? null : q.id)}
                                        className="flex items-center justify-between w-full p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/80 text-left transition-all group"
                                      >
                                         <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
                                               <ShieldCheck size={16} />
                                            </div>
                                            <div>
                                               <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">
                                                  Bài làm tham khảo từ các bạn ({otherApprovedAnswers.length} bài đã duyệt)
                                               </p>
                                               <p className="text-[9px] text-slate-400 font-medium">Chỉ hiển thị các câu trả lời chất lượng đã qua kiểm duyệt</p>
                                            </div>
                                         </div>
                                         <div className="text-slate-400 group-hover:text-slate-600 transition-transform">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                         </div>
                                      </button>

                                      {isExpanded && (
                                         <div className="space-y-4 pl-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {otherApprovedAnswers.map(ans => (
                                               <div key={ans.id} className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100/70 space-y-3">
                                                  <div className="flex items-center justify-between text-[10px]">
                                                     <span className="font-black text-emerald-800 uppercase tracking-tight">{ans.author}</span>
                                                     <span className="text-slate-400 font-medium">{new Date(ans.createdAt).toLocaleDateString('vi-VN')}</span>
                                                  </div>
                                                  <div className="prose prose-emerald max-w-none prose-sm text-slate-700 leading-relaxed font-medium">
                                                     <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                                        {displayMarkdown(ans.content)}
                                                     </ReactMarkdown>
                                                  </div>
                                                  {ans.imageUrl && (
                                                     <div className="rounded-xl overflow-hidden border border-emerald-100 max-w-sm">
                                                        <img src={ans.imageUrl} className="w-full h-auto" />
                                                     </div>
                                                  )}
                                               </div>
                                            ))}
                                         </div>
                                      )}
                                   </div>
                                );
                             })()}
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
              {questions.map((q, idx) => {
                const qAnswers = getAnswersForQuestion(q.id);
                const pendingCount = qAnswers.filter(a => !a.isApproved).length;

                return (
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
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => { setSelectedQuestionId(q.id); setFilterApprovalTab(pendingCount > 0 ? 'pending' : 'all'); setShowAnswersModal(true); }} 
                             className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all border border-emerald-200 shadow-sm"
                           >
                              <Eye size={14} /> Xem bài nộp ({qAnswers.length})
                              {pendingCount > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-md text-[8px] font-bold">
                                   {pendingCount} chờ duyệt
                                </span>
                              )}
                           </button>
                           <button onClick={() => { setContent(displayMarkdown(q.content)); setEditingId(q.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Sửa nội dung">
                              <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleDelete(q.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Xóa nhiệm vụ">
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                     
                     <div className="prose prose-slate max-w-none prose-sm text-slate-600 leading-relaxed font-medium">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                          {displayMarkdown(q.content)}
                        </ReactMarkdown>
                     </div>
                     {q.imageUrl && <div className="mt-4 rounded-xl overflow-hidden border border-slate-100"><img src={q.imageUrl} className="max-w-md h-auto" /></div>}
                  </div>
                );
              })}
              
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

      {/* STUDENT ANSWERS APPROVAL & REVIEW MODAL */}
      {showAnswersModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 bg-slate-50 border-b border-slate-100 shrink-0 space-y-4">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                        <CheckCircle2 size={24} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                           {selectedQuestionId ? `Duyệt bài nộp - Nhiệm vụ ${questions.findIndex(q => q.id === selectedQuestionId) + 1}` : 'Kiểm duyệt bài nộp học sinh'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {selectedQuestionId 
                             ? `${getAnswersForQuestion(selectedQuestionId).length} Bài nộp cho nhiệm vụ này` 
                             : `${answers.length} Tổng số bài nộp`
                           }
                        </p>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <div className="relative group flex-1 md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-all" size={16} />
                        <input 
                          type="text" 
                          placeholder="Tìm theo Tên hoặc Mã HS..." 
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-400 rounded-2xl outline-none text-xs font-bold text-slate-700 transition-all shadow-sm"
                        />
                     </div>
                     <button onClick={() => { setShowAnswersModal(false); setSelectedQuestionId(null); }} className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                        <X size={18} />
                     </button>
                  </div>
               </div>

               {/* TAB FILTER & BULK ACTIONS */}
               {(() => {
                  const scopeAnswers = selectedQuestionId ? getAnswersForQuestion(selectedQuestionId) : answers;
                  const totalCount = scopeAnswers.length;
                  const pendingCount = scopeAnswers.filter(a => !a.isApproved).length;
                  const approvedCount = scopeAnswers.filter(a => a.isApproved).length;

                  return (
                     <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-200/60">
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => setFilterApprovalTab('all')}
                             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filterApprovalTab === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                           >
                              Tất cả ({totalCount})
                           </button>
                           <button 
                             onClick={() => setFilterApprovalTab('pending')}
                             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${filterApprovalTab === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}
                           >
                              <Clock size={12} /> Chờ duyệt ({pendingCount})
                           </button>
                           <button 
                             onClick={() => setFilterApprovalTab('approved')}
                             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${filterApprovalTab === 'approved' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'}`}
                           >
                              <CheckCircle2 size={12} /> Đã duyệt ({approvedCount})
                           </button>
                        </div>

                        {isAdmin && pendingCount > 0 && (
                           <button 
                             onClick={() => handleBatchApproveAll(selectedQuestionId || undefined)}
                             className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-emerald-100 flex items-center gap-2 transition-all"
                           >
                              <ShieldCheck size={14} /> Duyệt tất cả ({pendingCount} bài chờ)
                           </button>
                        )}
                     </div>
                  );
               })()}
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/40">
               {(() => {
                  const scopeAnswers = (selectedQuestionId ? getAnswersForQuestion(selectedQuestionId) : answers)
                     .filter(a => {
                        if (filterApprovalTab === 'pending') return !a.isApproved;
                        if (filterApprovalTab === 'approved') return a.isApproved;
                        return true;
                     })
                     .filter(a => a.author.toLowerCase().includes(searchTerm.toLowerCase()));

                  if (scopeAnswers.length === 0) {
                     return (
                        <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-60">
                           <CheckCircle2 size={56} className="text-slate-300 mb-3" />
                           <p className="text-sm font-black uppercase tracking-widest text-slate-500">Không tìm thấy bài nộp nào phù hợp</p>
                           <p className="text-xs text-slate-400 mt-1">Hãy thử chọn bộ lọc khác hoặc kiểm tra lại từ khóa tìm kiếm</p>
                        </div>
                     );
                  }

                  return scopeAnswers.map(a => (
                     <div key={a.id} className={`bg-white p-6 md:p-8 rounded-[36px] border transition-all flex flex-col md:flex-row gap-6 ${a.isApproved ? 'border-emerald-100 shadow-lg shadow-emerald-50/50' : 'border-amber-200 shadow-xl shadow-amber-50/50 bg-amber-50/10'}`}>
                        <div className="bg-slate-50 rounded-3xl p-5 md:w-56 shrink-0 border border-slate-100 flex flex-col items-center text-center">
                           <div className={`w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-lg font-black ${a.isApproved ? 'text-emerald-600 border-2 border-emerald-100' : 'text-amber-600 border-2 border-amber-100'} mb-3`}>
                              {a.author.split(']').pop()?.trim().split(' ').pop()?.charAt(0).toUpperCase() || 'S'}
                           </div>
                           <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight mb-1">{a.author}</h5>
                           
                           {/* STATUS PILL */}
                           <div className="my-2">
                              {a.isApproved ? (
                                 <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[8px] font-black uppercase tracking-wider">
                                    <CheckCircle2 size={10} /> Đã công khai
                                 </span>
                              ) : (
                                 <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[8px] font-black uppercase tracking-wider animate-pulse">
                                    <Clock size={10} /> Chờ duyệt
                                 </span>
                              )}
                           </div>
                           
                           <div className="mt-3 pt-3 border-t border-slate-200/70 w-full space-y-2 text-left">
                              <div>
                                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-wider">Thời gian nộp</p>
                                 <p className="text-[9px] font-bold text-slate-600">{new Date(a.createdAt).toLocaleString('vi-VN')}</p>
                              </div>
                           </div>

                           {/* TEACHER APPROVAL & DELETE ACTIONS */}
                           {isAdmin && (
                             <div className="mt-4 pt-3 border-t border-slate-200/70 w-full space-y-2">
                                <button 
                                  onClick={() => handleToggleApprove(a)}
                                  className={`w-full py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                    a.isApproved 
                                      ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200' 
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                                  }`}
                                >
                                   {a.isApproved ? (
                                     <>
                                        <X size={12} /> Hủy duyệt (Ẩn)
                                     </>
                                   ) : (
                                     <>
                                        <CheckCircle2 size={12} /> Duyệt & Công khai
                                     </>
                                   )}
                                </button>
                                <button onClick={() => handleDelete(a.id)} className="w-full py-1.5 px-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1" title="Xóa bài nộp">
                                   <Trash2 size={12} /> Xóa bài
                                </button>
                             </div>
                           )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                           <div className="prose prose-emerald max-w-none prose-sm text-slate-700 leading-relaxed font-medium">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                 {displayMarkdown(a.content)}
                              </ReactMarkdown>
                           </div>
                           {a.imageUrl && (
                             <div className="mt-6 rounded-[28px] overflow-hidden border-2 border-slate-100 shadow-md max-w-lg">
                                <img src={a.imageUrl} className="w-full h-auto" />
                             </div>
                           )}
                        </div>
                     </div>
                  ));
               })()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL & TOAST CHO HOÀN CẢNH IFRAME / MOBILE */}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
      <ToastNotification state={toastState} onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default HomeworkPanel;
