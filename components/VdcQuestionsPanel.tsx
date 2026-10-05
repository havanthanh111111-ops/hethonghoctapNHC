import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Pencil, 
  Trash2, 
  Copy, 
  Check, 
  Layers, 
  Database, 
  AlertCircle, 
  ArrowLeft, 
  ExternalLink, 
  Filter, 
  CheckCircle2, 
  HelpCircle, 
  Maximize2, 
  Minimize2,
  X, 
  Upload, 
  Cloud, 
  Folder, 
  RefreshCw,
  FileText,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Menu,
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  Calculator,
  Image as ImageIcon,
  Columns2,
  Quote,
  Type,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Subscript,
  Superscript
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { VdcQuestion, BookNode } from '../types';
import { SAMPLE_VDC_QUESTIONS } from '../sampleVdcData';
import { supabase } from '../supabaseClient';
import { renderLatex } from '../utils';
import { uploadToImgBB } from '../imgbb';
import { uploadFileToGoogleDrive, signInWithGoogleForDrive, getDriveAccessToken } from '../googleDrive';
import { ImageUploadModal } from './ImageUploadModal';

const MATH_FORMULAS = [
  { label: 'PHÂN SỐ', display: 'a/b', value: '$\\frac{a}{b}$' },
  { label: 'CĂN BẬC 2', display: '√x', value: '$\\sqrt{x}$' },
  { label: 'CĂN BẬC N', display: 'ⁿ√x', value: '$\\sqrt[n]{x}$' },
  { label: 'MŨ / LŨY THỪA', display: 'x²', value: '$x^{2}$' },
  { label: 'CHỈ SỐ DƯỚI', display: 'x₁', value: '$x_{1}$' },
  { label: 'VẬN TỐC ĐẦU', display: 'v₀', value: '$v_{0}$' },
  { label: 'GIA TỐC', display: 'm/s²', value: '$\\text{m/s}^2$' },
  { label: '10 MŨ ÂM', display: '10⁻³', value: '$10^{-3}$' },
  { label: 'CHỈ SỐ MAX', display: 'xmax', value: '$x_{\\max}$' },
  { label: 'VECTOR', display: '→v', value: '$\\vec{v}$' },
  { label: 'LỰC VECTOR', display: '→F', value: '$\\vec{F}$' },
  { label: 'TẦN SỐ GÓC', display: 'ω', value: '$\\omega$' },
  { label: 'BƯỚC SÓNG', display: 'λ', value: '$\\lambda$' },
  { label: 'PHA DAO ĐỘNG', display: 'φ', value: '$\\varphi$' },
  { label: 'GÓC ALPHA', display: 'α', value: '$\\alpha$' },
  { label: 'SỐ PI', display: 'π', value: '$\\pi$' },
  { label: 'DELTA (Δ)', display: 'Δt', value: '$\\Delta t$' },
  { label: 'DAO ĐỘNG', display: 'x(t)', value: '$x = A\\cos(\\omega t + \\varphi)$' },
  { label: 'VẬN TỐC', display: 'v(x)', value: '$v = \\pm\\omega\\sqrt{A^2 - x^2}$' },
  { label: 'HỆ PHƯƠNG TRÌNH', display: '{', value: '$\\begin{cases} x =  \\\\ y =  \\end{cases}$' },
  { label: 'TỔNG (Σ)', display: 'Σ', value: '$\\sum_{i=1}^{n}$' },
  { label: 'TÍCH PHÂN (∫)', display: '∫', value: '$\\int_{a}^{b}$' },
  { label: 'GIỚI HẠN (LIM)', display: 'lim', value: '$\\lim_{x \\to \\infty}$' },
  { label: 'ĐƠN VỊ VẬN TỐC', display: 'm/s', value: '$\\text{m/s}$' },
];

const FONT_SIZES = [
  { label: 'XS (12PX)', value: '12px' },
  { label: 'SM (14PX)', value: '14px' },
  { label: 'REG (16PX)', value: '16px' },
  { label: 'LG (20PX)', value: '20px' },
  { label: 'XL (24PX)', value: '24px' },
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

interface RichMarkdownRendererProps {
  content: string;
  className?: string;
  isInverted?: boolean;
  onImageClick?: (url: string) => void;
}

const RichMarkdownRenderer: React.FC<RichMarkdownRendererProps> = ({
  content,
  className = '',
  isInverted = false
}) => {
  if (!content) return null;

  return (
    <div 
      className={`leading-relaxed whitespace-pre-line ${isInverted ? 'text-slate-100' : 'text-slate-800'} ${className}`}
      style={isInverted ? { color: '#f8fafc' } : undefined}
    >
      {renderLatex(content)}
    </div>
  );
};

interface VdcQuestionsPanelProps {
  isAdmin: boolean;
  selectedGrade: number | null;
  nodes: BookNode[];
  themeColor: string;
  onBackToLessons?: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, type?: 'danger' | 'warning' | 'info', confirmText?: string) => void;
}

export const VdcQuestionsPanel: React.FC<VdcQuestionsPanelProps> = ({
  isAdmin,
  selectedGrade,
  nodes,
  themeColor,
  onBackToLessons,
  showToast,
  showConfirm
}) => {
  const [questions, setQuestions] = useState<VdcQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'fallback'>('checking');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  
  // Quản lý sửa/xóa/thêm chương
  const [editingChapter, setEditingChapter] = useState<{ id: string; title: string } | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState('');
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Edit / Add modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<VdcQuestion | null>(null);
  const [modalForm, setModalForm] = useState<Partial<VdcQuestion>>({
    chapter_title: '',
    title: '',
    content: '',
    question_type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: 'A',
    solution: '',
    level: 'vdc',
    source: '',
    image_url: '',
    solution_image_url: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // States cho màn hình soạn thảo VDC lớn toàn màn hình 2 cột
  const [activeEditorField, setActiveEditorField] = useState<'content' | 'solution'>('content');
  const [editorLayoutMode, setEditorLayoutMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [mobileEditorTab, setMobileEditorTab] = useState<'edit' | 'preview'>('edit');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [previewStudentMode, setPreviewStudentMode] = useState(false);
  const [previewSelectedAnswer, setPreviewSelectedAnswer] = useState<string | null>(null);
  const [previewShowSolution, setPreviewShowSolution] = useState(false);

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const solutionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Hàm bọc định dạng văn bản cho trường đang hoạt động (Đề bài hoặc Lời giải)
  const wrapText = (tag: string, endTag?: string, targetOverride?: 'content' | 'solution') => {
    const target = targetOverride || activeEditorField;
    const targetRef = target === 'solution' ? solutionTextareaRef : contentTextareaRef;
    const currentVal = (target === 'solution' ? modalForm.solution : modalForm.content) || '';
    const textarea = targetRef.current;
    
    if (!textarea) {
      setModalForm(prev => ({
        ...prev,
        [target]: (prev[target] || '') + tag + (endTag || '')
      }));
      return;
    }
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentVal.substring(start, end);
    const before = currentVal.substring(0, start);
    const after = currentVal.substring(end);
    const newText = before + tag + selectedText + (endTag || '') + after;
    
    setModalForm(prev => ({
      ...prev,
      [target]: newText
    }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length + selectedText.length);
    }, 10);
  };

  const applyStyle = (property: string, value: string) => {
    wrapText(`<span style="${property}: ${value}">`, '</span>');
    setActiveDropdown(null);
  };

  // Chèn ảnh từ modal tải ảnh vào vị trí con trỏ của trường đang hoạt động
  const handleInsertImageSnippet = (snippet: string) => {
    const target = activeEditorField;
    const targetRef = target === 'solution' ? solutionTextareaRef : contentTextareaRef;
    const currentVal = (target === 'solution' ? modalForm.solution : modalForm.content) || '';
    const textarea = targetRef.current;
    
    if (!textarea) {
      setModalForm(prev => ({
        ...prev,
        [target]: (prev[target] || '') + '\n' + snippet + '\n'
      }));
      return;
    }
    
    const start = textarea.selectionStart ?? currentVal.length;
    const end = textarea.selectionEnd ?? currentVal.length;
    const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
    
    setModalForm(prev => ({
      ...prev,
      [target]: newVal
    }));
    
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + snippet.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 50);
  };

  // Hỗ trợ dán ảnh trực tiếp từ bộ nhớ tạm (Ctrl + V) và upload lên ImgBB
  const handleTextareaPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>, target: 'content' | 'solution') => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          showToast('Đang tự động tải ảnh dán từ clipboard (Ctrl+V) lên ImgBB...', 'info', 'Đang xử lý ảnh');
          try {
            const result = await uploadToImgBB(blob);
            const snippet = `\n\n![Ảnh dán](${result.url})\n\n`;
            
            const targetRef = target === 'solution' ? solutionTextareaRef : contentTextareaRef;
            const currentVal = (target === 'solution' ? modalForm.solution : modalForm.content) || '';
            const textarea = targetRef.current;
            
            if (!textarea) {
              setModalForm(prev => ({
                ...prev,
                [target]: (prev[target] || '') + snippet
              }));
            } else {
              const start = textarea.selectionStart ?? currentVal.length;
              const end = textarea.selectionEnd ?? currentVal.length;
              const newVal = currentVal.substring(0, start) + snippet + currentVal.substring(end);
              setModalForm(prev => ({ ...prev, [target]: newVal }));
              setTimeout(() => {
                textarea.focus();
                const newCursor = start + snippet.length;
                textarea.setSelectionRange(newCursor, newCursor);
              }, 50);
            }
            
            showToast('Đã tải và chèn ảnh dán thành công!', 'success');
          } catch (err: any) {
            showToast(err.message || 'Không thể tải ảnh dán lên ImgBB.', 'error');
          }
          break;
        }
      }
    }
  };

  // Preview Image Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // SQL Schema Modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const gradeId = (selectedGrade === 1 ? 11 : selectedGrade) || 11;

  // Thứ tự sắp xếp các chương do người dùng tùy chỉnh
  const [chapterOrder, setChapterOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`vdc_chapter_order_g${gradeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Danh sách các chương đã bị xóa (để không bị nạp lại từ node hoặc câu hỏi cũ)
  const [deletedChapters, setDeletedChapters] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`vdc_deleted_chapters_g${gradeId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State mở menu các chương trên thiết bị di động (iPhone / Tablet)
  const [isMobileChapterMenuOpen, setIsMobileChapterMenuOpen] = useState(false);

  // ĐỒNG BỘ ĐÁM MÂY SUPABASE: Tải cấu hình chương và thiết lập Realtime giữa các trình duyệt/thiết bị
  useEffect(() => {
    let isMounted = true;

    // 1. Tải từ localStorage trước để hiển thị tức thì
    try {
      const savedOrder = localStorage.getItem(`vdc_chapter_order_g${gradeId}`);
      if (savedOrder) setChapterOrder(JSON.parse(savedOrder));
      const savedDeleted = localStorage.getItem(`vdc_deleted_chapters_g${gradeId}`);
      if (savedDeleted) setDeletedChapters(JSON.parse(savedDeleted));
    } catch {}

    // 2. Luôn nạp dữ liệu chính xác nhất từ Supabase app_settings (ID: 8000 + gradeId)
    const fetchCloudSettings = async () => {
      try {
        const { data: vdcSettings, error: sErr } = await supabase
          .from('app_settings')
          .select('data')
          .eq('id', 8000 + gradeId)
          .maybeSingle();

        if (!sErr && vdcSettings?.data && isMounted) {
          const sData = vdcSettings.data as any;
          if (Array.isArray(sData.deleted_chapters)) {
            setDeletedChapters(sData.deleted_chapters);
            try {
              localStorage.setItem(`vdc_deleted_chapters_g${gradeId}`, JSON.stringify(sData.deleted_chapters));
            } catch {}
          }
          if (Array.isArray(sData.chapter_order)) {
            setChapterOrder(sData.chapter_order);
            try {
              localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(sData.chapter_order));
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Lỗi khi tải cấu hình VDC từ đám mây Supabase:", err);
      }
    };

    fetchCloudSettings();

    // 3. Đăng ký Supabase Realtime: Khi một trình duyệt xóa/sắp xếp chương, các trình duyệt khác tự cập nhật ngay
    const channel = supabase
      .channel(`vdc_sync_realtime_g${gradeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'app_settings',
        filter: `id=eq.${8000 + gradeId}`
      }, (payload: any) => {
        if (payload?.new?.data && isMounted) {
          const sData = payload.new.data as any;
          if (Array.isArray(sData.deleted_chapters)) {
            setDeletedChapters(sData.deleted_chapters);
            try {
              localStorage.setItem(`vdc_deleted_chapters_g${gradeId}`, JSON.stringify(sData.deleted_chapters));
            } catch {}
          }
          if (Array.isArray(sData.chapter_order)) {
            setChapterOrder(sData.chapter_order);
            try {
              localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(sData.chapter_order));
            } catch {}
          }
          if (Array.isArray(sData.questions) && sData.questions.length > 0) {
            setQuestions(sData.questions);
          }
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [gradeId]);

  // Khôi phục các chương đã ẩn khỏi VDC (lấy lại từ cấu trúc sách)
  const handleRestoreDeletedChapters = async () => {
    setDeletedChapters([]);
    try {
      localStorage.removeItem(`vdc_deleted_chapters_g${gradeId}`);
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: {
          questions,
          chapter_order: chapterOrder,
          deleted_chapters: [],
          updated_at: new Date().toISOString()
        }
      });
      showToast('Đã khôi phục các chương từ sách vào menu VDC thành công!', 'success');
    } catch (e) {
      console.warn("Lỗi khi khôi phục chương:", e);
    }
  };

  // Lấy danh sách các chương từ cấu trúc sách hiện tại và các chương tùy chỉnh
  const chaptersList = useMemo(() => {
    const list: { id: string; title: string; fromNode?: boolean }[] = [];
    const seen = new Set<string>();
    const deletedSet = new Set(deletedChapters.map(t => t.trim().toLowerCase()));

    // Hàm kiểm tra xem folder có phải là thư mục chứa sách (như Sách KNTT, Sách CTST) không
    const isBookContainer = (f: BookNode) => {
      if (f.parentId) return false;
      return (nodes || []).some(c => c.parentId === f.id && c.type === 'folder');
    };

    // 1. Lấy tất cả các thư mục/chương từ cấu trúc sách (cả folder gốc và các folder chương con bên trong sách KNTT/CTST)
    const orderedFolderNodes: BookNode[] = [];
    const addFolderTree = (pid: string | null | undefined) => {
      const children = (nodes || [])
        .filter(n => (pid ? n.parentId === pid : (!n.parentId || n.parentId === null || n.parentId === undefined)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      for (const c of children) {
        // Bỏ qua folder cấp sách lớn nếu nó chứa các chương con
        if (c.type === 'folder' && !isBookContainer(c)) {
          orderedFolderNodes.push(c);
        } else if (c.type === 'lesson') {
          // Nếu bài học có con hoặc tiêu đề bắt đầu bằng Chương/Chủ đề/Chuyên đề/Đề thi
          const hasChildren = (nodes || []).some(sub => sub.parentId === c.id);
          const tLower = c.title.trim().toLowerCase();
          if (hasChildren || tLower.startsWith('chương') || tLower.startsWith('chủ đề') || tLower.startsWith('chuyên đề') || tLower.startsWith('đề thi')) {
            orderedFolderNodes.push(c);
          }
        }
        addFolderTree(c.id);
      }
    };
    addFolderTree(null);

    // Bổ sung các folder nếu có parentId khác biệt
    (nodes || []).forEach(n => {
      if (n.type === 'folder' && !isBookContainer(n) && !orderedFolderNodes.some(o => o.id === n.id)) {
        orderedFolderNodes.push(n);
      }
    });

    // Thêm các folder từ sách vào list
    orderedFolderNodes.forEach(f => {
      const clean = f.title.trim();
      if (clean && !seen.has(clean.toLowerCase()) && !deletedSet.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        list.push({ id: f.id, title: clean, fromNode: true });
      }
    });

    // 2. Thêm các chương đã được tạo trực tiếp từ menu VDC (lưu trong chapterOrder)
    (chapterOrder || []).forEach((ordTitle, idx) => {
      const clean = (ordTitle || '').trim();
      if (clean && !seen.has(clean.toLowerCase()) && !deletedSet.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        list.push({ id: `vdc-custom-ch-${idx}-${clean}`, title: clean, fromNode: false });
      }
    });

    // 3. Thêm bất kỳ chương nào đã có trong danh sách câu hỏi
    questions.forEach(q => {
      const title = q.chapter_title?.trim();
      if (title && !seen.has(title.toLowerCase()) && !deletedSet.has(title.toLowerCase())) {
        seen.add(title.toLowerCase());
        list.push({ id: q.chapter_id || `custom-${title}`, title, fromNode: false });
      }
    });

    // 4. Sắp xếp danh sách chương theo chapterOrder nếu có (so sánh không phân biệt hoa thường)
    if (chapterOrder.length > 0) {
      const lowerOrder = chapterOrder.map(t => t.trim().toLowerCase());
      list.sort((a, b) => {
        const idxA = lowerOrder.indexOf(a.title.trim().toLowerCase());
        const idxB = lowerOrder.indexOf(b.title.trim().toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    return list;
  }, [nodes, questions, chapterOrder, deletedChapters]);

  // Di chuyển thứ tự chương lên hoặc xuống
  const handleReorderChapter = async (chapterTitle: string, direction: 'up' | 'down') => {
    const currentIndex = chaptersList.findIndex(c => c.title.trim().toLowerCase() === chapterTitle.trim().toLowerCase());
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= chaptersList.length) return;

    const newOrderedTitles = chaptersList.map(c => c.title.trim());
    const temp = newOrderedTitles[currentIndex];
    newOrderedTitles[currentIndex] = newOrderedTitles[targetIndex];
    newOrderedTitles[targetIndex] = temp;

    setChapterOrder(newOrderedTitles);
    try {
      localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(newOrderedTitles));
      // Lưu vào Supabase fallback app_settings
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: {
          questions,
          chapter_order: newOrderedTitles,
          deleted_chapters: deletedChapters,
          updated_at: new Date().toISOString()
        }
      });
      showToast(`Đã chuyển chương "${chapterTitle}" ${direction === 'up' ? 'lên' : 'xuống'} thành công!`, 'success');
    } catch (e) {
      console.warn("Lỗi khi lưu thứ tự chương:", e);
    }
  };

  // Xóa chương khỏi menu VDC
  const handleDeleteChapter = (ch: { id: string; title: string; fromNode?: boolean }, count: number) => {
    showConfirm(
      "Xác nhận xóa chương khỏi kho VDC",
      count > 0 
        ? `Chương "${ch.title}" đang có ${count} câu hỏi VDC. Thầy/cô có chắc chắn muốn xóa chương này khỏi kho VDC và toàn bộ ${count} câu hỏi bên trong không?\n\n(LƯU Ý: Thao tác này chỉ xóa câu hỏi trong kho VDC, hoàn toàn KHÔNG làm mất chương hay bài học bên ngoài cấu trúc sách ở menu bên trái!)`
        : `Thầy/cô có chắc chắn muốn xóa/ẩn chương "${ch.title}" khỏi menu kho VDC không?\n\n(LƯU Ý: Thao tác này hoàn toàn KHÔNG ảnh hưởng hay làm mất menu bài học bên ngoài màn hình chính!)`,
      async () => {
        try {
          const lowerTitle = ch.title.trim().toLowerCase();

          // 1. Xóa các câu hỏi VDC thuộc chương này
          const remainingQuestions = questions.filter(
            q => q.chapter_title?.trim().toLowerCase() !== lowerTitle && q.chapter_id !== ch.id
          );
          setQuestions(remainingQuestions);

          // 2. Xóa câu hỏi trên Supabase
          if (dbStatus === 'connected') {
            await supabase.from('vdc_questions').delete().eq('grade_id', gradeId).ilike('chapter_title', ch.title.trim());
          }

          // 3. Cập nhật danh sách deletedChapters để loại bỏ khỏi menu VDC vĩnh viễn
          const updatedDeleted = Array.from(new Set([...deletedChapters, ch.title.trim()]));
          setDeletedChapters(updatedDeleted);
          localStorage.setItem(`vdc_deleted_chapters_g${gradeId}`, JSON.stringify(updatedDeleted));

          // 4. Cập nhật chapterOrder
          const updatedOrder = chapterOrder.filter(t => t.trim().toLowerCase() !== lowerTitle);
          setChapterOrder(updatedOrder);
          localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(updatedOrder));

          // 5. Cập nhật backup vào app_settings VDC (ID 8000 + gradeId)
          await supabase.from('app_settings').upsert({
            id: 8000 + gradeId,
            data: {
              questions: remainingQuestions,
              chapter_order: updatedOrder,
              deleted_chapters: updatedDeleted,
              updated_at: new Date().toISOString()
            }
          });

          // 6. Nếu đang chọn chương này thì chuyển về 'all'
          if (selectedChapter === ch.title || selectedChapter === ch.id) {
            setSelectedChapter('all');
            setCurrentPage(1);
          }

          showToast(`Đã xóa chương "${ch.title}" khỏi kho VDC thành công!`, 'success');
        } catch (err: any) {
          console.error("Lỗi khi xóa chương:", err);
          showToast(`Lỗi khi xóa chương: ${err.message || 'Không xác định'}`, 'error');
        }
      },
      'danger',
      'Xóa khỏi VDC'
    );
  };

  // Lưu thay đổi tên chương trong kho VDC
  const handleSaveEditChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter || !editChapterTitle.trim()) return;

    const oldTitle = editingChapter.title.trim();
    const newTitle = editChapterTitle.trim();
    if (oldTitle === newTitle) {
      setEditingChapter(null);
      return;
    }

    try {
      const oldLower = oldTitle.toLowerCase();

      // 1. Cập nhật tất cả câu hỏi VDC có chapter_title cũ
      const updatedQuestions = questions.map(q => 
        q.chapter_title?.trim().toLowerCase() === oldLower || q.chapter_id === editingChapter.id
          ? { ...q, chapter_title: newTitle }
          : q
      );
      setQuestions(updatedQuestions);

      // 2. Cập nhật trong Supabase
      if (dbStatus === 'connected') {
        await supabase
          .from('vdc_questions')
          .update({ chapter_title: newTitle })
          .eq('grade_id', gradeId)
          .ilike('chapter_title', oldTitle);
      }

      // 3. Cập nhật chapterOrder
      const updatedOrder = chapterOrder.map(t => t.trim().toLowerCase() === oldLower ? newTitle : t);
      if (!updatedOrder.includes(newTitle)) updatedOrder.push(newTitle);
      setChapterOrder(updatedOrder);
      localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(updatedOrder));

      // 4. Cập nhật app_settings fallback cho VDC
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: {
          questions: updatedQuestions,
          chapter_order: updatedOrder,
          deleted_chapters: deletedChapters,
          updated_at: new Date().toISOString()
        }
      });

      // 5. Cập nhật selectedChapter nếu đang chọn chương này
      if (selectedChapter === oldTitle || selectedChapter === editingChapter.id) {
        setSelectedChapter(newTitle);
      }

      setEditingChapter(null);
      showToast(`Đã đổi tên chương thành "${newTitle}" thành công!`, 'success');
    } catch (err: any) {
      console.error("Lỗi khi sửa tên chương:", err);
      showToast(`Lỗi khi sửa tên chương: ${err.message || 'Không xác định'}`, 'error');
    }
  };

  // Thêm chương mới vào kho VDC
  const handleSaveAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim()) return;

    const titleToAdd = newChapterTitle.trim();

    try {
      // 1. Bỏ khỏi deletedChapters nếu trước đó từng bị xóa
      const updatedDeleted = deletedChapters.filter(t => t.trim().toLowerCase() !== titleToAdd.toLowerCase());
      setDeletedChapters(updatedDeleted);
      localStorage.setItem(`vdc_deleted_chapters_g${gradeId}`, JSON.stringify(updatedDeleted));

      // 2. Thêm vào chapterOrder
      const updatedOrder = [...chapterOrder.filter(t => t.trim().toLowerCase() !== titleToAdd.toLowerCase()), titleToAdd];
      setChapterOrder(updatedOrder);
      localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(updatedOrder));

      // 3. Đồng bộ lên Supabase app_settings (ID: 8000 + gradeId) để các thiết bị / trình duyệt khác thấy ngay
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: {
          questions,
          chapter_order: updatedOrder,
          deleted_chapters: updatedDeleted,
          updated_at: new Date().toISOString()
        }
      });

      // 4. Chọn ngay chương vừa thêm
      setSelectedChapter(titleToAdd);
      setShowAddChapterModal(false);
      setNewChapterTitle('');

      showToast(`Đã thêm chương "${titleToAdd}" vào kho VDC thành công!`, 'success');
    } catch (err: any) {
      console.error("Lỗi khi thêm chương:", err);
      showToast(`Lỗi khi thêm chương: ${err.message || 'Không xác định'}`, 'error');
    }
  };

  // Tải danh sách câu hỏi & cấu hình Menu chương từ Supabase
  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let loadedQuestions: VdcQuestion[] = [];

      // 1. Luôn tải cấu hình VDC (danh sách chương đã xóa/ẩn, thứ tự chương) từ Supabase app_settings (8000 + gradeId)
      try {
        const { data: vdcSettings, error: sErr } = await supabase
          .from('app_settings')
          .select('data')
          .eq('id', 8000 + gradeId)
          .maybeSingle();

        if (!sErr && vdcSettings?.data) {
          const sData = vdcSettings.data as any;
          if (Array.isArray(sData.deleted_chapters)) {
            setDeletedChapters(sData.deleted_chapters);
            try {
              localStorage.setItem(`vdc_deleted_chapters_g${gradeId}`, JSON.stringify(sData.deleted_chapters));
            } catch {}
          }
          if (Array.isArray(sData.chapter_order)) {
            setChapterOrder(sData.chapter_order);
            try {
              localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(sData.chapter_order));
            } catch {}
          }
          if (Array.isArray(sData.questions) && sData.questions.length > 0) {
            loadedQuestions = sData.questions;
          }
        }
      } catch (settingsErr) {
        console.warn("Lỗi khi tải app_settings VDC:", settingsErr);
      }

      // 2. Thử truy vấn bảng vdc_questions
      const { data: dbData, error } = await supabase
        .from('vdc_questions')
        .select('*')
        .eq('grade_id', gradeId)
        .order('order_num', { ascending: true })
        .order('created_at', { ascending: false });

      if (!error && dbData && dbData.length > 0) {
        setDbStatus('connected');
        setQuestions(dbData as VdcQuestion[]);
      } else if (!error && dbData) {
        setDbStatus('connected');
        if (loadedQuestions.length > 0) {
          setQuestions(loadedQuestions);
        } else {
          setQuestions(SAMPLE_VDC_QUESTIONS.filter(q => q.grade_id === gradeId));
        }
      } else {
        // Lỗi (chưa tạo bảng vdc_questions trên Supabase) -> Dùng Fallback
        setDbStatus('fallback');
        if (loadedQuestions.length > 0) {
          setQuestions(loadedQuestions);
        } else {
          setQuestions(SAMPLE_VDC_QUESTIONS.filter(q => q.grade_id === gradeId));
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải câu hỏi VDC:", err);
      setDbStatus('fallback');
      setQuestions(prev => {
        if (prev && prev.length > 0) return prev;
        return SAMPLE_VDC_QUESTIONS.filter(q => q.grade_id === gradeId);
      });
    } finally {
      setLoading(false);
    }
  }, [gradeId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Bộ lọc danh sách câu hỏi
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Lọc theo chương
      if (selectedChapter !== 'all') {
        const matchesChapter = q.chapter_title?.trim().toLowerCase() === selectedChapter.trim().toLowerCase() ||
                               q.chapter_id === selectedChapter;
        if (!matchesChapter) return false;
      }

      // Lọc theo cấp độ
      if (filterLevel !== 'all' && q.level !== filterLevel) {
        return false;
      }

      // Lọc theo từ khóa tìm kiếm
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const inTitle = q.title?.toLowerCase().includes(term);
        const inContent = q.content?.toLowerCase().includes(term);
        const inSolution = q.solution?.toLowerCase().includes(term);
        const inSource = q.source?.toLowerCase().includes(term);
        const inChapter = q.chapter_title?.toLowerCase().includes(term);
        if (!inTitle && !inContent && !inSolution && !inSource && !inChapter) return false;
      }

      return true;
    });
  }, [questions, selectedChapter, filterLevel, searchTerm]);

  // Phân trang
  const totalPages = Math.ceil(filteredQuestions.length / pageSize) || 1;
  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredQuestions.slice(startIndex, startIndex + pageSize);
  }, [filteredQuestions, currentPage, pageSize]);

  // Đổi trang nếu currentPage vượt quá totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Đếm số câu theo từng chương
  const countByChapter = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      const key = q.chapter_title?.trim().toLowerCase();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [questions]);

  // Bật/tắt mở lời giải
  const toggleSolution = (id: string) => {
    setExpandedSolutions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAllSolutions = () => {
    const next: Record<string, boolean> = {};
    filteredQuestions.forEach(q => { next[q.id] = true; });
    setExpandedSolutions(next);
  };

  const collapseAllSolutions = () => {
    setExpandedSolutions({});
  };

  // Mở form thêm mới
  const handleAddNew = () => {
    const defaultChapter = selectedChapter !== 'all' 
      ? (chaptersList.find(c => c.id === selectedChapter || c.title === selectedChapter)?.title || '')
      : (chaptersList[0]?.title || 'Chương 1');

    setEditingQuestion(null);
    setModalForm({
      chapter_title: defaultChapter,
      title: '',
      content: '',
      question_type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: 'A',
      solution: '',
      level: 'vdc',
      source: '',
      image_url: '',
      solution_image_url: '',
      order_num: questions.length + 1
    });
    setActiveEditorField('content');
    setEditorLayoutMode('split');
    setMobileEditorTab('edit');
    setPreviewStudentMode(false);
    setPreviewSelectedAnswer(null);
    setPreviewShowSolution(false);
    setShowMathDialog(false);
    setActiveDropdown(null);
    setShowQuestionModal(true);
  };

  // Mở form chỉnh sửa
  const handleEdit = (q: VdcQuestion) => {
    setEditingQuestion(q);
    setModalForm({
      ...q,
      options: q.options && q.options.length > 0 ? [...q.options] : ['', '', '', '']
    });
    setActiveEditorField('content');
    setEditorLayoutMode('split');
    setMobileEditorTab('edit');
    setPreviewStudentMode(false);
    setPreviewSelectedAnswer(null);
    setPreviewShowSolution(false);
    setShowMathDialog(false);
    setActiveDropdown(null);
    setShowQuestionModal(true);
  };

  // Xóa câu hỏi
  const handleDelete = (id: string) => {
    showConfirm(
      'Xóa câu hỏi VDC',
      'Bạn có chắc chắn muốn xóa câu hỏi này khỏi kho VDC không?',
      async () => {
        try {
          if (dbStatus === 'connected') {
            const { error } = await supabase.from('vdc_questions').delete().eq('id', id);
            if (error) throw error;
          }
          const nextList = questions.filter(q => q.id !== id);
          setQuestions(nextList);

          // Cập nhật bản sao lưu fallback (bảo toàn thứ tự và các chương tùy chỉnh)
          await supabase.from('app_settings').upsert({
            id: 8000 + gradeId,
            data: { 
              questions: nextList, 
              chapter_order: chapterOrder,
              deleted_chapters: deletedChapters,
              updated_at: new Date().toISOString() 
            }
          });

          showToast('Đã xóa câu hỏi thành công!', 'success');
        } catch (err: any) {
          showToast('Lỗi khi xóa câu hỏi: ' + (err.message || 'Không xác định'), 'error');
        }
      },
      'danger',
      'Xóa ngay'
    );
  };

  // Lưu câu hỏi (Thêm mới hoặc Cập nhật)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.content?.trim()) {
      showToast('Vui lòng nhập nội dung đề bài câu hỏi!', 'warning');
      return;
    }
    if (!modalForm.chapter_title?.trim()) {
      showToast('Vui lòng chọn hoặc nhập tên chương!', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const cleanOptions = modalForm.question_type === 'multiple_choice' 
        ? (modalForm.options || []).map((opt, i) => {
            const prefix = ['A', 'B', 'C', 'D'][i] + '. ';
            let text = opt.trim();
            if (text.startsWith('A.') || text.startsWith('B.') || text.startsWith('C.') || text.startsWith('D.')) {
              return text;
            }
            return text ? `${prefix}${text}` : '';
          })
        : [];

      const newOrUpdated: VdcQuestion = {
        id: editingQuestion ? editingQuestion.id : `vdc-${gradeId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        grade_id: gradeId,
        chapter_title: modalForm.chapter_title.trim(),
        chapter_id: chaptersList.find(c => c.title.trim().toLowerCase() === modalForm.chapter_title?.trim().toLowerCase())?.id || `ch-${Date.now()}`,
        title: modalForm.title?.trim() || '',
        content: modalForm.content.trim(),
        image_url: modalForm.image_url?.trim() || '',
        question_type: modalForm.question_type || 'multiple_choice',
        options: cleanOptions,
        correct_answer: modalForm.correct_answer || 'A',
        solution: modalForm.solution?.trim() || '',
        solution_image_url: modalForm.solution_image_url?.trim() || '',
        level: modalForm.level || 'vdc',
        source: modalForm.source?.trim() || '',
        order_num: modalForm.order_num || 0,
        updated_at: new Date().toISOString(),
        created_at: editingQuestion?.created_at || new Date().toISOString()
      };

      // 1. Thử lưu vào bảng vdc_questions trên Supabase
      if (dbStatus === 'connected') {
        const { error } = await supabase.from('vdc_questions').upsert(newOrUpdated);
        if (error) {
          console.warn("Lưu vào vdc_questions gặp lỗi, chuyển sang fallback:", error);
          setDbStatus('fallback');
        }
      }

      // 2. Cập nhật state nội bộ
      let nextQuestions: VdcQuestion[];
      if (editingQuestion) {
        nextQuestions = questions.map(q => q.id === newOrUpdated.id ? newOrUpdated : q);
      } else {
        nextQuestions = [newOrUpdated, ...questions];
      }
      setQuestions(nextQuestions);

      // 3. Luôn lưu một bản vào fallback app_settings để đảm bảo an toàn 100% (bảo toàn thứ tự chương và chương tùy chỉnh)
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: { 
          questions: nextQuestions, 
          chapter_order: chapterOrder,
          deleted_chapters: deletedChapters,
          updated_at: new Date().toISOString() 
        }
      });

      setShowQuestionModal(false);
      showToast(editingQuestion ? 'Đã cập nhật câu hỏi thành công!' : 'Đã thêm câu hỏi VDC mới thành công!', 'success');
    } catch (err: any) {
      console.error("Lỗi khi lưu câu hỏi:", err);
      showToast('Lỗi khi lưu câu hỏi: ' + (err.message || 'Không xác định'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Upload hình ảnh câu hỏi hoặc hình ảnh lời giải (Ưu tiên ImgBB)
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, target: 'image_url' | 'solution_image_url') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      // 1. Ưu tiên số 1: Tải lên ImgBB qua uploadToImgBB
      const imgbbRes = await uploadToImgBB(file);
      if (imgbbRes && imgbbRes.url) {
        setModalForm(prev => ({ ...prev, [target]: imgbbRes.url }));
        showToast('Đã tải ảnh lên ImgBB thành công!', 'success');
        setIsUploadingImage(false);
        e.target.value = '';
        return;
      }
    } catch (imgbbErr: any) {
      console.warn("Tải lên ImgBB gặp sự cố, tự động dùng bộ nhớ dự phòng:", imgbbErr);
      
      // 2. Dự phòng 1: Supabase Storage
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `vdc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const filePath = `vdc/${fileName}`;
        const { error: upErr } = await supabase.storage.from('resources').upload(filePath, file);
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(filePath);
          setModalForm(prev => ({ ...prev, [target]: publicUrl }));
          showToast('Đã tải ảnh lên bộ nhớ dự phòng thành công!', 'success');
          setIsUploadingImage(false);
          e.target.value = '';
          return;
        }
      } catch (sbErr) {}

      // 3. Dự phòng 2: Google Drive
      try {
        if (!getDriveAccessToken()) {
          await signInWithGoogleForDrive();
        }
        const res = await uploadFileToGoogleDrive(file);
        setModalForm(prev => ({ ...prev, [target]: res.previewUrl }));
        showToast('Đã tải ảnh lên Google Drive thành công!', 'success');
      } catch (driveErr: any) {
        showToast('Không thể tải ảnh: ' + (imgbbErr.message || 'Kiểm tra đường truyền'), 'error');
      }
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // Sao chép nội dung câu hỏi và lời giải
  const handleCopyQuestion = (q: VdcQuestion) => {
    let text = `【${q.level === 'vdc' ? 'VẬN DỤNG CAO' : q.level === 'hay_suutam' ? 'CÂU HAY SƯU TẦM' : 'ĐỀ THI CHUYÊN'}】 - ${q.chapter_title}\n`;
    if (q.title) text += `Chủ đề: ${q.title}\n`;
    if (q.source) text += `Nguồn: ${q.source}\n`;
    text += `\nĐề bài:\n${q.content}\n`;

    if (q.question_type === 'multiple_choice' && q.options && q.options.length > 0) {
      text += `\nCác phương án:\n${q.options.filter(Boolean).join('\n')}\n`;
      text += `\nĐáp án đúng: ${q.correct_answer}\n`;
    }

    if (q.solution) {
      text += `\nLời giải chi tiết:\n${q.solution}\n`;
    }

    navigator.clipboard.writeText(text);
    showToast('Đã sao chép nội dung câu hỏi & lời giải vào Clipboard!', 'success');
  };

  // Script SQL để tạo bảng vdc_questions trên Supabase
  const SQL_SCRIPT = `-- ========================================================
-- TẠO BẢNG CHUYÊN BIỆT: CÂU HỎI VDC & SƯU TẦM (vdc_questions)
-- Hãy sao chép toàn bộ mã này vào Supabase -> SQL Editor -> Run
-- ========================================================

CREATE TABLE IF NOT EXISTS public.vdc_questions (
  id TEXT PRIMARY KEY,
  grade_id INTEGER NOT NULL DEFAULT 11,
  chapter_id TEXT,
  chapter_title TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  question_type TEXT DEFAULT 'multiple_choice',
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  solution TEXT,
  solution_image_url TEXT,
  level TEXT DEFAULT 'vdc',
  source TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật tính năng Row Level Security
ALTER TABLE public.vdc_questions ENABLE ROW LEVEL SECURITY;

-- Cấp quyền Đọc công khai cho Học sinh & Khách
CREATE POLICY "Cho phép đọc công khai vdc_questions" 
ON public.vdc_questions FOR SELECT USING (true);

-- Cấp quyền Thêm mới cho Giáo viên
CREATE POLICY "Cho phép ghi vdc_questions" 
ON public.vdc_questions FOR INSERT WITH CHECK (true);

-- Cấp quyền Cập nhật
CREATE POLICY "Cho phép sửa vdc_questions" 
ON public.vdc_questions FOR UPDATE USING (true);

-- Cấp quyền Xóa
CREATE POLICY "Cho phép xóa vdc_questions" 
ON public.vdc_questions FOR DELETE USING (true);
`;

  const copySqlCode = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
    showToast('Đã sao chép mã SQL! Hãy dán vào mục SQL Editor trên Supabase.', 'success');
  };

  // Helper format level badge
  const renderLevelBadge = (level: string) => {
    switch (level) {
      case 'vdc':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <Sparkles size={11} className="text-rose-500 fill-rose-500" /> Vận Dụng Cao 9+
          </span>
        );
      case 'hay_suutam':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-amber-50 text-amber-800 border border-amber-200 shadow-sm">
            <Sparkles size={11} className="text-amber-500 fill-amber-500" /> Câu Hay Sưu Tầm
          </span>
        );
      case 'de_thi_thu':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
            <BookOpen size={11} className="text-indigo-500" /> Đề Thi Chuyên
          </span>
        );
      case 'phuong_phap_la':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-purple-50 text-purple-700 border border-purple-200 shadow-sm">
            <Layers size={11} className="text-purple-500" /> Phương Pháp Lạ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-slate-100 text-slate-700">
            Nâng Cao
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/60 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER BANNER */}
      <header className="px-6 py-4 bg-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          {onBackToLessons && (
            <button
              onClick={onBackToLessons}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
              title="Quay lại bài học trong sách"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Quay lại bài học</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
            <Sparkles size={20} className="fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                Kho Câu Hỏi VDC & Tuyển Tập Hay
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-extrabold uppercase">
                Lớp {gradeId}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Tuyển chọn câu hỏi phân hóa điểm 9 - 10, phương pháp giải độc đáo và bài tập bồi dưỡng học sinh giỏi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Nút CSDL Supabase */}
          <button
            onClick={() => setShowSqlModal(true)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              dbStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
            title="Xem trạng thái lưu trữ CSDL Supabase"
          >
            <Database size={14} className={dbStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'} />
            <span className="hidden sm:inline">
              {dbStatus === 'connected' ? 'CSDL Supabase: Đã kết nối' : 'CSDL Supabase (Xem mã SQL)'}
            </span>
          </button>

          {/* Nút Thêm câu hỏi (Chỉ Giáo viên) */}
          {isAdmin && (
            <button
              onClick={handleAddNew}
              className={`px-4 py-2 bg-gradient-to-r from-${themeColor}-600 to-indigo-700 hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-indigo-200 flex items-center gap-2 transition-all hover:scale-[1.02]`}
            >
              <Plus size={16} />
              <span>Đưa lên câu mới</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN LAYOUT: SIDEBAR CHƯƠNG + CONTENT VÙNG CÂU HỎI */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* PANEL TRÁI: DANH SÁCH MENU CÁC CHƯƠNG (Hiển thị trên Desktop md+) */}
        <aside className="hidden md:flex md:w-64 lg:w-72 bg-white border-r border-slate-200/80 flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Folder size={13} className="text-amber-500" /> Menu các chương
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => { setNewChapterTitle(''); setShowAddChapterModal(true); }}
                  className="flex items-center gap-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black transition-all shadow-xs active:scale-95"
                  title="Thêm chương mới"
                >
                  <Plus size={11} strokeWidth={3} /> Thêm
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Chọn chương để xem hoặc bấm ▲/▼, Sửa, Xóa</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {/* Lựa chọn: Tất cả các chương */}
            <button
              onClick={() => { setSelectedChapter('all'); setCurrentPage(1); }}
              className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between group ${
                selectedChapter === 'all'
                  ? `bg-${themeColor}-600 text-white shadow-md shadow-${themeColor}-200`
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Sparkles size={15} className={selectedChapter === 'all' ? 'text-amber-300' : 'text-slate-400 group-hover:text-amber-500'} />
                <span className="truncate">Tất cả các chương</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedChapter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                }`}
              >
                {questions.length}
              </span>
            </button>

            {/* Danh sách từng chương kèm nút mũi tên lên / xuống để sắp xếp */}
            {chaptersList.map((ch, idx) => {
              const count = countByChapter[ch.title.trim().toLowerCase()] || 0;
              const isSelected = selectedChapter === ch.title || selectedChapter === ch.id;
              const isFirst = idx === 0;
              const isLast = idx === chaptersList.length - 1;

              return (
                <div
                  key={ch.id}
                  className={`group relative w-full rounded-2xl transition-all flex items-center justify-between p-1 ${
                    isSelected
                      ? `bg-${themeColor}-600 text-white shadow-md shadow-${themeColor}-200`
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <button
                    onClick={() => { setSelectedChapter(ch.title); setCurrentPage(1); }}
                    className="flex-1 text-left px-2.5 py-2 flex items-center justify-between min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <BookOpen size={14} className={isSelected ? 'text-amber-300 shrink-0' : 'text-slate-400 group-hover:text-indigo-600 shrink-0'} />
                      <span className="truncate text-xs font-bold">{ch.title}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 mr-1 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                      }`}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Nút thao tác: Lên, Xuống, Sửa, Xóa */}
                  <div className="flex items-center gap-0.5 shrink-0 pr-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderChapter(ch.title, 'up');
                      }}
                      className={`p-1 rounded-lg transition-all ${
                        isFirst
                          ? 'opacity-20 cursor-not-allowed text-slate-300'
                          : isSelected
                            ? 'text-white hover:bg-white/20 active:scale-90'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200 active:scale-90'
                      }`}
                      title={isFirst ? "Đang ở vị trí đầu" : "Di chuyển chương lên trên"}
                    >
                      <ArrowUp size={12} strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderChapter(ch.title, 'down');
                      }}
                      className={`p-1 rounded-lg transition-all ${
                        isLast
                          ? 'opacity-20 cursor-not-allowed text-slate-300'
                          : isSelected
                            ? 'text-white hover:bg-white/20 active:scale-90'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200 active:scale-90'
                      }`}
                      title={isLast ? "Đang ở vị trí cuối" : "Di chuyển chương xuống dưới"}
                    >
                      <ArrowDown size={12} strokeWidth={2.5} />
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChapter(ch);
                            setEditChapterTitle(ch.title);
                          }}
                          className={`p-1 rounded-lg transition-all ${
                            isSelected
                              ? 'text-white hover:bg-white/20 active:scale-90'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 active:scale-90'
                          }`}
                          title="Chỉnh sửa tên chương này"
                        >
                          <Pencil size={11} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChapter(ch, count);
                          }}
                          className={`p-1 rounded-lg transition-all ${
                            isSelected
                              ? 'text-rose-200 hover:text-white hover:bg-rose-500 active:scale-90'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-90'
                          }`}
                          title="Xóa chương này"
                        >
                          <Trash2 size={11} strokeWidth={2.5} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chân trang thông tin bên menu */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 space-y-2">
            <div className="flex items-center justify-between">
              <span>Tổng cộng: <b>{questions.length} câu</b></span>
              <button
                onClick={loadQuestions}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            {deletedChapters.length > 0 && (
              <button
                type="button"
                onClick={handleRestoreDeletedChapters}
                className="w-full text-center text-[10px] text-indigo-600 hover:text-indigo-800 font-bold p-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-100 transition-all flex items-center justify-center gap-1.5"
                title="Bấm để hiển thị lại các chương từ sách đã từng bị ẩn khỏi VDC"
              >
                <RotateCcw size={11} /> Khôi phục {deletedChapters.length} chương đã ẩn
              </button>
            )}
          </div>
        </aside>

        {/* MOBILE DRAWER: MENU CÁC CHƯƠNG TRÊN IPHONE / MOBILE (< md) */}
        {isMobileChapterMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div 
              onClick={() => setIsMobileChapterMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
            />
            {/* Drawer Sheet */}
            <div className="relative z-10 w-72 sm:w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder size={16} className="text-amber-500 fill-amber-500" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Menu các chương
                  </h2>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setNewChapterTitle(''); setShowAddChapterModal(true); }}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 shadow-xs"
                    >
                      <Plus size={11} strokeWidth={3} /> Thêm
                    </button>
                  )}
                  <button
                    onClick={() => setIsMobileChapterMenuOpen(false)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {/* Tất cả các chương */}
                <button
                  onClick={() => { setSelectedChapter('all'); setCurrentPage(1); setIsMobileChapterMenuOpen(false); }}
                  className={`w-full text-left px-3.5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${
                    selectedChapter === 'all'
                      ? `bg-${themeColor}-600 text-white shadow-md shadow-${themeColor}-200`
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Sparkles size={15} className={selectedChapter === 'all' ? 'text-amber-300' : 'text-slate-400'} />
                    <span className="truncate">Tất cả các chương</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${selectedChapter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {questions.length}
                  </span>
                </button>

                {/* Danh sách từng chương */}
                {chaptersList.map((ch, idx) => {
                  const count = countByChapter[ch.title.trim().toLowerCase()] || 0;
                  const isSelected = selectedChapter === ch.title || selectedChapter === ch.id;
                  const isFirst = idx === 0;
                  const isLast = idx === chaptersList.length - 1;

                  return (
                    <div
                      key={ch.id}
                      className={`relative w-full rounded-2xl transition-all flex items-center justify-between p-1 ${
                        isSelected
                          ? `bg-${themeColor}-600 text-white shadow-md shadow-${themeColor}-200`
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <button
                        onClick={() => { setSelectedChapter(ch.title); setCurrentPage(1); setIsMobileChapterMenuOpen(false); }}
                        className="flex-1 text-left px-2.5 py-2 flex items-center justify-between min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          <BookOpen size={14} className={isSelected ? 'text-amber-300 shrink-0' : 'text-slate-400 shrink-0'} />
                          <span className="truncate text-xs font-bold">{ch.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 mr-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {count}
                        </span>
                      </button>

                      {/* Các nút mũi tên ▲ ▼ và Sửa, Xóa */}
                      <div className="flex items-center gap-0.5 shrink-0 pr-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={(e) => { e.stopPropagation(); handleReorderChapter(ch.title, 'up'); }}
                          className={`p-1.5 rounded-lg ${isFirst ? 'opacity-20 cursor-not-allowed' : isSelected ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-200'}`}
                          title="Lên trên"
                        >
                          <ArrowUp size={13} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={(e) => { e.stopPropagation(); handleReorderChapter(ch.title, 'down'); }}
                          className={`p-1.5 rounded-lg ${isLast ? 'opacity-20 cursor-not-allowed' : isSelected ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-200'}`}
                          title="Xuống dưới"
                        >
                          <ArrowDown size={13} strokeWidth={2.5} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChapter(ch);
                                setEditChapterTitle(ch.title);
                              }}
                              className={`p-1.5 rounded-lg ${isSelected ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'}`}
                              title="Sửa"
                            >
                              <Pencil size={12} strokeWidth={2.5} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteChapter(ch, count);
                              }}
                              className={`p-1.5 rounded-lg ${isSelected ? 'text-rose-200 hover:text-white hover:bg-rose-500' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`}
                              title="Xóa"
                            >
                              <Trash2 size={12} strokeWidth={2.5} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Tổng cộng: <b>{questions.length} câu</b></span>
                  <button onClick={loadQuestions} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
                {deletedChapters.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreDeletedChapters}
                    className="w-full text-center text-[10px] text-indigo-600 font-bold p-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={11} /> Khôi phục {deletedChapters.length} chương đã ẩn
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PANEL PHẢI: HIỂN THỊ CÂU HỎI VÀ BÀI GIẢI */}
        <main className="flex-1 w-full min-w-0 flex flex-col overflow-hidden bg-slate-50/70">
          {/* THANH CHỌN CHƯƠNG TRÊN MOBILE (< md) */}
          <div className="md:hidden px-3 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileChapterMenuOpen(true)}
              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                selectedChapter === 'all'
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : `bg-${themeColor}-50 border-${themeColor}-200 text-${themeColor}-800`
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Folder size={14} className={selectedChapter === 'all' ? 'text-amber-500 fill-amber-500' : `text-${themeColor}-600 fill-${themeColor}-600`} />
                <span className="truncate">
                  {selectedChapter === 'all' ? 'Tất cả các chương' : selectedChapter}
                </span>
              </div>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-white shadow-xs ml-1 shrink-0 text-slate-600">
                {filteredQuestions.length} câu ▾
              </span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleAddNew}
                className={`px-3 py-2 bg-gradient-to-r from-${themeColor}-600 to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 shrink-0`}
              >
                <Plus size={14} /> Thêm câu
              </button>
            )}
          </div>
          {/* Thanh công cụ tìm kiếm và lọc */}
          <div className="p-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Ô tìm kiếm */}
            <div className="flex-1 relative max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Tìm kiếm theo từ khóa câu hỏi, lời giải, nguồn..."
                className="w-full pl-10 pr-9 py-2 bg-slate-100 border border-transparent focus:border-indigo-400 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Bộ lọc loại câu + Phím mở/thu gọn giải */}
            <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <Filter size={12} className="text-slate-400 ml-1.5 mr-0.5" />
                <select
                  value={filterLevel}
                  onChange={e => { setFilterLevel(e.target.value); setCurrentPage(1); }}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none pr-2 py-1 cursor-pointer"
                >
                  <option value="all">Tất cả mức độ</option>
                  <option value="vdc">⚡ Vận Dụng Cao 9+</option>
                  <option value="hay_suutam">🌟 Câu Hay Sưu Tầm</option>
                  <option value="de_thi_thu">🎯 Đề Thi Chuyên</option>
                  <option value="phuong_phap_la">💡 Phương Pháp Lạ</option>
                </select>
              </div>

              {/* Phím mở/thu gọn tất cả lời giải */}
              <div className="flex items-center gap-1">
                <button
                  onClick={expandAllSolutions}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1"
                  title="Mở tất cả lời giải để đối chiếu"
                >
                  <Eye size={12} /> <span className="hidden md:inline">Mở giải</span>
                </button>
                <button
                  onClick={collapseAllSolutions}
                  className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  title="Thu gọn toàn bộ lời giải"
                >
                  <EyeOff size={12} /> <span className="hidden md:inline">Ẩn giải</span>
                </button>
              </div>
            </div>
          </div>

          {/* VÙNG DANH SÁCH CÂU HỎI VÀ LỜI GIẢI */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {/* Thanh tiêu đề chương hiện tại */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full bg-${themeColor}-600`}></span>
                  {selectedChapter === 'all' ? 'Tất cả các chương' : selectedChapter}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Hiển thị <b>{filteredQuestions.length}</b> câu hỏi phù hợp
                </p>
              </div>
            </div>

            {/* Trạng thái Loading hoặc Rỗng */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-xs font-bold uppercase tracking-wider">Đang tải kho câu hỏi VDC...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HelpCircle size={32} />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">Chưa có câu hỏi nào</h4>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  {searchTerm
                    ? `Không tìm thấy câu hỏi nào phù hợp với từ khóa "${searchTerm}".`
                    : 'Chương này hiện chưa có câu hỏi VDC hoặc câu hay sưu tầm nào.'}
                </p>
                {isAdmin ? (
                  <button
                    onClick={handleAddNew}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 shadow-md shadow-indigo-100"
                  >
                    <Plus size={16} /> Đưa lên câu hỏi đầu tiên
                  </button>
                ) : (
                  searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                    >
                      Xóa bộ lọc tìm kiếm
                    </button>
                  )
                )}
              </div>
            ) : (
              /* DANH SÁCH CÁC THẺ CÂU HỎI */
              <div className="space-y-6">
                {paginatedQuestions.map((q, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index + 1;
                  const isExpanded = !!expandedSolutions[q.id];

                  return (
                    <article
                      key={q.id}
                      className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* HEADER CÂU HỎI */}
                      <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`w-8 h-8 rounded-xl bg-${themeColor}-600 text-white flex items-center justify-center font-black text-xs shadow-xs`}>
                            {globalIndex}
                          </span>
                          {renderLevelBadge(q.level)}
                          <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            {q.chapter_title}
                          </span>
                          {q.source && (
                            <span className="text-[11px] font-medium text-slate-500 italic max-w-xs truncate" title={q.source}>
                              Nguồn: {q.source}
                            </span>
                          )}
                        </div>

                        {/* NÚT THAO TÁC CÂU HỎI */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            onClick={() => handleCopyQuestion(q)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                            title="Sao chép câu hỏi & bài giải"
                          >
                            <Copy size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEdit(q)}
                                className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Chỉnh sửa câu hỏi"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(q.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Xóa câu hỏi"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* NỘI DUNG ĐỀ BÀI */}
                      <div className="p-5 sm:p-6 space-y-4">
                        {q.title && (
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            {q.title}
                          </h4>
                        )}

                        {/* Đề bài (Render Markdown, LaTeX, ảnh & xuống dòng chuẩn xác) */}
                        <div className="text-sm sm:text-base leading-relaxed text-slate-800 font-medium">
                          <RichMarkdownRenderer content={q.content} onImageClick={setLightboxImage} />
                        </div>

                        {/* Ảnh đề bài (nếu có) */}
                        {q.image_url && (
                          <div className="pt-2">
                            <div className="relative block group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-w-4xl mx-auto shadow-sm">
                              <img
                                src={q.image_url}
                                alt="Hình minh họa đề bài"
                                className="w-full max-h-[85vh] object-contain rounded-2xl cursor-pointer transition-transform group-hover:scale-[1.005]"
                                onClick={() => setLightboxImage(q.image_url!)}
                              />
                              <button
                                onClick={() => setLightboxImage(q.image_url!)}
                                className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white rounded-xl text-xs font-bold backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 shadow-lg"
                                title="Xem ảnh lớn"
                              >
                                <Maximize2 size={14} /> Phóng to
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Phương án trắc nghiệm A, B, C, D (nếu có) */}
                        {q.question_type === 'multiple_choice' && q.options && q.options.some(Boolean) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                            {q.options.map((opt, i) => {
                              if (!opt) return null;
                              const optLetter = ['A', 'B', 'C', 'D'][i];
                              const isCorrect = isExpanded && q.correct_answer === optLetter;

                              return (
                                <div
                                  key={i}
                                  className={`p-3 rounded-2xl border text-xs sm:text-sm font-medium flex items-start gap-2.5 transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/80 text-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-slate-600 border border-slate-300'
                                    }`}
                                  >
                                    {optLetter}
                                  </span>
                                  <div className="flex-1 pt-0.5 leading-snug">
                                    <RichMarkdownRenderer content={opt.replace(/^[A-D]\.\s*/, '')} onImageClick={setLightboxImage} />
                                  </div>
                                  {isCorrect && (
                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* NÚT XEM LỜI GIẢI / THU GỌN LỜI GIẢI */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                          <button
                            onClick={() => toggleSolution(q.id)}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                              isExpanded
                                ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                                : `bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60`
                            }`}
                          >
                            {isExpanded ? (
                              <>
                                <EyeOff size={15} /> Thu gọn lời giải
                              </>
                            ) : (
                              <>
                                <Eye size={15} /> 👁️ Xem bài giải chi tiết
                              </>
                            )}
                          </button>

                          {q.correct_answer && isExpanded && (
                            <div className="flex items-center gap-2 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                              <Check size={14} /> Đáp án đúng: <span>{q.correct_answer}</span>
                            </div>
                          )}
                        </div>

                        {/* KHU VỰC BÀI GIẢI CHI TIẾT (KHI EXPANDED) */}
                        {isExpanded && (
                          <div className="mt-4 p-5 sm:p-6 bg-slate-900 text-slate-100 rounded-3xl space-y-4 border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <div className="flex items-center gap-2">
                                <FileText size={16} className="text-amber-400" />
                                <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                                  Hướng dẫn phương pháp & Lời giải chi tiết
                                </span>
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Lớp {gradeId} • {q.chapter_title}
                              </span>
                            </div>

                            {/* Nội dung lời giải */}
                            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal space-y-2">
                              {q.solution ? (
                                <RichMarkdownRenderer content={q.solution} isInverted onImageClick={setLightboxImage} />
                              ) : (
                                <p className="italic text-slate-400">
                                  Lời giải chi tiết đang được giáo viên hoàn thiện và cập nhật thêm.
                                </p>
                              )}
                            </div>

                            {/* Ảnh minh họa bài giải (nếu có) */}
                            {q.solution_image_url && (
                              <div className="pt-3 border-t border-slate-800/80">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[11px] font-bold text-slate-400">Hình vẽ / Giản đồ / Bài giải đính kèm:</p>
                                  <button
                                    onClick={() => setLightboxImage(q.solution_image_url!)}
                                    className="text-[10px] font-black uppercase text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Maximize2 size={12} /> Bấm để phóng to
                                  </button>
                                </div>
                                <div className="relative group rounded-2xl overflow-hidden border border-slate-700/80 bg-white p-1 max-w-4xl mx-auto shadow-xl">
                                  <img
                                    src={q.solution_image_url}
                                    alt="Hình vẽ minh họa lời giải"
                                    className="w-full max-h-[85vh] object-contain rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                                    onClick={() => setLightboxImage(q.solution_image_url!)}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* THANH PHÂN TRANG (PAGINATION) */}
            {filteredQuestions.length > 0 && (
              <div className="pt-6 pb-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  Hiển thị từ câu <b>{(currentPage - 1) * pageSize + 1}</b> đến{' '}
                  <b>{Math.min(currentPage * pageSize, filteredQuestions.length)}</b> trên tổng số{' '}
                  <b>{filteredQuestions.length}</b> câu
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-xs text-slate-400">Số câu/trang:</span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="bg-white border border-slate-200 rounded-lg text-xs font-bold px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value={5}>5 câu</option>
                      <option value={10}>10 câu</option>
                      <option value={20}>20 câu</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    Trước
                  </button>

                  {/* Danh sách các số trang */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl text-xs font-black transition-all ${
                          p === currentPage
                            ? `bg-${themeColor}-600 text-white shadow-xs`
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors"
                  >
                    Tiếp
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 3. MODAL SOẠN THẢO CÂU HỎI VDC TOÀN MÀN HÌNH - CHIA 2 CỘT SOẠN & XEM TRƯỚC */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
          <div className="bg-slate-50 w-full h-full flex flex-col overflow-hidden text-slate-800">
            {/* Header Modal Toàn Màn Hình */}
            <header className="px-4 sm:px-6 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide truncate">
                      {editingQuestion ? 'Chỉnh sửa câu hỏi VDC' : 'Soạn thảo câu hỏi VDC / Sưu tầm mới'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      Khối {gradeId}
                    </span>
                    {modalForm.chapter_title && (
                      <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-300 bg-white/10 max-w-[200px] truncate">
                        {modalForm.chapter_title}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate hidden sm:block">
                    Hỗ trợ KaTeX ($...$, $$...$$), Markdown, dán ảnh trực tiếp (Ctrl+V) & Xem trước hai cột song song
                  </p>
                </div>
              </div>

              {/* Center / Right controls */}
              <div className="flex items-center gap-2">
                {/* Desktop Layout Toggles */}
                <div className="hidden lg:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setEditorLayoutMode('split')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                      editorLayoutMode === 'split' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Chia 2 cột: Soạn thảo và Xem trước song song"
                  >
                    <Columns2 size={14} />
                    <span className="text-[11px]">Chia đôi 50/50</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorLayoutMode('edit')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                      editorLayoutMode === 'edit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mở rộng toàn màn hình soạn thảo"
                  >
                    <FileText size={14} />
                    <span className="text-[11px]">Chỉ soạn thảo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorLayoutMode('preview')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                      editorLayoutMode === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Mở rộng toàn màn hình xem trước"
                  >
                    <Eye size={14} />
                    <span className="text-[11px]">Chỉ xem trước</span>
                  </button>
                </div>

                {/* Mobile Tabs */}
                <div className="flex lg:hidden items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMobileEditorTab('edit')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                      mobileEditorTab === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    <FileText size={13} />
                    <span className="text-[10px] uppercase font-black">Soạn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileEditorTab('preview')}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                      mobileEditorTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    <Eye size={13} />
                    <span className="text-[10px] uppercase font-black">Xem trước</span>
                  </button>
                </div>

                {/* Quick Save button in header */}
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  disabled={isSaving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span className="hidden sm:inline">{editingQuestion ? 'Lưu thay đổi' : 'Đưa lên ngay'}</span>
                  <span className="sm:hidden">Lưu</span>
                </button>

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
                  title="Đóng cửa sổ soạn thảo"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* 2. CHÍNH DIỆN: 2 CỘT CHIA ĐÔI */}
            <form onSubmit={handleSaveQuestion} className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              
              {/* === CỘT TRÁI: KHU VỰC SOẠN THẢO (50% hoặc Full) === */}
              <div className={`flex flex-col bg-white overflow-hidden transition-all ${
                editorLayoutMode === 'preview' ? 'hidden' : editorLayoutMode === 'edit' ? 'w-full flex-1' : 'w-full lg:w-1/2 flex-1'
              } ${mobileEditorTab === 'preview' ? 'hidden lg:flex' : 'flex'}`}>
                
                {/* Meta properties row (Chương, Mức độ, Dạng bài, Nguồn, Hình thức) */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 space-y-3.5 shrink-0 overflow-y-auto max-h-[35vh]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        Chương bài học *
                      </label>
                      <input
                        type="text"
                        list="chapters-datalist"
                        value={modalForm.chapter_title || ''}
                        onChange={e => setModalForm({ ...modalForm, chapter_title: e.target.value })}
                        placeholder="VD: Chương 1: Dao động cơ"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                        required
                      />
                      <datalist id="chapters-datalist">
                        {chaptersList.map(c => (
                          <option key={c.id} value={c.title} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        Phân loại / Mức độ *
                      </label>
                      <select
                        value={modalForm.level || 'vdc'}
                        onChange={e => setModalForm({ ...modalForm, level: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="vdc">⚡ Vận dụng cao 9+ (VDC)</option>
                        <option value="hay_suutam">🌟 Câu hay sưu tầm đặc sắc</option>
                        <option value="de_thi_thu">🎯 Đề thi thử chuyên chọn lọc</option>
                        <option value="phuong_phap_la">💡 Phương pháp giải độc lạ / Điểm 10</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        Tiêu đề dạng bài (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={modalForm.title || ''}
                        onChange={e => setModalForm({ ...modalForm, title: e.target.value })}
                        placeholder="VD: Con lắc lò xo treo thẳng đứng"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 transition-all shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                        Nguồn sưu tầm / Đề thi
                      </label>
                      <input
                        type="text"
                        value={modalForm.source || ''}
                        onChange={e => setModalForm({ ...modalForm, source: e.target.value })}
                        placeholder="VD: Chuyên Amsterdam 2024 / Thầy Minh"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Hình thức câu hỏi */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="radio"
                          name="modal_q_type"
                          checked={modalForm.question_type === 'multiple_choice'}
                          onChange={() => setModalForm({ ...modalForm, question_type: 'multiple_choice' })}
                          className="accent-indigo-600"
                        />
                        Trắc nghiệm (4 đáp án A, B, C, D)
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="radio"
                          name="modal_q_type"
                          checked={modalForm.question_type === 'essay'}
                          onChange={() => setModalForm({ ...modalForm, question_type: 'essay' })}
                          className="accent-indigo-600"
                        />
                        Tự luận / Điền đáp số
                      </label>
                    </div>

                    <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                      Dán ảnh trực tiếp: <kbd className="bg-slate-200 px-1 py-0.5 rounded text-[9px] font-mono text-slate-700 font-bold">Ctrl + V</kbd>
                    </span>
                  </div>
                </div>

                {/* THANH CÔNG CỤ ĐỊNH DẠNG (STICKY FORMATTING TOOLBAR) */}
                <div className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1 shadow-sm">
                  {/* Trường đích đang chọn: Đề bài vs Lời giải */}
                  <div className="flex items-center bg-white rounded-xl p-0.5 border border-slate-200 mr-1.5 shrink-0 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setActiveEditorField('content')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                        activeEditorField === 'content'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>📝 Đề bài</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEditorField('solution')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                        activeEditorField === 'solution'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>💡 Lời giải</span>
                    </button>
                  </div>

                  {/* Nhóm định dạng văn bản cơ bản */}
                  <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => wrapText('**', '**')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="In đậm (Bold)"
                    >
                      <Bold size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('_', '_')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="In nghiêng (Italic)"
                    >
                      <Italic size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('<u>', '</u>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Gạch chân (Underline)"
                    >
                      <Underline size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('<sub>', '</sub>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Chỉ số dưới (Subscript, ví dụ: x₁ hoặc v₀)"
                    >
                      <Subscript size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('<sup>', '</sup>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Chỉ số trên / Mũ (Superscript, ví dụ: x² hoặc 10⁻³)"
                    >
                      <Superscript size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('### ')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Tiêu đề mục (Heading)"
                    >
                      <Heading3 size={15} />
                    </button>
                  </div>

                  {/* Nhóm danh sách, bảng, trích dẫn */}
                  <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => wrapText('- ')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Danh sách gạch đầu dòng"
                    >
                      <List size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('1. ')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Danh sách đánh số thứ tự"
                    >
                      <ListOrdered size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('\n| Thông số | Giá trị |\n| :--- | :--- |\n| $m$ | $100\\text{ g}$ |\n| $k$ | $100\\text{ N/m}$ |\n')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Chèn bảng dữ liệu Markdown"
                    >
                      <TableIcon size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('> **Chú ý quan trọng:** ')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Hộp ghi chú (Quote/Callout)"
                    >
                      <Quote size={15} />
                    </button>
                  </div>

                  {/* Nút dropdown công thức Toán / Lý (KaTeX) */}
                  <div className="relative pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowMathDialog(!showMathDialog)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        showMathDialog ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:text-orange-600 hover:bg-white'
                      }`}
                      title="Chèn công thức Toán & Vật lý LaTeX"
                    >
                      <Calculator size={15} className="text-orange-600" />
                      <span className="text-[11px] font-black uppercase text-orange-600">Công thức</span>
                      <ChevronDown size={11} />
                    </button>

                    {showMathDialog && (
                      <div className="absolute top-full left-0 mt-2 w-[340px] sm:w-[380px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 max-h-[380px] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            CÔNG THỨC TOÁN & VẬT LÝ LATEX
                          </span>
                          <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            BẤM ĐỂ CHÈN
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {MATH_FORMULAS.map(m => (
                            <button
                              key={m.label}
                              type="button"
                              onClick={() => {
                                wrapText(m.value);
                                setShowMathDialog(false);
                              }}
                              className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-slate-100 transition-all group"
                            >
                              <span className="text-sm font-black text-orange-600 group-hover:scale-110 transition-transform">
                                {m.display}
                              </span>
                              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center mt-1 truncate w-full">
                                {m.label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => { wrapText('$', '$'); setShowMathDialog(false); }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                          >
                            Chèn $...$ (Cùng dòng)
                          </button>
                          <button
                            type="button"
                            onClick={() => { wrapText('$$\n', '\n$$'); setShowMathDialog(false); }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                          >
                            Chèn $$...$$ (Dòng riêng)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Căn lề */}
                  <div className="flex items-center gap-0.5 pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => wrapText('<div align="left">\n\n', '\n\n</div>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Căn trái"
                    >
                      <AlignLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('<div align="center">\n\n', '\n\n</div>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Căn giữa"
                    >
                      <AlignCenter size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => wrapText('<div align="right">\n\n', '\n\n</div>')}
                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Căn phải"
                    >
                      <AlignRight size={15} />
                    </button>
                  </div>

                  {/* Dropdown Size & Màu chữ */}
                  <div className="relative pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(activeDropdown === 'size' ? null : 'size')}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-black text-slate-600 hover:bg-white rounded-lg transition-all"
                    >
                      <Type size={13} />
                      <span>SIZE</span>
                      <ChevronDown size={10} />
                    </button>
                    {activeDropdown === 'size' && (
                      <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1">
                        {FONT_SIZES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => applyStyle('font-size', s.value)}
                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative pr-1.5 mr-1 border-r border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-black text-slate-600 hover:bg-white rounded-lg transition-all"
                    >
                      <Palette size={13} />
                      <span>MÀU</span>
                      <ChevronDown size={10} />
                    </button>
                    {activeDropdown === 'color' && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 grid grid-cols-3 gap-1.5">
                        {COLORS.map(c => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => applyStyle('color', c.value)}
                            className={`w-full aspect-square ${c.bg} rounded-lg border border-slate-200 hover:scale-110 transition-transform`}
                            title={c.label}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NÚT CHÈN ẢNH TRỰC TIẾP (IMAGE UPLOAD MODAL) */}
                  <button
                    type="button"
                    onClick={() => setIsImageModalOpen(true)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ml-auto"
                    title="Chèn ảnh trực tiếp / Tải lên ImgBB / Dán ảnh (Ctrl+V)"
                  >
                    <ImageIcon size={14} />
                    <span className="font-black text-[11px] uppercase">Chèn ảnh</span>
                  </button>
                </div>

                {/* KHU VỰC NHẬP LIỆU CUỘN DỌC (SCROLLABLE EDITOR FORM) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
                  
                  {/* Phần A: Nội dung câu hỏi (Đề bài) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          Nội dung đề bài câu hỏi *
                        </label>
                        {activeEditorField === 'content' && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 border border-indigo-200">
                            Đang soạn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {(modalForm.content || '').length} ký tự
                      </span>
                    </div>

                    <textarea
                      ref={contentTextareaRef}
                      rows={7}
                      value={modalForm.content || ''}
                      onFocus={() => setActiveEditorField('content')}
                      onChange={e => setModalForm({ ...modalForm, content: e.target.value })}
                      onPaste={e => handleTextareaPaste(e, 'content')}
                      placeholder="Nhập nội dung đề bài... Gõ Enter để xuống dòng tùy ý.&#10;Hỗ trợ công thức $k = 100\text{ N/m}$, $$E = \frac{1}{2}kA^2$$, dán ảnh trực tiếp (Ctrl+V)..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all leading-relaxed custom-scrollbar selection:bg-indigo-100"
                      required
                    />

                    {/* Hàng gắn ảnh đề bài */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold shrink-0">
                        <ImageIcon size={14} className="text-indigo-600" />
                        <span>Ảnh đề bài:</span>
                      </div>
                      <input
                        type="text"
                        value={modalForm.image_url || ''}
                        onChange={e => setModalForm({ ...modalForm, image_url: e.target.value })}
                        placeholder="Dán link ảnh hoặc tải ảnh lên từ máy..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                      />
                      <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0 border border-indigo-200">
                        <Upload size={13} />
                        <span>{isUploadingImage ? 'Đang tải...' : 'Tải ảnh đề'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleUploadImage(e, 'image_url')}
                          disabled={isUploadingImage}
                        />
                      </label>
                      {modalForm.image_url && (
                        <button
                          type="button"
                          onClick={() => setModalForm({ ...modalForm, image_url: '' })}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                          title="Gỡ ảnh đề bài"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Phần B: 4 Phương án A, B, C, D (Nếu trắc nghiệm) */}
                  {modalForm.question_type === 'multiple_choice' && (
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          4 Phương án trắc nghiệm & Chọn đáp án đúng
                        </label>
                        <span className="text-[10px] text-slate-500">
                          Tích chọn vào chữ cái <span className="font-bold text-emerald-600">A, B, C, D</span> để đặt đáp án đúng
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A', 'B', 'C', 'D'].map((letter, i) => {
                          const isCorrect = modalForm.correct_answer === letter;
                          return (
                            <div
                              key={letter}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20'
                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="correct_radio_editor"
                                checked={isCorrect}
                                onChange={() => setModalForm({ ...modalForm, correct_answer: letter })}
                                className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                title={`Đặt ${letter} là đáp án đúng`}
                              />
                              <span
                                className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 cursor-pointer ${
                                  isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                                }`}
                                onClick={() => setModalForm({ ...modalForm, correct_answer: letter })}
                              >
                                {letter}
                              </span>
                              <input
                                type="text"
                                value={(modalForm.options || [])[i] || ''}
                                onChange={e => {
                                  const newOpts = [...(modalForm.options || ['', '', '', ''])];
                                  newOpts[i] = e.target.value;
                                  setModalForm({ ...modalForm, options: newOpts });
                                }}
                                placeholder={`Nội dung phương án ${letter} (VD: $x = 5\\text{ cm}$)...`}
                                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500 transition-all"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Phần C: Bài giải / Lời giải chi tiết */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Bài giải / Lời giải chi tiết & Phương pháp tư duy
                        </label>
                        {activeEditorField === 'solution' && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200">
                            Đang soạn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {(modalForm.solution || '').length} ký tự
                      </span>
                    </div>

                    <textarea
                      ref={solutionTextareaRef}
                      rows={9}
                      value={modalForm.solution || ''}
                      onFocus={() => setActiveEditorField('solution')}
                      onChange={e => setModalForm({ ...modalForm, solution: e.target.value })}
                      onPaste={e => handleTextareaPaste(e, 'solution')}
                      placeholder="Nhập các bước tư duy, công thức giải, bản chất vật lý, kết luận...&#10;Bước 1: Tính tần số góc $\\omega = \\sqrt{k/m}$...&#10;Bước 2: Sử dụng hệ thức độc lập thời gian...&#10;Bước 3: Suy ra đáp án cần chọn..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all leading-relaxed custom-scrollbar selection:bg-amber-100"
                    />

                    {/* Hàng gắn ảnh minh họa lời giải */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold shrink-0">
                        <ImageIcon size={14} className="text-amber-600" />
                        <span>Hình vẽ lời giải:</span>
                      </div>
                      <input
                        type="text"
                        value={modalForm.solution_image_url || ''}
                        onChange={e => setModalForm({ ...modalForm, solution_image_url: e.target.value })}
                        placeholder="Dán link giản đồ vectơ, đồ thị bài giải..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-indigo-500"
                      />
                      <label className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1 shrink-0 border border-amber-200">
                        <Upload size={13} />
                        <span>{isUploadingImage ? 'Đang tải...' : 'Tải ảnh giải'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleUploadImage(e, 'solution_image_url')}
                          disabled={isUploadingImage}
                        />
                      </label>
                      {modalForm.solution_image_url && (
                        <button
                          type="button"
                          onClick={() => setModalForm({ ...modalForm, solution_image_url: '' })}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"
                          title="Gỡ ảnh lời giải"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* === CỘT PHẢI: KHU VỰC LIVE PREVIEW (50% hoặc Full) === */}
              <div className={`flex flex-col bg-slate-100/70 overflow-hidden transition-all ${
                editorLayoutMode === 'edit' ? 'hidden' : editorLayoutMode === 'preview' ? 'w-full flex-1' : 'w-full lg:w-1/2 flex-1'
              } ${mobileEditorTab === 'edit' ? 'hidden lg:flex' : 'flex'}`}>
                
                {/* Header thanh xem trước */}
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Eye size={15} className="text-indigo-600" />
                      XEM TRƯỚC HIỂN THỊ (LIVE PREVIEW)
                    </span>
                  </div>

                  {/* Switch giữa xem toàn bộ và thử nghiệm học sinh */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewStudentMode(false)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        !previewStudentMode ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Giáo viên (Đầy đủ)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewStudentMode(true);
                        setPreviewSelectedAnswer(null);
                        setPreviewShowSolution(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                        previewStudentMode ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Thử làm bài
                    </button>
                  </div>
                </div>

                {/* Vùng hiển thị xem trước cuộn dọc */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                  
                  {/* Thẻ câu hỏi mô phỏng hiển thị trên trang chính */}
                  <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200/80 space-y-5">
                    
                    {/* Hàng nhãn: Level, Chương, Nguồn */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                          modalForm.level === 'vdc' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : modalForm.level === 'hay_suutam'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : modalForm.level === 'de_thi_thu'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}>
                          {modalForm.level === 'vdc' && '⚡ VẬN DỤNG CAO 9+'}
                          {modalForm.level === 'hay_suutam' && '🌟 CÂU HAY SƯU TẦM'}
                          {modalForm.level === 'de_thi_thu' && '🎯 ĐỀ THI THỬ CHỌN LỌC'}
                          {modalForm.level === 'phuong_phap_la' && '💡 PHƯƠNG PHÁP ĐỘC LẠ'}
                        </span>

                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700">
                          {modalForm.chapter_title || 'Chưa chọn chương'}
                        </span>
                      </div>

                      {modalForm.source && (
                        <span className="text-[11px] font-bold text-slate-400 italic">
                          Nguồn: {modalForm.source}
                        </span>
                      )}
                    </div>

                    {/* Tiêu đề dạng bài */}
                    {modalForm.title && (
                      <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {modalForm.title}
                      </h4>
                    )}

                    {/* Nội dung câu hỏi đề bài */}
                    <div className="text-sm sm:text-base text-slate-800 leading-relaxed font-normal">
                      {modalForm.content ? (
                        <RichMarkdownRenderer content={modalForm.content} onImageClick={setLightboxImage} />
                      ) : (
                        <p className="italic text-slate-400 py-4 text-center">
                          Chưa có nội dung đề bài. Hãy nhập vào ô soạn thảo bên trái...
                        </p>
                      )}
                    </div>

                    {/* Ảnh đề bài (nếu có) */}
                    {modalForm.image_url && (
                      <div className="py-2">
                        <img
                          src={modalForm.image_url}
                          alt="Hình vẽ đề bài"
                          className="w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl border border-slate-200 shadow-xs bg-slate-50 p-1 mx-auto block cursor-pointer"
                          onClick={() => setLightboxImage(modalForm.image_url!)}
                        />
                      </div>
                    )}

                    {/* 4 Phương án A, B, C, D */}
                    {modalForm.question_type === 'multiple_choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {['A', 'B', 'C', 'D'].map((letter, i) => {
                          const optText = (modalForm.options || [])[i] || '';
                          const isCorrect = modalForm.correct_answer === letter;
                          const isSelectedByStudent = previewSelectedAnswer === letter;

                          return (
                            <div
                              key={letter}
                              onClick={() => {
                                if (previewStudentMode) {
                                  setPreviewSelectedAnswer(letter);
                                }
                              }}
                              className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                                !previewStudentMode
                                  ? isCorrect
                                    ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                                    : 'bg-slate-50 border-slate-200'
                                  : isSelectedByStudent
                                  ? isCorrect
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/30'
                                    : 'bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-500/30'
                                  : 'bg-slate-50 border-slate-200 hover:border-indigo-300 cursor-pointer'
                              }`}
                            >
                              <span
                                className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                  !previewStudentMode
                                    ? isCorrect
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-200 text-slate-700'
                                    : isSelectedByStudent
                                    ? isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {letter}
                              </span>

                              <div className="flex-1 text-xs sm:text-sm font-semibold pt-0.5 leading-relaxed">
                                {optText ? (
                                  <RichMarkdownRenderer content={optText} onImageClick={setLightboxImage} />
                                ) : (
                                  <span className="italic text-slate-400">Phương án {letter}...</span>
                                )}
                              </div>

                              {!previewStudentMode && isCorrect && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs shrink-0 self-center">
                                  Đáp án đúng
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Phản hồi trong chế độ thử làm bài của học sinh */}
                    {previewStudentMode && previewSelectedAnswer && (
                      <div className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                        previewSelectedAnswer === modalForm.correct_answer
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={18} className={previewSelectedAnswer === modalForm.correct_answer ? 'text-emerald-600' : 'text-rose-600'} />
                          <span className="font-bold">
                            {previewSelectedAnswer === modalForm.correct_answer
                              ? 'Chính xác! Em đã chọn đúng đáp án.'
                              : `Chưa chính xác! Đáp án đúng là ${modalForm.correct_answer}.`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewShowSolution(!previewShowSolution)}
                          className="px-3 py-1 bg-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors"
                        >
                          {previewShowSolution ? 'Ẩn lời giải' : 'Xem lời giải'}
                        </button>
                      </div>
                    )}

                    {/* Hộp Lời Giải Chi Tiết */}
                    {(!previewStudentMode || previewShowSolution) && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                        <div className="p-4 sm:p-6 bg-slate-900 text-slate-100 rounded-3xl shadow-xl space-y-4 border border-slate-800">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-amber-400" />
                              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                                LỜI GIẢI CHI TIẾT & BƯỚC TƯ DUY
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Hiển thị KaTeX & Công thức
                            </span>
                          </div>

                          <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
                            {modalForm.solution ? (
                              <RichMarkdownRenderer content={modalForm.solution} isInverted onImageClick={setLightboxImage} />
                            ) : (
                              <p className="italic text-slate-400">
                                Lời giải chi tiết chưa được nhập. Hãy nhập các bước giải vào ô bên trái...
                              </p>
                            )}
                          </div>

                          {/* Ảnh minh họa bài giải */}
                          {modalForm.solution_image_url && (
                            <div className="pt-3 border-t border-slate-800">
                              <p className="text-[11px] font-bold text-slate-400 mb-2">Hình vẽ / Giản đồ bài giải:</p>
                              <img
                                src={modalForm.solution_image_url}
                                alt="Hình vẽ minh họa lời giải"
                                className="w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl bg-white p-1 border border-slate-700 mx-auto block cursor-pointer"
                                onClick={() => setLightboxImage(modalForm.solution_image_url!)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>

            </form>

            {/* 3. FOOTER BAR (THỐNG KÊ NHANH & NÚT HÀNH ĐỘNG) */}
            <footer className="px-4 sm:px-6 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-lg">
              <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                <span className="hidden sm:inline">
                  Trạng thái: <b className="text-indigo-600">{editingQuestion ? 'Đang sửa câu hỏi' : 'Tạo mới'}</b>
                </span>
                <span>
                  Đề bài: <b>{(modalForm.content || '').trim().split(/\s+/).filter(Boolean).length}</b> từ
                </span>
                <span>
                  Lời giải: <b>{(modalForm.solution || '').trim().split(/\s+/).filter(Boolean).length}</b> từ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  disabled={isSaving}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-100 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                  <span>{editingQuestion ? 'Lưu thay đổi' : 'Đưa lên ngay'}</span>
                </button>
              </div>
            </footer>

          </div>
        </div>
      )}

      {/* 4. MODAL HƯỚNG DẪN TẠO BẢNG SUPABASE & SCRIPT SQL */}
      {showSqlModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-emerald-400" />
                <h3 className="font-black text-sm uppercase tracking-wide">
                  Cấu hình CSDL Supabase: Bảng `vdc_questions`
                </h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-600 custom-scrollbar">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 space-y-2">
                <h4 className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Vì sao rất nên tạo bảng `vdc_questions` riêng?
                </h4>
                <p className="leading-relaxed">
                  1. <b>Tách biệt & Siêu tốc:</b> Giúp kho câu hỏi VDC và lời giải không làm nặng cây bài học chính. Mỗi câu là 1 dòng dữ liệu độc lập, phân trang và tìm kiếm siêu nhanh.
                </p>
                <p className="leading-relaxed">
                  2. <b>Lưu trữ an toàn 100%:</b> Dữ liệu được bảo quản vĩnh viễn trên Supabase, độc lập với cấu trúc sách bài giảng.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase text-[11px] tracking-wide">
                    Đoạn mã SQL (Chạy 1 lần trên Supabase):
                  </span>
                  <button
                    onClick={copySqlCode}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép mã SQL'}</span>
                  </button>
                </div>

                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 custom-scrollbar border border-slate-800">
                  {SQL_SCRIPT}
                </pre>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <h5 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Cách thực hiện (Chỉ 30 giây):</h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px]">
                  <li>Đăng nhập tài khoản Supabase của thầy/cô tại <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">supabase.com</a>.</li>
                  <li>Chọn dự án của thầy/cô, nhấn vào mục <b>SQL Editor</b> ở thanh bên trái.</li>
                  <li>Bấm <b>New query</b>, dán đoạn mã vừa sao chép ở trên vào và bấm nút <b>RUN</b> xanh lá.</li>
                </ol>
              </div>
            </div>

            <footer className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={loadQuestions}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Kiểm tra kết nối lại</span>
              </button>
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
              >
                Đóng
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* 5. LIGHTBOX XEM ẢNH TO */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={lightboxImage}
              alt="Ảnh phóng to"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL SỬA TÊN CHƯƠNG */}
      {editingChapter && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Pencil size={16} className="text-amber-500" /> Đổi tên chương
              </h3>
              <button onClick={() => setEditingChapter(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEditChapter} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Tên chương mới *</label>
                <input
                  type="text"
                  autoFocus
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  placeholder="Nhập tên chương mới..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingChapter(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md`}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL THÊM CHƯƠNG MỚI */}
      {showAddChapterModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Plus size={16} className="text-amber-500" /> Thêm chương mới vào menu
              </h3>
              <button onClick={() => setShowAddChapterModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveAddChapter} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Tên chương mới *</label>
                <input
                  type="text"
                  autoFocus
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="VD: Chương 2: Sóng cơ..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChapterModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md`}
                >
                  Thêm chương
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL CHÈN ẢNH TRỰC TIẾP (ImgBB, Dán Clipboard, URL) */}
      <ImageUploadModal 
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onInsert={handleInsertImageSnippet}
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default VdcQuestionsPanel;
