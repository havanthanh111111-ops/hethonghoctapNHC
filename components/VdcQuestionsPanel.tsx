import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  X, 
  Upload, 
  Cloud, 
  Folder, 
  RefreshCw,
  FileText,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Menu
} from 'lucide-react';
import { VdcQuestion, BookNode } from '../types';
import { SAMPLE_VDC_QUESTIONS } from '../sampleVdcData';
import { supabase } from '../supabaseClient';
import { renderLatex } from '../utils';
import { uploadToImgBB } from '../imgbb';
import { uploadFileToGoogleDrive, signInWithGoogleForDrive, getDriveAccessToken } from '../googleDrive';

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

  // Lấy danh sách các chương (Folders) từ cấu trúc sách + danh sách thủ công trong chapterOrder
  const chaptersList = useMemo(() => {
    const list: { id: string; title: string; fromNode?: boolean }[] = [];
    const seen = new Set<string>();
    const deletedSet = new Set(deletedChapters.map(t => t.trim().toLowerCase()));

    const addTitle = (title: string, id?: string, fromNode = false) => {
      const clean = title?.trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (!seen.has(lower) && !deletedSet.has(lower)) {
        seen.add(lower);
        list.push({ id: id || `custom-${clean}`, title: clean, fromNode });
      }
    };

    // 1. Thêm các chương trong chapterOrder (đảm bảo các chương tự tạo luôn xuất hiện dù có 0 câu hỏi)
    chapterOrder.forEach(title => {
      addTitle(title);
    });

    // 2. Thêm từ các node folder gốc trong sách bài giảng
    (nodes || [])
      .filter(n => n.type === 'folder' && (n.parentId === null || n.parentId === undefined))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach(f => {
        addTitle(f.title, f.id, true);
      });

    // 3. Thêm bất kỳ chương nào đã có trong danh sách câu hỏi
    questions.forEach(q => {
      if (q.chapter_title) {
        addTitle(q.chapter_title, q.chapter_id);
      }
    });

    // 4. Sắp xếp danh sách chương theo chapterOrder nếu có
    if (chapterOrder.length > 0) {
      list.sort((a, b) => {
        const idxA = chapterOrder.findIndex(t => t.trim().toLowerCase() === a.title.trim().toLowerCase());
        const idxB = chapterOrder.findIndex(t => t.trim().toLowerCase() === b.title.trim().toLowerCase());
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
      const updatedOrder = Array.from(new Set([...chapterOrder.filter(t => t.trim().toLowerCase() !== titleToAdd.toLowerCase()), titleToAdd]));
      setChapterOrder(updatedOrder);
      localStorage.setItem(`vdc_chapter_order_g${gradeId}`, JSON.stringify(updatedOrder));

      // 3. Đồng bộ lên CSDL Supabase để bảo tồn vĩnh viễn trên đám mây
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
            setQuestions(sData.questions);
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
        setQuestions(prev => {
          if (prev && prev.length > 0) return prev;
          return SAMPLE_VDC_QUESTIONS.filter(q => q.grade_id === gradeId);
        });
      } else {
        // Lỗi (chưa tạo bảng vdc_questions trên Supabase) -> Dùng Fallback
        setDbStatus('fallback');
        setQuestions(prev => {
          if (prev && prev.length > 0) return prev;
          return SAMPLE_VDC_QUESTIONS.filter(q => q.grade_id === gradeId);
        });
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
    setShowQuestionModal(true);
  };

  // Mở form chỉnh sửa
  const handleEdit = (q: VdcQuestion) => {
    setEditingQuestion(q);
    setModalForm({
      ...q,
      options: q.options && q.options.length > 0 ? [...q.options] : ['', '', '', '']
    });
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

          // Cập nhật bản sao lưu fallback
          await supabase.from('app_settings').upsert({
            id: 8000 + gradeId,
            data: { questions: nextList, updated_at: new Date().toISOString() }
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

      // 3. Luôn lưu một bản vào fallback app_settings để đảm bảo an toàn 100%
      await supabase.from('app_settings').upsert({
        id: 8000 + gradeId,
        data: { questions: nextQuestions, updated_at: new Date().toISOString() }
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

                        {/* Đề bài (Render LaTeX & xuống dòng chuẩn xác) */}
                        <div className="text-sm sm:text-base leading-relaxed text-slate-800 font-medium whitespace-pre-line">
                          {renderLatex(q.content)}
                        </div>

                        {/* Ảnh đề bài (nếu có) */}
                        {q.image_url && (
                          <div className="pt-2">
                            <div className="relative inline-block group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                              <img
                                src={q.image_url}
                                alt="Hình minh họa đề bài"
                                className="max-h-80 object-contain rounded-2xl cursor-pointer transition-transform group-hover:scale-[1.01]"
                                onClick={() => setLightboxImage(q.image_url!)}
                              />
                              <button
                                onClick={() => setLightboxImage(q.image_url!)}
                                className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Xem ảnh lớn"
                              >
                                <Maximize2 size={14} />
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
                                    {renderLatex(opt.replace(/^[A-D]\.\s*/, ''))}
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
                            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal whitespace-pre-line space-y-2">
                              {q.solution ? (
                                renderLatex(q.solution)
                              ) : (
                                <p className="italic text-slate-400">
                                  Lời giải chi tiết đang được giáo viên hoàn thiện và cập nhật thêm.
                                </p>
                              )}
                            </div>

                            {/* Ảnh minh họa bài giải (nếu có) */}
                            {q.solution_image_url && (
                              <div className="pt-3 border-t border-slate-800/80">
                                <p className="text-[11px] font-bold text-slate-400 mb-2">Hình vẽ / Giản đồ lời giải:</p>
                                <img
                                  src={q.solution_image_url}
                                  alt="Hình vẽ minh họa lời giải"
                                  className="max-h-80 object-contain rounded-xl bg-white p-2 border border-slate-700 cursor-pointer"
                                  onClick={() => setLightboxImage(q.solution_image_url!)}
                                />
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

      {/* 3. MODAL THÊM / SỬA CÂU HỎI (DÀNH CHO GIÁO VIÊN) */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                <h3 className="font-black text-sm uppercase tracking-wide">
                  {editingQuestion ? 'Chỉnh sửa câu hỏi VDC' : 'Đưa lên câu hỏi VDC / Sưu tầm mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            {/* Form body */}
            <form onSubmit={handleSaveQuestion} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              {/* Hàng 1: Chương & Mức độ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Chương bài học *
                  </label>
                  <input
                    type="text"
                    list="chapters-datalist"
                    value={modalForm.chapter_title || ''}
                    onChange={e => setModalForm({ ...modalForm, chapter_title: e.target.value })}
                    placeholder="VD: Chương 1: Dao động cơ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    required
                  />
                  <datalist id="chapters-datalist">
                    {chaptersList.map(c => (
                      <option key={c.id} value={c.title} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Phân loại / Mức độ *
                  </label>
                  <select
                    value={modalForm.level || 'vdc'}
                    onChange={e => setModalForm({ ...modalForm, level: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="vdc">⚡ Vận dụng cao 9+ (VDC)</option>
                    <option value="hay_suutam">🌟 Câu hay sưu tầm đặc sắc</option>
                    <option value="de_thi_thu">🎯 Đề thi thử chuyên chọn lọc</option>
                    <option value="phuong_phap_la">💡 Phương pháp giải độc lạ / Điểm 10</option>
                  </select>
                </div>
              </div>

              {/* Hàng 2: Tiêu đề dạng bài & Nguồn đề */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Tiêu đề dạng bài (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={modalForm.title || ''}
                    onChange={e => setModalForm({ ...modalForm, title: e.target.value })}
                    placeholder="VD: Con lắc lò xo chịu ngoại lực đột ngột"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                    Nguồn sưu tầm / Đề thi
                  </label>
                  <input
                    type="text"
                    value={modalForm.source || ''}
                    onChange={e => setModalForm({ ...modalForm, source: e.target.value })}
                    placeholder="VD: Chuyên Amsterdam 2024 / Thầy Minh sưu tầm"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Hàng 3: Loại câu hỏi */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Hình thức câu hỏi
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="q_type"
                      checked={modalForm.question_type === 'multiple_choice'}
                      onChange={() => setModalForm({ ...modalForm, question_type: 'multiple_choice' })}
                      className="accent-indigo-600"
                    />
                    Trắc nghiệm (4 phương án A, B, C, D)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="radio"
                      name="q_type"
                      checked={modalForm.question_type === 'essay'}
                      onChange={() => setModalForm({ ...modalForm, question_type: 'essay' })}
                      className="accent-indigo-600"
                    />
                    Tự luận / Điền đáp số
                  </label>
                </div>
              </div>

              {/* Hàng 4: Nội dung đề bài */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Nội dung câu hỏi (Đề bài) *
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Nhấn Enter để xuống dòng • Công thức: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">$...$</code> hoặc <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">$$...$$</code>
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={modalForm.content || ''}
                  onChange={e => setModalForm({ ...modalForm, content: e.target.value })}
                  placeholder="Nhập nội dung đề bài... Thầy/cô gõ Enter để xuống dòng tùy ý.&#10;Ví dụ: Cho con lắc lò xo $k = 100\text{ N/m}$, $m = 100\text{ g}$..."
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all leading-relaxed"
                  required
                />
                {/* Live Preview đề bài */}
                {modalForm.content && (
                  <div className="mt-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-1">
                      Xem trước nội dung hiển thị (xuống dòng & công thức):
                    </span>
                    {renderLatex(modalForm.content)}
                  </div>
                )}
              </div>

              {/* Hàng 5: Link hình ảnh đề bài */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Hình ảnh đề bài (Nếu có)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalForm.image_url || ''}
                    onChange={e => setModalForm({ ...modalForm, image_url: e.target.value })}
                    placeholder="Dán link ảnh hoặc tải ảnh lên từ máy..."
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <label className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0">
                    <Upload size={14} />
                    <span>{isUploadingImage ? 'Đang tải...' : 'Tải ảnh lên'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleUploadImage(e, 'image_url')}
                      disabled={isUploadingImage}
                    />
                  </label>
                </div>
              </div>

              {/* Hàng 6: Các phương án A, B, C, D (Nếu trắc nghiệm) */}
              {modalForm.question_type === 'multiple_choice' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                      4 Phương án trắc nghiệm & Chọn đáp án đúng
                    </label>
                    <span className="text-[10px] text-slate-400">Đánh dấu tích tròn vào đáp án đúng</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                      <div key={letter} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct_radio"
                          checked={modalForm.correct_answer === letter}
                          onChange={() => setModalForm({ ...modalForm, correct_answer: letter })}
                          className="accent-emerald-600 w-4 h-4 cursor-pointer"
                          title={`Chọn ${letter} làm đáp án đúng`}
                        />
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
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
                          placeholder={`Nội dung phương án ${letter}...`}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hàng 7: Bài giải chi tiết */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Bài giải / Lời giải chi tiết
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Nhấn Enter để xuống dòng từng bước • Công thức: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">$..$</code> hoặc <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">$$..$$</code>
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={modalForm.solution || ''}
                  onChange={e => setModalForm({ ...modalForm, solution: e.target.value })}
                  placeholder="Nhập các bước tư duy, công thức giải, kết luận...&#10;Bước 1: Tính tần số góc...&#10;Bước 2: Viết phương trình..."
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all leading-relaxed"
                />
                {/* Live Preview lời giải */}
                {modalForm.solution && (
                  <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                      Xem trước lời giải hiển thị (xuống dòng & công thức):
                    </span>
                    {renderLatex(modalForm.solution)}
                  </div>
                )}
              </div>

              {/* Hàng 8: Link hình ảnh lời giải */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  Hình vẽ minh họa lời giải (Nếu có)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalForm.solution_image_url || ''}
                    onChange={e => setModalForm({ ...modalForm, solution_image_url: e.target.value })}
                    placeholder="Link đồ thị, giản đồ vectơ bài giải..."
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <label className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0">
                    <Upload size={14} />
                    <span>{isUploadingImage ? 'Đang tải...' : 'Tải ảnh giải'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleUploadImage(e, 'solution_image_url')}
                      disabled={isUploadingImage}
                    />
                  </label>
                </div>
              </div>

              {/* Footer hành động Modal */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-100 flex items-center gap-2 transition-all disabled:opacity-50`}
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                  <span>{editingQuestion ? 'Lưu thay đổi' : 'Đưa lên ngay'}</span>
                </button>
              </div>
            </form>
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
    </div>
  );
};

export default VdcQuestionsPanel;
