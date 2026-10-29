
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Book, Plus, Maximize2, Loader2, BrainCircuit, GraduationCap, ShieldCheck, Search, LogOut, Folder, Globe, Zap, Image as ImageIcon, Settings, ArrowLeft, ArrowRight, Upload, AlertCircle, Users, Cloud, ExternalLink, BookOpen, Sparkles, ChevronRight, Key, ListOrdered, ArrowUpDown, Menu, Paperclip, X } from 'lucide-react';
import { uploadFileToGoogleDrive, signInWithGoogleForDrive, getDriveAccessToken, isGoogleDriveUrl, extractDriveFileId } from './googleDrive';
import { supabase } from './supabaseClient';
import { AppData, ResourceLink, BookNode, NodeType, Student } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';
import QuizModal from './components/QuizModal';
import ResourcesPanel from './components/ResourcesPanel';
import FolderSummary from './components/FolderSummary';
import Forum from './components/Forum';
import FlashcardsPanel from './components/FlashcardsPanel';
import TaskPanel from './components/TaskPanel';
import StudentLogin from './components/StudentLogin';
import StudentManager from './components/StudentManager';
import HomeworkPanel from './components/HomeworkPanel';
import { StudentSpaceModal } from './components/StudentSpaceModal';
import VdcQuestionsPanel from './components/VdcQuestionsPanel';
import ChapterReorderModal from './components/ChapterReorderModal';
import { MediaViewer, MediaViewerModal } from './components/MediaViewer';
import { uploadToImgBB } from './imgbb';
import { ConfirmModal, ToastNotification, ConfirmState, ToastState } from './components/CustomDialog';
import { getSafeEnv, SLOGANS } from './utils';

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    const props = (this as any).props;
    if (state.hasError) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
            <ShieldCheck size={48} className="mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Đã có lỗi xảy ra!</h2>
            <p className="text-sm opacity-80 max-w-md mx-auto">
              Ứng dụng gặp sự cố kỹ thuật. Vui lòng thử tải lại trang hoặc liên hệ quản trị viên.
            </p>
            <pre className="mt-4 p-3 bg-white/50 rounded-lg text-[10px] text-left overflow-auto max-h-40">
              {state.error?.message}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-indigo-600 text-white rounded-full font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return props.children;
  }
}

const TEACHER_PWD = getSafeEnv('TEACHER_PASSWORD') || '123';

const normalizeAppData = (raw: any): AppData => {
  if (!raw || typeof raw !== 'object') return INITIAL_DATA;
  return {
    nodes: Array.isArray(raw.nodes) ? raw.nodes : INITIAL_DATA.nodes,
    globalResources: Array.isArray(raw.globalResources) ? raw.globalResources : INITIAL_DATA.globalResources,
    homeUrl: typeof raw.homeUrl === 'string' ? raw.homeUrl : INITIAL_DATA.homeUrl
  };
};

const App: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('selected_grade');
      if (!saved || saved === 'null' || saved === 'undefined') return null;
      if (saved === '1') return 11; // Migrate Khối 11 from ID 1 to ID 11
      const parsed = parseInt(saved, 10);
      return isNaN(parsed) ? null : parsed;
    } catch (e) {
      return null;
    }
  });
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    // Tự động đăng nhập student nếu đã có ID lưu trong máy
    const savedId = localStorage.getItem('student_auth_id');
    if (savedId && selectedGrade) {
       Promise.resolve(supabase.from('students').select('*').eq('id', savedId).eq('grade_id', selectedGrade).maybeSingle())
         .then(({ data: sData }) => {
            if (sData) setStudent(sData);
         })
         .catch((err) => console.warn("Auto-login student failed:", err));
    }
  }, [selectedGrade]);

  const handleSelectGrade = (grade: number | null) => {
    setSelectedGrade(grade);
    if (grade === null) {
      localStorage.removeItem('selected_grade');
    } else {
      localStorage.setItem('selected_grade', grade.toString());
    }
  };

  const fetchCloudData = useCallback(async (gradeId: number, retryCount = 0) => {
    if (retryCount === 0) {
      setIsSyncing(true);
      setSyncError(null);
    }
    
    try {
      const { data: cloud, error: cloudError } = await supabase
        .from('app_settings')
        .select('data')
        .eq('id', gradeId)
        .single();
      
      if (cloudError) {
        // Fallback for Grade 11 if no data is found at ID 11, try ID 1
        if (gradeId === 11 && cloudError.code === 'PGRST116') {
             const { data: fallback, error: fbError } = await supabase.from('app_settings').select('data').eq('id', 1).single();
             if (!fbError && fallback?.data) {
                setData(normalizeAppData(fallback.data));
                setIsSyncing(false);
                return;
             }
        }

        console.error(`Cloud fetch error (Attempt ${retryCount + 1}):`, cloudError);
        
        // Nếu lỗi do mạng (FetchError) hoặc server tạm thời (5xx), thử lại tối đa 3 lần
        const isNetworkError = cloudError.message?.includes('FetchError') || 
                              (cloudError as any).status === 503 || 
                              (cloudError as any).status === 502 ||
                              (cloudError as any).status === 504 ||
                              (cloudError as any).status === 404; // Đôi khi 404 là do đường truyền ngắt quãng

        if (isNetworkError && retryCount < 2) {
          console.log(`Đang thử lại lần ${retryCount + 1}...`);
          setTimeout(() => fetchCloudData(gradeId, retryCount + 1), 2000);
          return;
        }

        // Chỉ quay về INITIAL_DATA nếu chắc chắn là bản ghi không tồn tại (PGRST116)
        if (cloudError.code === 'PGRST116') {
          setData(INITIAL_DATA);
          setIsSyncing(false);
        } else {
          // Lỗi thật sự (mạng, quyền truy cập...), không nên ghi đè INITIAL_DATA để tránh mất bài/chương
          setSyncError(`Không thể tải dữ liệu: ${cloudError.message} (Mã: ${cloudError.code})`);
          setIsSyncing(false);
          // Giữ nguyên data hiện tại hoặc để trống thay vì nạp template làm người dùng hoang mang
        }
      } else if (cloud?.data) {
        setData(normalizeAppData(cloud.data));
        setIsSyncing(false); // Thành công, tắt loading
      } else {
        setData(INITIAL_DATA);
        setIsSyncing(false);
      }
      
      // Đồng bộ lượt truy cập
      try {
        const { data: stats } = await supabase.from('app_settings').select('data').eq('id', 99).single();
        let currentCount = (stats?.data as any)?.visitorCount || 0;
        
        if (!sessionStorage.getItem('v_visited')) {
          const newCount = currentCount + 1;
          await supabase.from('app_settings').upsert({ id: 99, data: { visitorCount: newCount } });
          sessionStorage.setItem('v_visited', 'true');
          setVisitorCount(newCount);
        } else {
          setVisitorCount(currentCount);
        }
      } catch (stErr) {
        console.warn("Stats sync skipped:", stErr);
      }
    } catch (err: any) { 
      console.error("Critical fetch error:", err);
      if (retryCount < 2) {
        setTimeout(() => fetchCloudData(gradeId, retryCount + 1), 2000);
      } else {
        setSyncError("Lỗi kết nối CSDL: " + (err.message || "Không xác định"));
        setIsSyncing(false);
      }
    } finally {
      // Chỉ tắt trạng thái loading nếu đây là lần thử cuối cùng hoặc đã thành công
      // Trong trường hợp retry, setIsSyncing(false) sẽ được gọi ở lần gọi đệ quy cuối cùng
      if (retryCount >= 2) {
        setIsSyncing(false);
      }
    }
  }, []);

  // Hàm helper để kết thúc sync khi thành công (tránh gọi trong finally của các vòng lặp trung gian)
  const finishSync = (success: boolean) => {
    setIsSyncing(false);
    if (success) setSyncError(null);
  };

  useEffect(() => { 
    if (selectedGrade !== null) {
      fetchCloudData(selectedGrade); 
    }
  }, [selectedGrade, fetchCloudData]);

  const updateData = async (newData: AppData) => {
    if (selectedGrade === null) return;
    setData(newData);
    setIsSyncing(true);
    setSyncError(null);
    try { 
      const { error } = await supabase.from('app_settings').upsert({ id: selectedGrade, data: newData }); 
      // Đồng bộ cả ID 1 và ID 11 cho khối 11 để đảm bảo các thiết bị/trình duyệt cũ luôn nhận cùng dữ liệu
      if (selectedGrade === 11 || selectedGrade === 1) {
        await supabase.from('app_settings').upsert({ id: 1, data: newData });
        await supabase.from('app_settings').upsert({ id: 11, data: newData });
      }
      if (error) {
        console.error("Update error:", error);
        setSyncError("Lỗi khi lưu dữ liệu lên đám mây: " + error.message);
      }
    } catch (err: any) {
      setSyncError("Lỗi hệ thống khi lưu: " + err.message);
    } finally { 
      setIsSyncing(false); 
    }
  };

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage visitorCount={visitorCount} onSelectGrade={handleSelectGrade} selectedGrade={selectedGrade} />} />
        <Route path="/teacher" element={<ProtectedRoute><MainView isAdmin={true} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount} selectedGrade={selectedGrade} syncError={syncError} fetchCloudData={fetchCloudData} student={null} /></ProtectedRoute>} />
        <Route path="/student" element={student ? <MainView isAdmin={false} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount} selectedGrade={selectedGrade} syncError={syncError} fetchCloudData={fetchCloudData} student={student} onLogout={() => { setStudent(null); localStorage.removeItem('student_auth_id'); }} /> : <StudentLogin onLogin={setStudent} gradeId={selectedGrade || 11} themeColor={selectedGrade === 10 ? 'emerald' : selectedGrade === 12 ? 'rose' : 'indigo'} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (localStorage.getItem('teacher_auth') !== 'true') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const LandingPage: React.FC<{ visitorCount: number, onSelectGrade: (g: number) => void, selectedGrade: number | null }> = ({ visitorCount, onSelectGrade, selectedGrade }) => {
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const grades = [
    { id: 10, label: 'Khối 10', color: 'bg-emerald-600', shadow: 'shadow-emerald-100', theme: 'emerald' },
    { id: 11, label: 'Khối 11', color: 'bg-indigo-600', shadow: 'shadow-indigo-100', theme: 'indigo' },
    { id: 12, label: 'Khối 12', color: 'bg-rose-600', shadow: 'shadow-rose-100', theme: 'rose' },
  ];

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative text-center px-4">
      {selectedGrade && (
        <button 
          onClick={() => onSelectGrade(null as any)}
          className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm z-50 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> 
          Thoát ra ngoài
        </button>
      )}
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        <div className="mb-8 p-5 bg-white border border-slate-200 shadow-sm rounded-3xl">
            <Book size={48} className={selectedGrade ? (selectedGrade === 10 ? 'text-emerald-600' : selectedGrade === 12 ? 'text-rose-600' : 'text-indigo-600') : 'text-slate-400'}/>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-slate-900 uppercase mb-12 tracking-tighter">
          {selectedGrade ? `VẬT LÝ ${selectedGrade}` : 'HỆ THỐNG HỌC TẬP'}
        </h1>
        
        {!selectedGrade ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {grades.map((g) => (
              <button 
                key={g.id}
                onClick={() => onSelectGrade(g.id)}
                className="bg-white p-10 rounded-[40px] shadow-xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.05] transition-all group"
              >
                <div className={`w-16 h-16 ${g.color} rounded-2xl flex items-center justify-center shadow-lg ${g.shadow}`}>
                  <GraduationCap size={32} className="text-white"/>
                </div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{g.label}</h2>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Chọn để bắt đầu</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => navigate('/student')} className="bg-white p-12 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
              <div className={`w-20 h-20 ${selectedGrade === 10 ? 'bg-emerald-50' : selectedGrade === 12 ? 'bg-rose-50' : 'bg-sky-50'} rounded-3xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors`}>
                  <GraduationCap size={36} className={`${selectedGrade === 10 ? 'text-emerald-600' : selectedGrade === 12 ? 'text-rose-600' : 'text-sky-600'} group-hover:text-white transition-colors`}/>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">HỌC SINH</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Truy cập bài giảng & Quiz AI</p>
            </button>
            
            {!showPass ? (
              <button onClick={()=>setShowPass(true)} className="bg-white p-12 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                    <ShieldCheck size={36} className="text-amber-600 group-hover:text-white transition-colors"/>
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">GIÁO VIÊN</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Thiết lập học liệu & Quản lý</p>
              </button>
            ) : (
              <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {localStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
                className="bg-white p-10 rounded-[40px] shadow-2xl border border-amber-100 flex flex-col items-center space-y-6 animate-in zoom-in-95">
                <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-5 bg-slate-50 border-2 rounded-2xl text-center font-black text-3xl tracking-[0.5em] ${error?'border-red-400 animate-shake':'border-transparent focus:border-amber-400 outline-none'}`} placeholder="****" autoComplete="current-password"/>
                <div className="flex gap-4 w-full">
                  <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-300 uppercase text-[10px] tracking-widest">Hủy bỏ</button>
                  <button type="submit" className="flex-1 px-4 py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200 tracking-widest">Đăng nhập</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const MainView: React.FC<{ 
  isAdmin: boolean; 
  data: AppData; 
  updateData: (d: AppData) => void; 
  isSyncing: boolean; 
  visitorCount: number; 
  selectedGrade: number | null; 
  syncError: string | null; 
  fetchCloudData: (g: number) => void;
  student: Student | null;
  onLogout?: () => void;
}> = ({ isAdmin, data, updateData, isSyncing, visitorCount, selectedGrade, syncError, fetchCloudData, student, onLogout }) => {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(`selected_id_${selectedGrade}`);
      if (!saved || saved === 'null' || saved === 'undefined') return null;
      return saved;
    } catch (e) {
      return null;
    }
  });
  const [isVdcMode, setIsVdcMode] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileResourcesOpen, setIsMobileResourcesOpen] = useState<boolean>(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'tasks' | 'flashcards' | 'homework'>('content');
  const [showStudentManager, setShowStudentManager] = useState(false);
  const [isStudentSpaceOpen, setIsStudentSpaceOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(student);

  useEffect(() => {
    setCurrentStudent(student);
  }, [student]);

  const [resourceModal, setResourceModal] = useState<ResourceLink | null>(null);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  const selectedNode = useMemo(() => data?.nodes?.find(n => n.id === selectedId), [data?.nodes, selectedId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Study Tracking Logic
  useEffect(() => {
    if (!student || !selectedId || !selectedNode || selectedNode.type !== 'lesson') return;
    
    // Only track if on content or flashcards tab
    if (activeTab !== 'content' && activeTab !== 'flashcards') return;

    const type = activeTab === 'content' ? 'material' : 'flashcard';
    const startTime = Date.now();
    
    return () => {
      const endTime = Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);
      if (durationSeconds > 5) { // Only log if more than 5 seconds
        supabase.from('study_logs')
          .select('*')
          .eq('student_id', student.id)
          .eq('node_id', selectedId)
          .eq('type', type)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => {
            const existingLog = data?.[0];
            if (existingLog) {
              supabase.from('study_logs')
                .update({ 
                  duration: existingLog.duration + durationSeconds,
                  created_at: new Date().toISOString() 
                })
                .eq('id', existingLog.id)
                .then(); // Trigger execution
            } else {
              supabase.from('study_logs').insert([{
                student_id: student.id,
                node_id: selectedId,
                type: type,
                duration: durationSeconds,
                created_at: new Date().toISOString()
              }]).then(); // Trigger execution
            }
          });
      }
    };
  }, [student, selectedId, activeTab, selectedNode]);

  const formattedTime = useMemo(() => {
    return currentTime.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, [currentTime]);

  const themeColor = useMemo(() => {
    if (selectedGrade === 10) return 'emerald';
    if (selectedGrade === 12) return 'rose';
    return 'indigo';
  }, [selectedGrade]);

  const gradeTitle = useMemo(() => {
    if (selectedGrade === 10) return 'VẬT LÝ 10';
    if (selectedGrade === 11) return 'VẬT LÝ 11';
    if (selectedGrade === 12) return 'VẬT LÝ 12';
    return 'VẬT LÝ';
  }, [selectedGrade]);
  const childNodes = useMemo(() => {
    if (!selectedId || selectedNode?.type !== 'folder' || !data?.nodes) return [];
    return data.nodes.filter(n => n.parentId === selectedId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedId, data?.nodes, selectedNode?.type]);

  const visibleNodeIds = useMemo(() => {
    if (!searchTerm.trim() || !data?.nodes) return null;
    const term = searchTerm.toLowerCase();
    const matches = new Set<string>();
    
    data.nodes.forEach(node => {
      if (node.title.toLowerCase().includes(term)) {
        matches.add(node.id);
      }
    });

    const visible = new Set<string>(matches);
    matches.forEach(id => {
      let current = data.nodes.find(n => n.id === id);
      while (current && current.parentId) {
        visible.add(current.parentId);
        current = data.nodes.find(n => n.id === current.parentId);
      }
    });

    return visible;
  }, [data?.nodes, searchTerm]);

  const filteredRootNodes = useMemo(() => {
    if (!data?.nodes) return [];
    // Kiểm tra cả null và undefined để tránh mất chương do sai lệch kiểu dữ liệu
    const roots = data.nodes.filter(n => n.parentId === null || n.parentId === undefined).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    if (!visibleNodeIds) return roots;
    return roots.filter(n => visibleNodeIds.has(n.id));
  }, [data?.nodes, visibleNodeIds]);

  const isNotebookLMUrl = (url: string) => {
    if (!url) return false;
    const l = url.toLowerCase();
    return l.includes('notebook.google.com') || l.includes('notebooklm.google.com') || l.includes('notebooklm');
  };

  const formatUrlForIframe = (url: string) => {
    if (!url) return '';
    let cleanUrl = url.trim();

    if (cleanUrl.includes('drive.google.com') || cleanUrl.includes('docs.google.com')) {
      if (cleanUrl.includes('/view') || cleanUrl.includes('/edit')) {
        cleanUrl = cleanUrl.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
      } else if (!cleanUrl.includes('/preview') && cleanUrl.includes('/file/d/')) {
        cleanUrl = cleanUrl.replace(/(\/file\/d\/[^\/]+).*/, '$1/preview');
      } else if (cleanUrl.includes('open?id=')) {
        const fileId = cleanUrl.split('id=')[1]?.split('&')[0];
        if (fileId) cleanUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    if (cleanUrl.includes('youtube.com/watch?v=')) {
      const videoId = cleanUrl.split('v=')[1]?.split('&')[0];
      if (videoId) cleanUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (cleanUrl.includes('youtu.be/')) {
      const videoId = cleanUrl.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) cleanUrl = `https://www.youtube.com/embed/${videoId}`;
    }

    return cleanUrl;
  };

  useEffect(() => {
    const timer = setInterval(() => setSloganIdx(prev => (prev + 1) % SLOGANS.length), 30000);
    return () => clearInterval(timer);
  }, []);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [showChapterReorderModal, setShowChapterReorderModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: '', imageUrl: '', order: 0});

  const [showResModal, setShowResModal] = useState(false);
  const [resModalData, setResModalData] = useState<{id?: string, title: string, url: string, isGlobal: boolean}>({title: '', url: '', isGlobal: false});
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const nodeDriveInputRef = useRef<HTMLInputElement>(null);
  const nodeImageDriveInputRef = useRef<HTMLInputElement>(null);
  const resourceDriveInputRef = useRef<HTMLInputElement>(null);

  const triggerGoogleDriveUpload = async (inputRef: React.RefObject<HTMLInputElement>) => {
    try {
      if (!getDriveAccessToken()) {
        setIsUploadingDrive(true);
        await signInWithGoogleForDrive();
        setIsUploadingDrive(false);
      }
      inputRef.current?.click();
    } catch (err: any) {
      setIsUploadingDrive(false);
      showToast(err.message || 'Lỗi khi đăng nhập Google Drive.', 'error', 'Đăng nhập Google thất bại');
    }
  };

  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ isOpen: false, message: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    setToastState({ isOpen: true, message, type, title });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, isOpen: false }));
    }, 5000);
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger', confirmText?: string) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      type,
      confirmText,
      onConfirm,
    });
  };

  const handleGoogleDriveUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'node' | 'resource' | 'node_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDrive(true);
    try {
      const result = await uploadFileToGoogleDrive(file);
      const driveUrl = result.previewUrl; // https://drive.google.com/file/d/FILE_ID/preview

      if (target === 'node') {
        setNodeModalData((prev: any) => ({ ...prev, url: driveUrl, title: prev.title || file.name.replace(/\.[^/.]+$/, '') }));
      } else if (target === 'node_image') {
        setNodeModalData((prev: any) => ({ ...prev, imageUrl: driveUrl }));
      } else {
        setResModalData((prev: any) => ({ ...prev, url: driveUrl, title: prev.title || file.name.replace(/\.[^/.]+$/, '') }));
      }
      showToast(`Đã tải file "${file.name}" lên Google Drive thành công!`, 'success', 'Tải lên Google Drive');
    } catch (err: any) {
      console.error("Google Drive Upload error:", err);
      showToast(err.message || 'Lỗi khi tải lên Google Drive.', 'error', 'Tải lên thất bại');
    } finally {
      setIsUploadingDrive(false);
      e.target.value = '';
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all core tables
      const { data: appSettings } = await supabase.from('app_settings').select('*');
      const { data: quizData } = await supabase.from('quiz_data').select('*');
      const { data: flashcards } = await supabase.from('flashcards').select('*');
      const { data: forumComments } = await supabase.from('forum_comments').select('*');
      let vdcQuestions: any[] = [];
      try {
        const { data: vdc } = await supabase.from('vdc_questions').select('*');
        if (vdc) vdcQuestions = vdc;
      } catch (e) {}
      
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.3',
        tables: {
          app_settings: appSettings,
          quiz_data: quizData,
          flashcards: flashcards,
          forum_comments: forumComments,
          vdc_questions: vdcQuestions
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VatLy11_FullBackup_${new Date().toLocaleDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Đã xuất file dữ liệu thành công!", "success");
    } catch (error) {
      showToast("Lỗi khi xuất dữ liệu: " + (error instanceof Error ? error.message : String(error)), "error");
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showConfirm(
      "Xác nhận Khôi phục Dữ liệu",
      "Cảnh báo: Việc khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại trong CSDL. Bạn có chắc chắn muốn tiếp tục?",
      async () => {
        setIsImporting(true);
        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          if (!backup.tables) throw new Error("File backup không đúng định dạng.");

          // Restore app_settings
          if (backup.tables.app_settings) {
            for (const row of backup.tables.app_settings) {
              const cleanRow = { id: row.id, data: row.data };
              await supabase.from('app_settings').upsert(cleanRow).select();
            }
          }

          // Restore quiz_data
          if (backup.tables.quiz_data) {
            for (const row of backup.tables.quiz_data) {
              const cleanRow = { id: row.id || row.quizId || row.node_id, data: row.data };
              if (cleanRow.id) await supabase.from('quiz_data').upsert(cleanRow).select();
            }
          }

          // Restore flashcards
          if (backup.tables.flashcards) {
            for (const row of backup.tables.flashcards) {
              const cleanRow: any = {
                front: row.front,
                back: row.back,
                nodeId: row.nodeId || row.node_id,
                node_id: row.nodeId || row.node_id,
                createdAt: row.createdAt || row.created_at || new Date().toISOString(),
                created_at: row.createdAt || row.created_at || new Date().toISOString()
              };
              if (row.id) cleanRow.id = row.id;
              await supabase.from('flashcards').upsert(cleanRow).select();
            }
          }

          // Restore forum_comments
          if (backup.tables.forum_comments) {
            for (const row of backup.tables.forum_comments) {
              const cleanRow: any = {
                author: row.author,
                content: row.content,
                nodeId: row.nodeId || row.node_id,
                node_id: row.nodeId || row.node_id,
                isAdmin: row.isAdmin !== undefined ? row.isAdmin : row.is_admin,
                is_admin: row.isAdmin !== undefined ? row.isAdmin : row.is_admin,
                imageUrl: row.imageUrl || row.image_url,
                image_url: row.imageUrl || row.image_url,
                createdAt: row.createdAt || row.created_at || new Date().toISOString(),
                created_at: row.createdAt || row.created_at || new Date().toISOString()
              };
              if (row.id) cleanRow.id = row.id;
              await supabase.from('forum_comments').upsert(cleanRow).select();
            }
          }

          // Restore vdc_questions
          if (backup.tables.vdc_questions && Array.isArray(backup.tables.vdc_questions)) {
            for (const row of backup.tables.vdc_questions) {
              try {
                await supabase.from('vdc_questions').upsert(row).select();
              } catch (vdcErr) {}
            }
          }

          showToast("Khôi phục dữ liệu thành công! Hãy tải lại trang.", "success");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          showToast("Lỗi khi khôi phục dữ liệu: " + (error instanceof Error ? error.message : String(error)), "error");
        } finally {
          setIsImporting(false);
        }
      },
      "warning",
      "Khôi phục ngay"
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'node' | 'resource' | 'node_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit 50MB
    if (file.size > 50 * 1024 * 1024) {
      showToast("File quá lớn! Giới hạn 50MB.", "error");
      return;
    }

    setIsUploading(true);
    try {
      // Nếu là tải ảnh bài học, ưu tiên tải lên ImgBB trước
      if (target === 'node_image') {
        try {
          const imgbb = await uploadToImgBB(file);
          if (imgbb && imgbb.url) {
            setNodeModalData({ ...nodeModalData, imageUrl: imgbb.url });
            showToast("Đã tải ảnh lên ImgBB thành công!", "success");
            setIsUploading(false);
            return;
          }
        } catch (imgbbErr) {
          console.warn("ImgBB upload failed, falling back to Supabase:", imgbbErr);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resources')
        .upload(filePath, file);

      if (uploadError) {
        console.error("Supabase Upload Error:", uploadError);
        throw new Error(uploadError.message || "Lỗi không xác định từ server.");
      }

      const { data: { publicUrl } } = supabase.storage
        .from('resources')
        .getPublicUrl(filePath);

      if (target === 'node') {
        setNodeModalData({ ...nodeModalData, url: publicUrl });
      } else if (target === 'node_image') {
        setNodeModalData({ ...nodeModalData, imageUrl: publicUrl });
      } else {
        setResModalData({ ...resModalData, url: publicUrl });
      }
      
      showToast("Tải file lên thành công!", "success");
    } catch (error: any) {
      console.error("Upload process error:", error);
      showToast(`Lỗi khi tải file: ${error.message || "Kiểm tra kết nối."}`, "error");
    } finally {
      setIsUploading(false);
    }
  };
  
  const [showHomeConfig, setShowHomeConfig] = useState(false);
  const [tempHomeUrl, setTempHomeUrl] = useState(data.homeUrl || '');

  useEffect(() => {
    if (showHomeConfig) {
      setTempHomeUrl(data.homeUrl || '');
    }
  }, [showHomeConfig, data.homeUrl]);

  const handleDeleteNode = (id: string) => {
    showConfirm(
      "Xác nhận xóa thư mục / bài học",
      "Xóa thư mục/bài học này? Hệ thống sẽ xóa cả các mục con bên trong.",
      () => {
        const getChildIds = (parentId: string): string[] => {
          const children = (data?.nodes || []).filter(n => n.parentId === parentId);
          return [parentId, ...children.flatMap(c => getChildIds(c.id))];
        };
        const idsToDelete = getChildIds(id);
        const newData = {...data, nodes: (data?.nodes || []).filter(n => !idsToDelete.includes(n.id))};
        updateData(newData);
        if(selectedId && idsToDelete.includes(selectedId)) setSelectedId(null);
        showToast("Đã xóa mục bài học thành công", "success");
      },
      "danger",
      "Xóa vĩnh viễn"
    );
  };

  const handleReorderNode = (id: string, direction: 'up' | 'down') => {
    const node = data?.nodes?.find(n => n.id === id);
    if (!node) return;

    const isRoot = node.parentId === null || node.parentId === undefined;
    const siblings = (data?.nodes || [])
      .filter(n => isRoot ? (n.parentId === null || n.parentId === undefined) : n.parentId === node.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const currentIndex = siblings.findIndex(n => n.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const targetNode = siblings[targetIndex];
    // Reorder in a new array
    const reorderedSiblings = [...siblings];
    reorderedSiblings[currentIndex] = targetNode;
    reorderedSiblings[targetIndex] = node;

    const orderMap = new Map<string, number>();
    reorderedSiblings.forEach((s, idx) => {
      orderMap.set(s.id, idx);
    });

    const newNodes = (data?.nodes || []).map(n => {
      if (orderMap.has(n.id)) {
        return { ...n, order: orderMap.get(n.id)! };
      }
      return n;
    });

    updateData({ ...data, nodes: newNodes });
    showToast(`Đã chuyển ${node.type === 'folder' ? 'chương' : 'bài'} "${node.title}" ${direction === 'up' ? 'lên' : 'xuống'}!`, "success");
  };

  const handleMoveNode = (id: string, direction: 'in' | 'out') => {
    const node = data?.nodes?.find(n => n.id === id);
    if (!node) return;

    let newParentId = node.parentId;
    const siblings = (data?.nodes || []).filter(n => n.parentId === node.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const currentIndex = siblings.findIndex(n => n.id === id);

    if (direction === 'in') {
      // Move into the folder sibling immediately above
      const prevSibling = siblings[currentIndex - 1];
      if (prevSibling && prevSibling.type === 'folder') {
        newParentId = prevSibling.id;
      } else {
        return; // No folder above to move into
      }
    } else if (direction === 'out') {
      // Move out to be a sibling of the current parent
      if (node.parentId === null) return; // Already at root
      const parentNode = data.nodes.find(n => n.id === node.parentId);
      newParentId = parentNode ? parentNode.parentId : null;
    }

    const newNodes = (data?.nodes || []).map(n => {
      if (n.id === id) {
        const newSiblings = (data?.nodes || []).filter(sn => sn.parentId === newParentId);
        return { ...n, parentId: newParentId, order: newSiblings.length };
      }
      return n;
    });

    updateData({ ...data, nodes: newNodes });
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if(!resModalData.title || !resModalData.url) return;
    const newData = {...data};
    const resId = resModalData.id || `res-${Date.now()}`;
    const newRes = { id: resId, title: resModalData.title, url: resModalData.url };
    if(resModalData.isGlobal) {
      if(resModalData.id) newData.globalResources = newData.globalResources.map(r => r.id === resId ? newRes : r);
      else newData.globalResources.push(newRes);
    } else {
      if(!selectedId) return;
      newData.nodes = (data?.nodes || []).map(n => {
        if(n.id === selectedId) {
          let updatedRes = [...(n.lessonResources || [])];
          if(resModalData.id) updatedRes = updatedRes.map(r => r.id === resId ? newRes : r);
          else updatedRes.push(newRes);
          return {...n, lessonResources: updatedRes};
        }
        return n;
      });
    }
    updateData(newData);
    setShowResModal(false);
  };

  const handleDeleteResource = (id: string, title: string, isGlobal: boolean) => {
    showConfirm(
      "Xác nhận xóa học liệu",
      `Bạn có chắc chắn muốn xóa học liệu: "${title}"?`,
      () => {
        const newData = {...data};
        if(isGlobal) newData.globalResources = (data?.globalResources || []).filter(r => r.id !== id);
        else newData.nodes = (data?.nodes || []).map(n => n.id === selectedId ? {...n, lessonResources: (n.lessonResources || []).filter(r => r.id !== id)} : n);
        updateData(newData);
        showToast("Đã xóa học liệu thành công", "success");
      },
      "danger",
      "Xóa học liệu"
    );
  };

  const handleSaveHomeConfig = () => {
    updateData({...data, homeUrl: tempHomeUrl});
    setShowHomeConfig(false);
    showToast("Đã lưu cấu hình cài đặt thành công!", "success");
  };

  const handleSelectNode = (id: string | null, tab: 'content' | 'flashcards' | 'tasks' | 'homework' = 'content') => {
    setIsVdcMode(false);
    setSelectedId(id);
    setActiveTab(tab);
    setIsMobileSidebarOpen(false);
    if (id) {
      localStorage.setItem(`selected_id_${selectedGrade}`, id);
      if (data.nodes.find(n => n.id === id)?.url) setIframeLoading(true);
    } else {
      localStorage.removeItem(`selected_id_${selectedGrade}`);
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden font-sans bg-white text-slate-900 transition-colors duration-300 relative">
      {isQuizOpen && selectedNode && (
        <QuizModal 
          nodeId={selectedId!}
          lessonTitle={selectedNode.title} 
          lessonUrl={selectedNode.url}
          isAdmin={isAdmin}
          selectedGrade={selectedGrade}
          themeColor={themeColor}
          student={student}
          onClose={() => setIsQuizOpen(false)} 
        />
      )}
      
      {/* MOBILE BACKDROP FOR SIDEBAR */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)} 
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 animate-in fade-in duration-200" 
        />
      )}

      {/* PANEL 1: SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#fbfcfd] border-r border-slate-100 flex flex-col shrink-0 shadow-2xl transition-transform duration-300 md:relative md:w-[230px] md:translate-x-0 md:shadow-none md:z-auto ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <header className={`px-4 sm:px-5 py-3.5 sm:py-4 text-white ${isAdmin ? 'bg-amber-600' : `bg-${themeColor}-600`} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 min-w-0">
            <Book size={16} className="shrink-0"/>
            <h1 className="font-bold text-[9px] uppercase tracking-[0.2em] truncate">
              Cấu trúc sách - Lớp {selectedGrade === 1 ? '11' : selectedGrade}
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && <button onClick={()=>setShowHomeConfig(true)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Cấu hình trang chủ"><Settings size={14}/></button>}
            {isAdmin && (
              <button 
                onClick={() => setShowChapterReorderModal(true)} 
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1" 
                title="Sắp xếp thứ tự các chương"
              >
                <ListOrdered size={14}/>
              </button>
            )}
            {isAdmin && <button onClick={()=>{
              const nextOrder = (data?.nodes || []).filter(n => n.parentId === null || n.parentId === undefined).length;
              setNodeModalData({parentId:null, type:'folder', title:'', url:'', imageUrl: '', order: nextOrder}); 
              setShowNodeModal(true);
            }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Thêm chương mới"><Plus size={14}/></button>}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-1.5 hover:bg-white/20 rounded-lg text-white ml-0.5"
              title="Đóng menu sách"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="p-3 shrink-0 bg-[#fbfcfd] space-y-2">
          {/* NÚT KHO VDC & CÂU HỎI HAY */}
          <button
            onClick={() => {
              setIsVdcMode(true);
              setSelectedId(null);
              setIsMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left group shadow-xs ${
              isVdcMode
                ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-600 text-white shadow-md shadow-rose-200 ring-2 ring-rose-400'
                : 'bg-gradient-to-r from-amber-50 to-rose-50/80 hover:from-amber-100 hover:to-rose-100 text-slate-800 border border-amber-200/80'
            }`}
          >
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <Sparkles size={13} className={isVdcMode ? "text-amber-300 fill-amber-300 animate-pulse" : "text-rose-500 fill-rose-500"} />
              <span>Kho VDC & Sưu tầm</span>
            </span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight ${
              isVdcMode ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
            }`}>
              9+
            </span>
          </button>

          <div className={`flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-${themeColor}-400 transition-all`}>
            <Search size={12} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm bài..." className="bg-transparent border-none outline-none text-[10px] font-medium w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#fbfcfd]">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              visibleNodeIds={visibleNodeIds}
              searchTerm={searchTerm}
              themeColor={themeColor}
              onSelect={handleSelectNode}
              onAdd={(p,t)=>{
                const nextOrder = data.nodes.filter(n => n.parentId === p).length;
                setNodeModalData({parentId:p, type:t, title:'', url:'', imageUrl: '', order: nextOrder}); 
                setShowNodeModal(true);
              }}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={handleDeleteNode}
              onReorder={handleReorderNode}
              onMove={handleMoveNode}/>
          ))}
        </div>

        <footer className="p-3 border-t border-slate-100 bg-white shrink-0">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{visitorCount} View</span>
                <button onClick={()=>{if(isAdmin)localStorage.removeItem('teacher_auth'); if(onLogout) onLogout(); navigate('/');}} className="flex items-center gap-1 text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">
                  <LogOut size={9}/> Thoát
                </button>
             </div>
             {currentStudent && (
               <button 
                 onClick={() => setIsStudentSpaceOpen(true)}
                 className="w-full flex items-center gap-2 p-2 bg-indigo-50/70 hover:bg-indigo-100/90 rounded-xl border border-indigo-100 transition-all text-left group"
                 title="Nhấn để mở Góc học tập cá nhân & Đổi mật khẩu"
               >
                  <div className="w-6 h-6 bg-indigo-600 group-hover:bg-indigo-700 rounded-full flex items-center justify-center text-white text-[8px] font-black shadow-sm shrink-0 transition-colors">
                    {currentStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-slate-800 truncate uppercase tracking-tight group-hover:text-indigo-700">{currentStudent.full_name || currentStudent.name}</p>
                    <p className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                      {currentStudent.is_guest ? 'Khách' : 'Góc học tập cá nhân'}
                    </p>
                  </div>
                  <ChevronRight size={12} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
               </button>
             )}
        </footer>
      </aside>

      {/* PANEL 2: MAIN CONTENT */}
      <main className="flex-1 w-full min-w-0 flex flex-col overflow-hidden relative bg-white transition-all">
        {/* MOBILE TOP NAVIGATION BAR (md:hidden) */}
        <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200 shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs`}
              title="Mở menu sách"
            >
              <Menu size={16} className={`text-${themeColor}-600`} />
              <span className="text-[10px] font-black uppercase tracking-wider">Menu</span>
            </button>
            <div className="min-w-0">
              <h2 className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">
                {isVdcMode ? "Kho VDC & Sưu tầm" : (selectedNode?.title || gradeTitle)}
              </h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate">
                Lớp {selectedGrade === 1 ? '11' : selectedGrade} {isAdmin ? '• Giáo viên' : (student ? `• ${student.full_name || student.name}` : '')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isVdcMode && (
              <button
                onClick={() => setIsMobileResourcesOpen(true)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                  (selectedNode?.lessonResources?.length || 0) + (data.globalResources?.length || 0) > 0
                    ? `bg-${themeColor}-50 border-${themeColor}-200 text-${themeColor}-700`
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
                title="Mở bảng học liệu"
              >
                <Paperclip size={13} />
                <span className="font-extrabold hidden sm:inline">Học liệu</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white font-black shadow-xs">
                  {(selectedNode?.lessonResources?.length || 0) + (data.globalResources?.length || 0)}
                </span>
              </button>
            )}
          </div>
        </div>
        {syncError && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <AlertCircle size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">Lỗi kết nối bộ nhớ đám mây</p>
                <p className="text-[11px] text-red-600 font-medium">{syncError}</p>
              </div>
            </div>
            <button 
              onClick={() => fetchCloudData(selectedGrade!)} 
              className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-red-700 transition-all"
            >
              Thử lại
            </button>
          </div>
        )}
        {isVdcMode ? (
          <VdcQuestionsPanel
            isAdmin={isAdmin}
            selectedGrade={selectedGrade}
            nodes={data?.nodes || []}
            themeColor={themeColor}
            onBackToLessons={() => setIsVdcMode(false)}
            showToast={showToast}
            showConfirm={showConfirm}
          />
        ) : selectedId ? (
          <>
            {selectedNode?.type === 'folder' ? (
              <FolderSummary 
                folder={selectedNode} 
                children={childNodes} 
                onSelectLesson={handleSelectNode} 
                themeColor={themeColor}
              />
            ) : (
              <>
                <header className={`px-4 sm:px-6 ${activeTab === 'content' ? 'pt-3 pb-0 sm:pt-4 sm:pb-0' : 'py-3 sm:py-4'} border-b border-slate-100 shrink-0 bg-white`}>
                  <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 mr-2 sm:mr-4">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight truncate mb-0.5">{selectedNode?.title}</h2>
                      <p key={sloganIdx} className="text-[9px] font-medium text-slate-400 uppercase tracking-widest opacity-80 italic animate-in slide-in-from-left-4 duration-1000 truncate">
                        {SLOGANS[sloganIdx]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-2">
                        {isAdmin ? (
                            <button 
                              onClick={()=>setIsQuizOpen(true)} 
                              className="group flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-indigo-600 text-white font-bold text-[9px] sm:text-[10px] uppercase shadow-lg shadow-indigo-100 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all"
                            >
                            <Zap size={13} className="fill-current text-amber-300"/> Soạn Quiz AI
                          </button>
                        ) : (
                          <>
                            {currentStudent && (
                              <button 
                                onClick={()=>setIsStudentSpaceOpen(true)} 
                                className="group flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-[9px] sm:text-[10px] uppercase shadow-lg shadow-indigo-100 rounded-full hover:scale-105 transition-all"
                              >
                                <GraduationCap size={13} className="text-amber-300"/> <span className="hidden sm:inline">Góc học tập</span>
                              </button>
                            )}
                            <button 
                              onClick={()=>setIsQuizOpen(true)} 
                              className={`group flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 bg-${themeColor}-600 text-white font-bold text-[9px] sm:text-[10px] uppercase shadow-lg shadow-${themeColor}-100 rounded-full hover:bg-${themeColor}-700 hover:scale-105 transition-all`}
                            >
                              <BrainCircuit size={13}/> Rèn luyện
                            </button>
                          </>
                        )}
                      </div>
                      {selectedNode?.url && <button onClick={()=>window.open(selectedNode.url, '_blank')} className={`p-2 bg-slate-50 text-slate-400 hover:text-${themeColor}-600 rounded-full hover:bg-${themeColor}-50 transition-colors`}><Maximize2 size={16}/></button>}
                    </div>
                  </div>
                  
                  <div className={`flex justify-between items-center ${activeTab === 'content' ? 'mt-2' : 'mt-3'}`}>
                    <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar py-0.5">
                      <button onClick={()=>setActiveTab('content')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab==='content' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Học liệu</button>
                      <button onClick={()=>setActiveTab('flashcards')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab==='flashcards' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Flashcards</button>
                      {(isAdmin || student) && (
                        <button onClick={()=>setActiveTab('tasks')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab==='tasks' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Nhiệm vụ</button>
                      )}
                      {(isAdmin || student) && (
                        <button onClick={()=>setActiveTab('homework')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab==='homework' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Bài tập về nhà</button>
                      )}
                    </div>
                    <div className="hidden sm:block pb-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60 shrink-0">
                      {formattedTime}
                    </div>
                  </div>
                </header>
                
                <div className={`flex-1 relative overflow-y-auto custom-scrollbar bg-[#fcfdfe] ${activeTab === 'content' ? 'p-0' : 'p-3 sm:p-6'}`}>
                  {activeTab === 'content' ? (
                    <div className="h-full relative">
                      {selectedNode?.url ? (
                        <MediaViewer
                          url={selectedNode.url}
                          title={selectedNode.title}
                          themeColor={themeColor}
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center italic text-slate-200 text-xl font-light tracking-widest">Nội dung chưa cập nhật...</div>
                      )}
                    </div>
                  ) : activeTab === 'flashcards' ? (
                    <FlashcardsPanel nodeId={selectedId!} isAdmin={isAdmin} themeColor={themeColor} gradeId={selectedGrade} />
                  ) : activeTab === 'tasks' ? (
                    <TaskPanel 
                      nodeId={selectedId!} 
                      student={student} 
                      isAdmin={isAdmin} 
                      themeColor={themeColor} 
                      gradeId={selectedGrade}
                    />
                  ) : (
                    <HomeworkPanel 
                      nodeId={selectedId!} 
                      student={student} 
                      isAdmin={isAdmin} 
                      themeColor={themeColor} 
                      gradeId={selectedGrade}
                    />
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
             {data.homeUrl ? (
               <iframe src={data.homeUrl} className="w-full h-full border-none" title="Trang chủ" />
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                 <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6 border border-slate-100">
                    <Book size={48} className={`text-${themeColor}-600 opacity-10`}/>
                 </div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 opacity-5">{gradeTitle}</h2>
                 <p className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.4em] mt-4">Chọn bài học để bắt đầu</p>
               </div>
             )}
          </div>
        )}
      </main>

      {/* PANEL 3: RESOURCES (DESKTOP lg+) */}
      {!isVdcMode && (
        <ResourcesPanel 
          isAdmin={isAdmin} 
          selectedId={selectedId} 
          lessonResources={selectedNode?.lessonResources||[]} 
          globalResources={data.globalResources}
          themeColor={themeColor}
          className="hidden lg:flex w-56 border-l border-slate-50 bg-[#fbfcfd] flex-col shrink-0 overflow-y-auto custom-scrollbar transition-all"
          onAdd={(isG)=> {setResModalData({title:'', url:'', isGlobal: isG}); setShowResModal(true);}}
          onEdit={(r,isG)=> {setResModalData({...r, isGlobal: isG}); setShowResModal(true);}}
          onDelete={handleDeleteResource}
          onViewResource={(r)=> setResourceModal(r)}
        />
      )}

      {/* MOBILE DRAWER: RESOURCES (< lg) */}
      {isMobileResourcesOpen && !isVdcMode && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div 
            onClick={() => setIsMobileResourcesOpen(false)} 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200" 
          />
          <div className="relative z-10 w-72 sm:w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <ResourcesPanel 
              isAdmin={isAdmin} 
              selectedId={selectedId} 
              lessonResources={selectedNode?.lessonResources||[]} 
              globalResources={data.globalResources}
              themeColor={themeColor}
              className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar bg-white"
              onClose={() => setIsMobileResourcesOpen(false)}
              onAdd={(isG)=> {setResModalData({title:'', url:'', isGlobal: isG}); setShowResModal(true);}}
              onEdit={(r,isG)=> {setResModalData({...r, isGlobal: isG}); setShowResModal(true);}}
              onDelete={handleDeleteResource}
              onViewResource={(r)=> setResourceModal(r)}
            />
          </div>
        </div>
      )}

      {/* MODAL VIEW RESOURCE */}
      {resourceModal && (
        <MediaViewerModal
          url={resourceModal.url}
          title={resourceModal.title}
          themeColor={themeColor}
          onClose={() => setResourceModal(null)}
        />
      )}


      {/* MODAL SETTINGS & DATA */}
      {showHomeConfig && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-lg space-y-6 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-amber-600 uppercase text-[11px] tracking-widest border-b pb-4">Cài đặt Admin & Dữ liệu</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Học sinh & Lớp học</h4>
                <div className="space-y-2">
                   <button 
                     onClick={() => setShowStudentManager(true)}
                     className={`w-full flex items-center justify-between p-4 bg-${themeColor}-50 text-${themeColor}-700 rounded-2xl hover:bg-${themeColor}-100 transition-all text-[11px] font-black uppercase tracking-widest border border-${themeColor}-100`}
                   >
                     <span className="flex items-center gap-3"><Users size={18}/> Quản lý Học sinh</span>
                     <ArrowRight size={14} />
                   </button>
                   <p className="text-[8px] text-slate-400 px-1">Cấp tài khoản & Mật khẩu cho học sinh ở khối này.</p>
                </div>
                
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2">Trang chủ</h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Link trang chủ (URL)</label>
                  <input value={tempHomeUrl} onChange={e=>setTempHomeUrl(e.target.value)} className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-amber-400 transition-all" placeholder="https://..."/>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dữ liệu dự phòng</h4>
                <div className="space-y-2">
                  <button 
                    onClick={exportData}
                    disabled={isExporting}
                    className="w-full flex items-center justify-between p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    <span className="flex items-center gap-2"><Globe size={14}/> {isExporting ? 'Đang xuất...' : 'Tải Sao lưu (.json)'}</span>
                    <Upload size={14} className="rotate-180" />
                  </button>

                  <label className="cursor-pointer block">
                    <div className="w-full flex items-center justify-between p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all text-[10px] font-black uppercase tracking-widest">
                      <span className="flex items-center gap-2"><Zap size={14}/> {isImporting ? 'Đang nạp...' : 'Khôi phục từ file'}</span>
                      <Upload size={14} />
                    </div>
                    <input type="file" className="hidden" accept=".json" onChange={importData} disabled={isImporting} />
                  </label>
                  <p className="text-[8px] text-red-400 font-bold px-1 uppercase tracking-tight">* Khôi phục sẽ ghi đè dữ liệu dự án mới.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-2 border-t pt-4">
                <button type="button" onClick={()=>setShowHomeConfig(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Đóng</button>
                <button onClick={handleSaveHomeConfig} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200 tracking-widest">Lưu trang chủ</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS CẤU TRÚC BÀI HỌC */}
      {showStudentManager && (
         <StudentManager 
           gradeId={selectedGrade || 1} 
           themeColor={themeColor} 
           onClose={() => setShowStudentManager(false)} 
         />
      )}
      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={(e)=>{
            e.preventDefault(); 
            if(!nodeModalData.title) return; 
            let nodes = [...data.nodes]; 
            if(nodeModalData.id) {
              nodes = nodes.map(n => n.id === nodeModalData.id ? {...n, title: nodeModalData.title, url: nodeModalData.url, type: nodeModalData.type, imageUrl: nodeModalData.imageUrl} : n);
            } else {
              // Gắn mã khối (selectedGrade) vào trước ID để đảm bảo tính duy nhất trên toàn hệ thống
              const uniqueId = `g${selectedGrade || 0}-${Date.now()}`;
              nodes.push({id: uniqueId, ...nodeModalData, lessonResources: []});
            } 
            updateData({...data, nodes}); 
            setShowNodeModal(false);
          }}
            className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className={`font-black text-center text-${themeColor}-600 uppercase text-[11px] tracking-widest mb-2`}>Cấu trúc bài học</h3>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'folder'})} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='folder' ? 'bg-white shadow-xs text-amber-600 ring-1 ring-amber-200' : 'text-slate-400 hover:text-slate-600'}`}>
                <Folder size={14}/> Thư mục / Chương (Hiện trên VDC)
              </button>
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'lesson'})} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='lesson' ? 'bg-white shadow-xs text-sky-600 ring-1 ring-sky-200' : 'text-slate-400 hover:text-slate-600'}`}>
                <Globe size={14}/> Bài học
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề</label>
              <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className={`w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder={nodeModalData.type==='folder'?'Tên chương / thư mục (sẽ hiện trên menu sách & kho VDC)...':'Tên bài học...'}/>
            </div>
            {nodeModalData.type === 'lesson' && (
              <>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center flex-wrap gap-2">
                    <span>Link tài liệu (Iframe)</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerGoogleDriveUpload(nodeDriveInputRef)}
                        disabled={isUploadingDrive}
                        className="cursor-pointer text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-black bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 transition-all"
                      >
                        <Cloud size={11}/> {isUploadingDrive ? 'Đang lên Drive...' : 'Tải lên Google Drive'}
                      </button>
                      <input ref={nodeDriveInputRef} type="file" className="hidden" onChange={(e) => handleGoogleDriveUpload(e, 'node')} disabled={isUploadingDrive}/>
                      <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 transition-all">
                        <Upload size={11}/> {isUploading ? 'Đang tải...' : 'File máy'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'node')} disabled={isUploading}/>
                      </label>
                    </div>
                  </label>
                  <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="https://drive.google.com/file/d/.../preview hoặc link tài liệu..."/>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center flex-wrap gap-2">
                    <span className="flex items-center gap-1"><ImageIcon size={10}/> Link hình ảnh bài học</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => triggerGoogleDriveUpload(nodeImageDriveInputRef)}
                        disabled={isUploadingDrive}
                        className="cursor-pointer text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-black bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 transition-all"
                      >
                        <Cloud size={11}/> {isUploadingDrive ? 'Đang lên Drive...' : 'Up Google Drive'}
                      </button>
                      <input ref={nodeImageDriveInputRef} type="file" className="hidden" onChange={(e) => handleGoogleDriveUpload(e, 'node_image')} disabled={isUploadingDrive} accept="image/*"/>
                      <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 transition-all">
                        <Upload size={11}/> {isUploading ? 'Đang tải...' : 'File máy'}
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'node_image')} disabled={isUploading} accept="image/*"/>
                      </label>
                    </div>
                  </label>
                  <input value={nodeModalData.imageUrl || ''} onChange={e=>setNodeModalData({...nodeModalData, imageUrl:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="https://anh-minh-hoa.png"/>
                </div>
              </>
            )}
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button type="submit" className={`flex-1 py-3 bg-${themeColor}-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-${themeColor}-100 tracking-widest`}>Lưu lại</button>
            </div>
          </form>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleSaveResource}
            className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className={`font-black text-center text-${themeColor}-600 uppercase text-[11px] tracking-widest mb-2`}>Quản lý Học liệu</h3>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề tài liệu</label>
              <input autoFocus value={resModalData.title} onChange={e=>setResModalData({...resModalData, title:e.target.value})} className={`w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="Ví dụ: Video thí nghiệm..."/>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center flex-wrap gap-2">
                <span>Đường dẫn (URL)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerGoogleDriveUpload(resourceDriveInputRef)}
                    disabled={isUploadingDrive}
                    className="cursor-pointer text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-black bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 transition-all"
                  >
                    <Cloud size={11}/> {isUploadingDrive ? 'Đang lên Drive...' : 'Tải lên Google Drive'}
                  </button>
                  <input ref={resourceDriveInputRef} type="file" className="hidden" onChange={(e) => handleGoogleDriveUpload(e, 'resource')} disabled={isUploadingDrive}/>
                  <label className="cursor-pointer text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 transition-all">
                    <Upload size={11}/> {isUploading ? 'Đang tải...' : 'File máy'}
                    <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'resource')} disabled={isUploading}/>
                  </label>
                </div>
              </label>
              <input value={resModalData.url} onChange={e=>setResModalData({...resModalData, url:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="https://drive.google.com/file/d/.../preview"/>
            </div>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowResModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button type="submit" className={`flex-1 py-3 bg-${themeColor}-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-${themeColor}-100 tracking-widest`}>Lưu tài liệu</button>
            </div>
          </form>
        </div>
      )}

      {currentStudent && (
        <StudentSpaceModal
          isOpen={isStudentSpaceOpen}
          onClose={() => setIsStudentSpaceOpen(false)}
          student={currentStudent}
          data={data}
          themeColor={themeColor}
          selectedGrade={selectedGrade}
          onSelectLessonAndTab={(lessonId, tab) => {
            setSelectedId(lessonId);
            setActiveTab(tab);
          }}
          onStudentUpdated={(updated) => {
            setCurrentStudent(updated);
          }}
        />
      )}

      <ChapterReorderModal
        isOpen={showChapterReorderModal}
        onClose={() => setShowChapterReorderModal(false)}
        nodes={data?.nodes || []}
        onReorderChapter={handleReorderNode}
        themeColor={themeColor}
        selectedGrade={selectedGrade}
      />

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
      <ToastNotification state={toastState} onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        iframe { background: white; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
