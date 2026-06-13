
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { Book, Plus, Maximize2, Loader2, BrainCircuit, GraduationCap, ShieldCheck, Search, LogOut, Folder, Globe, Zap, Image as ImageIcon, Settings, ArrowLeft, ArrowRight, Upload, AlertCircle, Users } from 'lucide-react';
import { supabase } from './supabaseClient';
import { AppData, ResourceLink, BookNode, NodeType, Student, Subject } from './types';
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
import { SuperAdminView } from './components/SuperAdminView';
import { TopHorizontalNavbar } from './components/TopHorizontalNavbar';
import ConfirmModal from './components/ConfirmModal';

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
const SUPER_ADMIN_PWD = getSafeEnv('SUPER_ADMIN_PASSWORD') || 'super123';

const DEFAULT_SUBJECTS: Subject[] = [
  { id: 10, label: 'Vật Lý 10', color: 'bg-emerald-600', shadow: 'shadow-emerald-100', theme: 'emerald', password: '123' },
  { id: 11, label: 'Vật Lý 11', color: 'bg-indigo-600', shadow: 'shadow-indigo-100', theme: 'indigo', password: '123' },
  { id: 12, label: 'Vật Lý 12', color: 'bg-rose-600', shadow: 'shadow-rose-100', theme: 'rose', password: '123' },
];

const App: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem('subjects_config');
    return saved ? JSON.parse(saved) : DEFAULT_SUBJECTS;
  });

  const [selectedGrade, setSelectedGrade] = useState<number | null>(() => {
    const saved = localStorage.getItem('selected_grade');
    if (saved === '1') return 11; // Migrate Khối 11 from ID 1 to ID 11
    return saved ? parseInt(saved) : null;
  });
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchSubjectsConfig = async () => {
      try {
        const { data: config, error } = await supabase
          .from('app_settings')
          .select('data')
          .eq('id', 999)
          .maybeSingle();
        if (!error && config?.data?.subjects) {
          setSubjects(config.data.subjects);
          localStorage.setItem('subjects_config', JSON.stringify(config.data.subjects));
        } else if (!config?.data?.subjects) {
          // If not configured, initialize default subjects in DB
          await supabase
            .from('app_settings')
            .upsert({ id: 999, data: { subjects: DEFAULT_SUBJECTS } });
        }
      } catch (err) {
        console.error('Error fetching subjects config:', err);
      }
    };
    fetchSubjectsConfig();
  }, []);

  const handleSaveSubjects = async (updated: Subject[]) => {
    setSubjects(updated);
    localStorage.setItem('subjects_config', JSON.stringify(updated));
    try {
      await supabase.from('app_settings').upsert({ id: 999, data: { subjects: updated } });
    } catch (err) {
      console.error("Error saving subjects config in DB:", err);
    }
  };


  useEffect(() => {
    // Tự động đăng nhập student nếu đã có ID lưu trong máy
    const savedId = localStorage.getItem('student_auth_id');
    if (savedId && selectedGrade) {
       supabase.from('students').select('*').eq('id', savedId).eq('grade_id', selectedGrade).maybeSingle()
         .then(({ data: sData }) => {
            if (sData) setStudent(sData);
         });
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
                setData(fallback.data);
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
        setData(cloud.data);
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
        <Route path="/" element={<LandingPage visitorCount={visitorCount} onSelectGrade={handleSelectGrade} selectedGrade={selectedGrade} subjects={subjects} />} />
        <Route path="/super" element={<SuperProtectedRoute><SuperAdminView subjects={subjects} onSaveSubjects={handleSaveSubjects} visitorCount={visitorCount} /></SuperProtectedRoute>} />
        <Route path="/teacher" element={<ProtectedRoute><MainView isAdmin={true} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount} selectedGrade={selectedGrade} syncError={syncError} fetchCloudData={fetchCloudData} student={null} subjects={subjects} onSaveSubjects={handleSaveSubjects} /></ProtectedRoute>} />
        <Route path="/student" element={student ? <MainView isAdmin={false} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount} selectedGrade={selectedGrade} syncError={syncError} fetchCloudData={fetchCloudData} student={student} onLogout={() => { setStudent(null); localStorage.removeItem('student_auth_id'); }} subjects={subjects} onSaveSubjects={handleSaveSubjects} /> : <StudentLogin onLogin={setStudent} gradeId={selectedGrade || 11} themeColor={subjects.find(s => s.id === selectedGrade)?.theme || 'indigo'} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (localStorage.getItem('teacher_auth') !== 'true') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SuperProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (localStorage.getItem('super_auth') !== 'true') return <Navigate to="/" replace />;
  return <>{children}</>;
};


const LandingPage: React.FC<{ visitorCount: number, onSelectGrade: (g: number) => void, selectedGrade: number | null, subjects: Subject[] }> = ({ visitorCount, onSelectGrade, selectedGrade, subjects }) => {
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  // State for active general subject group (e.g. "Vật Lý")
  const [activeSubjectGroup, setActiveSubjectGroup] = useState<string | null>(null);

  // Group subjects by group name dynamically (case-insensitive and unicode-normalized)
  const groupedSubjects = useMemo(() => {
    const groups: { [key: string]: Subject[] } = {};
    const displayNames: { [key: string]: string } = {}; // lowercase key -> display name

    subjects.forEach(sub => {
      const normalized = sub.label.normalize("NFC").replace(/\s+/g, ' ').trim();
      const regex = /^(.*?)\s+(?:Lớp|Khối|K)?\s*(10|11|12|9|8|7|6)$/i;
      const match = normalized.match(regex);
      const groupName = match ? match[1].trim() : normalized;
      const lowerKey = groupName.toLowerCase();

      // Store a high quality display name for this group (prefer capitalized if available)
      if (!displayNames[lowerKey]) {
        displayNames[lowerKey] = groupName;
      } else {
        // If the new one starts with uppercase, prefer it as the default display title
        const current = displayNames[lowerKey];
        if (groupName !== current && groupName[0] === groupName[0].toUpperCase()) {
          displayNames[lowerKey] = groupName;
        }
      }

      if (!groups[lowerKey]) {
        groups[lowerKey] = [];
      }
      groups[lowerKey].push(sub);
    });

    // Re-pack into a final object using tidy display names
    const result: { [key: string]: Subject[] } = {};
    Object.keys(groups).forEach(lowerKey => {
      const displayTitle = displayNames[lowerKey];
      const capitalized = displayTitle.charAt(0).toUpperCase() + displayTitle.slice(1);
      result[capitalized] = groups[lowerKey];
    });

    return result;
  }, [subjects]);

  const groupKeys = useMemo(() => Object.keys(groupedSubjects), [groupedSubjects]);

  const currentSubject = subjects.find(s => s.id === selectedGrade);
  const themeColor = currentSubject?.theme || 'indigo';

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGrade === 999) {
      if (pin === SUPER_ADMIN_PWD) {
        localStorage.setItem('super_auth', 'true');
        navigate('/super');
      } else {
        setError(true);
      }
    } else {
      const subjectPwd = currentSubject?.password || TEACHER_PWD;
      if (pin === subjectPwd) {
        localStorage.setItem('teacher_auth', 'true');
        navigate('/teacher');
      } else {
        setError(true);
      }
    }
  };

  const getSubLabel = (sub: Subject, groupName: string) => {
    const normalized = sub.label.trim();
    const regex = /^(.*?)\s+(?:Lớp|Khối|K)?\s*(10|11|12|9|8|7|6)$/i;
    const match = normalized.match(regex);
    if (match) {
      return `Lớp ${match[2]}`;
    }
    return sub.label;
  };

  const getGroupTheme = (groupSubjects: Subject[]) => {
    return groupSubjects[0]?.theme || 'indigo';
  };

  const getGroupColor = (groupSubjects: Subject[]) => {
    return groupSubjects[0]?.color || 'bg-indigo-600';
  };

  const getGroupShadow = (groupSubjects: Subject[]) => {
    return groupSubjects[0]?.shadow || 'shadow-indigo-100';
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative text-center px-4">
      {selectedGrade && (
        <button 
          onClick={() => {
            onSelectGrade(null as any);
            setShowPass(false);
          }}
          className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm z-50 group hover:scale-[1.02] active:scale-95"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> 
          Thoát ra ngoài
        </button>
      )}

      {activeSubjectGroup && !selectedGrade && (
        <button 
          onClick={() => setActiveSubjectGroup(null)}
          className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm z-50 group hover:scale-[1.02] active:scale-95"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> 
          Quay lại chọn môn
        </button>
      )}

      {!selectedGrade && (
        <button 
          onClick={() => {
            onSelectGrade(999);
            setPin('');
            setError(false);
          }}
          className="absolute top-6 right-6 md:top-10 md:right-10 flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all shadow-sm z-50 group hover:scale-[1.02] active:scale-95"
        >
          <ShieldCheck size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
          Super Admin
        </button>
      )}

      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        <div className="mb-8 p-5 bg-white border border-slate-200 shadow-sm rounded-3xl">
            <Book size={48} className={selectedGrade ? (selectedGrade === 999 ? 'text-amber-500 animate-bounce' : `text-${themeColor}-600`) : (activeSubjectGroup ? `text-${getGroupTheme(groupedSubjects[activeSubjectGroup])}-600` : 'text-slate-400')}/>
        </div>
        <h1 className="text-2xl md:text-5xl font-black text-slate-900 uppercase mb-12 tracking-tighter">
          {selectedGrade === 999 
            ? 'QUẢN TRỊ VIÊN TỐI CAO' 
            : selectedGrade 
              ? currentSubject?.label 
              : activeSubjectGroup 
                ? `Môn ${activeSubjectGroup}` 
                : 'HỆ THỐNG HỌC TẬP'}
        </h1>
        
        {!selectedGrade ? (
          !activeSubjectGroup ? (
            /* PHASE 1: List of general subjects (Group Name) */
            <div className="flex flex-wrap justify-center gap-6 w-full max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
              {groupKeys.map((key) => {
                const groupItems = groupedSubjects[key];
                const repColor = getGroupColor(groupItems);
                const repShadow = getGroupShadow(groupItems);

                return (
                  <button 
                    key={key}
                    onClick={() => setActiveSubjectGroup(key)}
                    className="bg-white p-8 rounded-[36px] shadow-lg shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.03] hover:shadow-xl transition-all group w-[220px]"
                  >
                    <div className={`w-14 h-14 ${repColor} rounded-2xl flex items-center justify-center shadow-lg ${repShadow}`}>
                      <GraduationCap size={28} className="text-white"/>
                    </div>
                    <h2 className="text-md font-black text-slate-800 tracking-tight truncate w-full px-2 uppercase">{key}</h2>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{groupItems.length} Phân lớp / Khối</p>
                  </button>
                );
              })}
            </div>
          ) : (
            /* PHASE 2: List of specific grades under the selected subject group */
            <div className="flex flex-wrap justify-center gap-6 w-full max-h-[60vh] overflow-y-auto p-4 custom-scrollbar animate-in slide-in-from-right-4 duration-300">
              {groupedSubjects[activeSubjectGroup].map((sub) => {
                const subLabel = getSubLabel(sub, activeSubjectGroup);
                return (
                  <button 
                    key={sub.id}
                    onClick={() => onSelectGrade(sub.id)}
                    className="bg-white p-8 rounded-[36px] shadow-lg shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.03] hover:shadow-xl transition-all group w-[220px]"
                  >
                    <div className={`w-14 h-14 ${sub.color || 'bg-indigo-600'} rounded-2xl flex items-center justify-center shadow-lg ${sub.shadow || 'shadow-indigo-100'}`}>
                      <GraduationCap size={28} className="text-white"/>
                    </div>
                    <h2 className="text-md font-black text-slate-800 tracking-tight truncate w-full px-2">{subLabel}</h2>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Bắt đầu học tập</p>
                  </button>
                );
              })}
            </div>
          )
        ) : selectedGrade === 999 ? (
          <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleLoginSubmit} 
              className="bg-white p-10 rounded-[40px] shadow-2xl border border-amber-100 flex flex-col items-center space-y-6">
              <div className="w-full">
                <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-5 bg-slate-50 border-2 rounded-2xl text-center font-black text-2xl tracking-[0.5em] ${error?'border-red-400 animate-shake':'border-transparent focus:border-amber-400 outline-none'}`} placeholder="****" autoComplete="current-password"/>
                {error && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-2">Mã PIN Super Admin không đúng!</p>}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Nhập mã PIN tối cao để quản trị toàn cục
              </div>
              <div className="flex gap-4 w-full">
                <button type="button" onClick={() => onSelectGrade(null as any)} className="flex-1 font-bold text-slate-300 uppercase text-[10px] tracking-widest">Hủy bỏ</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200 tracking-widest">Đăng nhập</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button onClick={() => navigate('/student')} className="bg-white p-12 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
              <div className={`w-20 h-20 bg-${themeColor}-50 rounded-3xl flex items-center justify-center group-hover:bg-${themeColor}-600 transition-colors`}>
                  <GraduationCap size={36} className={`text-${themeColor}-600 group-hover:text-white transition-colors`}/>
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
              <form onSubmit={handleLoginSubmit} 
                className="bg-white p-10 rounded-[40px] shadow-2xl border border-amber-100 flex flex-col items-center space-y-6 animate-in zoom-in-95">
                <div className="w-full">
                  <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-5 bg-slate-50 border-2 rounded-2xl text-center font-black text-2xl tracking-[0.5em] ${error?'border-red-400 animate-shake':'border-transparent focus:border-amber-400 outline-none'}`} placeholder="****" autoComplete="current-password"/>
                  {error && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-2">Mã PIN Giáo viên không chính xác!</p>}
                </div>
                <div className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  Nhập mã của giáo viên môn hoặc Super Admin
                </div>
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
  subjects: Subject[];
  onSaveSubjects?: (updated: Subject[]) => void;
}> = ({ isAdmin, data, updateData, isSyncing, visitorCount, selectedGrade, syncError, fetchCloudData, student, onLogout, subjects, onSaveSubjects }) => {
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    return localStorage.getItem(`selected_id_${selectedGrade}`);
  });
  const [iframeLoading, setIframeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'tasks' | 'flashcards' | 'homework'>('content');
  const [showStudentManager, setShowStudentManager] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    onConfirm: () => {}
  });

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

  const currentSubject = useMemo(() => {
    return subjects?.find(s => s.id === selectedGrade);
  }, [subjects, selectedGrade]);

  const themeColor = useMemo(() => {
    return currentSubject?.theme || 'indigo';
  }, [currentSubject]);

  const gradeTitle = useMemo(() => {
    return currentSubject?.label || 'VẬT LÝ';
  }, [currentSubject]);

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

  useEffect(() => {
    const timer = setInterval(() => setSloganIdx(prev => (prev + 1) % SLOGANS.length), 30000);
    return () => clearInterval(timer);
  }, []);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: '', imageUrl: '', order: 0});

  const [showResModal, setShowResModal] = useState(false);
  const [resModalData, setResModalData] = useState<{id?: string, title: string, url: string, isGlobal: boolean}>({title: '', url: '', isGlobal: false});
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all core tables
      const { data: appSettings } = await supabase.from('app_settings').select('*');
      const { data: quizData } = await supabase.from('quiz_data').select('*');
      const { data: flashcards } = await supabase.from('flashcards').select('*');
      const { data: forumComments } = await supabase.from('forum_comments').select('*');
      
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.2',
        tables: {
          app_settings: appSettings,
          quiz_data: quizData,
          flashcards: flashcards,
          forum_comments: forumComments
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanSubjectLabel = currentSubject?.label ? currentSubject.label.replace(/[^a-zA-Z0-9]/g, '') : 'FullBackup';
      a.download = `${cleanSubjectLabel}_Backup_${new Date().toLocaleDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Lỗi khi xuất dữ liệu: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inputTarget = e.target;

    setConfirmConfig({
      isOpen: true,
      title: "Khôi phục dữ liệu",
      message: "Cảnh báo: Việc khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu trong file backup. Bạn có chắc chắn muốn tiếp tục?",
      type: 'warning',
      onConfirm: async () => {
        setIsImporting(true);
        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          if (!backup.tables) throw new Error("File backup không đúng định dạng.");

          // Restore app_settings
          if (backup.tables.app_settings) {
            for (const row of backup.tables.app_settings) {
              // Map to handle potential id vs grade_id or data column differences
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
              // Robust mapping for import
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
              // Robust mapping for import
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

          alert("Khôi phục dữ liệu thành công! Hãy tải lại trang.");
          window.location.reload();
        } catch (error) {
          alert("Lỗi khi khôi phục dữ liệu: " + (error instanceof Error ? error.message : String(error)));
        } finally {
          setIsImporting(false);
          inputTarget.value = '';
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'node' | 'resource' | 'node_image') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit 50MB
    if (file.size > 50 * 1024 * 1024) {
      alert("File quá lớn! Giới hạn 50MB.");
      return;
    }

    setIsUploading(true);
    try {
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
      
      alert("Tải file lên thành công!");
    } catch (error: any) {
      console.error("Upload process error:", error);
      alert(`Lỗi khi tải file: ${error.message || "Vui lòng kiểm tra lại kết nối."}\n\nLưu ý: Bạn cần vào Supabase -> Storage -> Policies và thêm chính sách (Policy) cho phép 'INSERT' cho bucket 'resources'.`);
    } finally {
      setIsUploading(false);
    }
  };
  
  const [showHomeConfig, setShowHomeConfig] = useState(false);
  const [tempHomeUrl, setTempHomeUrl] = useState(data?.homeUrl || '');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempSubjectPassword, setTempSubjectPassword] = useState('');

  const currentSubjectObj = useMemo(() => {
    return subjects.find(s => s.id === selectedGrade);
  }, [subjects, selectedGrade]);

  useEffect(() => {
    if (showHomeConfig) {
      setTempHomeUrl(data?.homeUrl || '');
      setTempApiKey(localStorage.getItem(`gemini_api_key_grade_${selectedGrade}`) || '');
      setTempSubjectPassword(currentSubjectObj?.password || '123');
    }
  }, [showHomeConfig, selectedGrade, data?.homeUrl, currentSubjectObj]);

  useEffect(() => { setActiveTab('content'); }, [selectedId]);

  const handleDeleteNode = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa cấu trúc học liệu",
      message: "Bạn có chắc muốn xóa thư mục/bài học này? Toàn bộ các tài liệu học, bài học bên trong và học liệu tương ứng cũng sẽ bị xóa.",
      type: 'danger',
      onConfirm: () => {
        const getChildIds = (parentId: string): string[] => {
          const children = (data?.nodes || []).filter(n => n.parentId === parentId);
          return [parentId, ...children.flatMap(c => getChildIds(c.id))];
        };
        const idsToDelete = getChildIds(id);
        const newData = {...data, nodes: (data?.nodes || []).filter(n => !idsToDelete.includes(n.id))};
        updateData(newData);
        if(selectedId && idsToDelete.includes(selectedId)) setSelectedId(null);
      }
    });
  };

  const handleReorderNode = (id: string, direction: 'up' | 'down') => {
    const node = data?.nodes?.find(n => n.id === id);
    if (!node) return;
    const siblings = (data?.nodes || []).filter(n => n.parentId === node.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const normalizedSiblings = siblings.map((s, idx) => ({ ...s, order: idx }));
    const currentIndex = normalizedSiblings.findIndex(n => n.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= normalizedSiblings.length) return;
    const targetNode = normalizedSiblings[targetIndex];
    const newNodes = (data?.nodes || []).map(n => {
      const normalizedMatch = normalizedSiblings.find(s => s.id === n.id);
      let updatedNode = normalizedMatch ? { ...n, order: normalizedMatch.order } : n;
      if (updatedNode.id === id) return { ...updatedNode, order: targetNode.order };
      if (updatedNode.id === targetNode.id) return { ...updatedNode, order: currentIndex };
      return updatedNode;
    });
    updateData({ ...data, nodes: newNodes });
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
    setConfirmConfig({
      isOpen: true,
      title: "Xóa học liệu",
      message: `Bạn có chắc chắn muốn xóa học liệu: "${title}"? Thao tác này không thể hoàn tác.`,
      type: 'danger',
      onConfirm: () => {
        const newData = {...data};
        if(isGlobal) newData.globalResources = (data?.globalResources || []).filter(r => r.id !== id);
        else newData.nodes = (data?.nodes || []).map(n => n.id === selectedId ? {...n, lessonResources: (n.lessonResources || []).filter(r => r.id !== id)} : n);
        updateData(newData);
      }
    });
  };

  const handleSaveHomeConfig = () => {
    updateData({...data, homeUrl: tempHomeUrl});
    if (tempApiKey.trim()) {
      localStorage.setItem(`gemini_api_key_grade_${selectedGrade}`, tempApiKey.trim());
    } else {
      localStorage.removeItem(`gemini_api_key_grade_${selectedGrade}`);
    }
    
    // Save updated subject PIN back to Supabase config (id 999)
    if (selectedGrade && selectedGrade !== 999) {
      const updatedSubjects = subjects.map(s => s.id === selectedGrade ? { ...s, password: tempSubjectPassword } : s);
      if (onSaveSubjects) onSaveSubjects(updatedSubjects);
    }

    setShowHomeConfig(false);
  };

  const handleSelectNode = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      localStorage.setItem(`selected_id_${selectedGrade}`, id);
      if ((data?.nodes || []).find(n => n.id === id)?.url) setIframeLoading(true);
    } else {
      localStorage.removeItem(`selected_id_${selectedGrade}`);
    }
  };

  const activeLayout = currentSubject?.layout || 'layout1';

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-white text-slate-900 transition-colors duration-300">
      {/* If layout2 or layout3, render Top Horizontal Navbar */}
      {activeLayout !== 'layout1' && (
        <TopHorizontalNavbar
          nodes={data?.nodes || []}
          selectedId={selectedId}
          themeColor={themeColor}
          isAdmin={isAdmin}
          student={student}
          currentSubject={currentSubject}
          visitorCount={visitorCount}
          onSelectNode={handleSelectNode}
          onShowSettings={() => setShowHomeConfig(true)}
          onAddNode={(p, t) => {
            const nextOrder = (data?.nodes || []).filter(n => n.parentId === p).length;
            setNodeModalData({parentId: p, type: t, title: '', url: '', imageUrl: '', order: nextOrder});
            setShowNodeModal(true);
          }}
          onEditNode={(n) => {
            setNodeModalData({...n});
            setShowNodeModal(true);
          }}
          onDeleteNode={handleDeleteNode}
          onLogout={() => {
            if (isAdmin) localStorage.removeItem('teacher_auth');
            if (onLogout) onLogout();
            navigate('/');
          }}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      )}

      <div className="flex flex-1 overflow-hidden w-full h-full relative z-0">
        {isQuizOpen && selectedNode && (
          <QuizModal 
            nodeId={selectedId!}
            lessonTitle={selectedNode.title} 
            lessonUrl={selectedNode.url}
            isAdmin={isAdmin}
            selectedGrade={selectedGrade}
            themeColor={themeColor}
            student={student}
            subjectName={currentSubject?.label}
            onClose={() => setIsQuizOpen(false)} 
          />
        )}
        
        {/* PANEL 1: SIDEBAR */}
        {activeLayout === 'layout1' && (
          <aside className="w-[230px] border-r border-slate-100 flex flex-col shrink-0 bg-[#fbfcfd] transition-all">
        <header className={`px-5 py-4 text-white ${isAdmin ? 'bg-amber-600' : `bg-${themeColor}-600`} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2">
            <Book size={16}/>
            <h1 className="font-bold text-[9px] uppercase tracking-[0.2em] truncate">
              {currentSubject?.label || 'TÀI LIỆU'}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && <button onClick={()=>setShowHomeConfig(true)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Cấu hình trang chủ"><Settings size={14}/></button>}
            {isAdmin && <button onClick={()=>{
              const nextOrder = (data?.nodes || []).filter(n => n.parentId === null).length;
              setNodeModalData({parentId:null, type:'folder', title:'', url:'', imageUrl: '', order: nextOrder}); 
              setShowNodeModal(true);
            }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><Plus size={14}/></button>}
          </div>
        </header>

        <div className="p-3 shrink-0 bg-[#fbfcfd]">
          <div className={`flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-${themeColor}-400 transition-all`}>
            <Search size={12} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-[10px] font-medium w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#fbfcfd]">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data?.nodes || []} selectedId={selectedId} isAdmin={isAdmin} level={0}
              visibleNodeIds={visibleNodeIds}
              searchTerm={searchTerm}
              themeColor={themeColor}
              onSelect={handleSelectNode}
              onAdd={(p,t)=>{
                const nextOrder = (data?.nodes || []).filter(n => n.parentId === p).length;
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
             {student && (
               <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[8px] font-black">
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-700 truncate uppercase tracking-tighter">{student.full_name || student.name}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{student.is_guest ? 'Khách' : 'Học sinh'}</p>
                  </div>
               </div>
             )}
        </footer>
      </aside>
      )}

      {/* PANEL 3: RESOURCES (Leftmost side in Layout 2) */}
      {activeLayout === 'layout2' && (
        <ResourcesPanel 
          isAdmin={isAdmin} 
          selectedId={selectedId} 
          lessonResources={selectedNode?.lessonResources||[]} 
          globalResources={data?.globalResources || []}
          themeColor={themeColor}
          className="border-r border-slate-100 animate-in slide-in-from-left duration-300"
          onAdd={(isG)=> {setResModalData({title:'', url:'', isGlobal: isG}); setShowResModal(true);}}
          onEdit={(r,isG)=> {setResModalData({...r, isGlobal: isG}); setShowResModal(true);}}
          onDelete={handleDeleteResource}
        />
      )}

      {/* PANEL 2: MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white transition-all">
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
        {selectedId ? (
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
                <header className={`px-6 ${activeTab === 'content' ? 'pt-4 pb-0' : 'py-4'} border-b border-slate-100 shrink-0 bg-white`}>
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1 mr-4">
                      <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate mb-0.5">{selectedNode?.title}</h2>
                      <p key={sloganIdx} className="text-[9px] font-medium text-slate-400 uppercase tracking-widest opacity-80 italic animate-in slide-in-from-left-4 duration-1000">
                        {SLOGANS[sloganIdx]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-2">
                        {isAdmin ? (
                            <button 
                              onClick={()=>setIsQuizOpen(true)} 
                              className="group flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-100 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all"
                            >
                            <Zap size={14} className="fill-current text-amber-300"/> Soạn Quiz AI
                          </button>
                        ) : (
                            <button 
                              onClick={()=>setIsQuizOpen(true)} 
                              className={`group flex items-center gap-2 px-5 py-2 bg-${themeColor}-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-${themeColor}-100 rounded-full hover:bg-${themeColor}-700 hover:scale-105 transition-all`}
                            >
                            <BrainCircuit size={14}/> Rèn luyện
                          </button>
                        )}
                      </div>
                      {selectedNode?.url && <button onClick={()=>window.open(selectedNode.url, '_blank')} className={`p-2 bg-slate-50 text-slate-400 hover:text-${themeColor}-600 rounded-full hover:bg-${themeColor}-50 transition-colors`}><Maximize2 size={16}/></button>}
                    </div>
                  </div>
                  
                  <div className={`flex justify-between items-center ${activeTab === 'content' ? 'mt-2' : 'mt-3'}`}>
                    <div className="flex gap-6">
                      <button onClick={()=>setActiveTab('content')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='content' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Học liệu</button>
                      <button onClick={()=>setActiveTab('flashcards')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='flashcards' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Flashcards</button>
                      {(isAdmin || student) && (
                        <button onClick={()=>setActiveTab('tasks')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='tasks' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Nhiệm vụ</button>
                      )}
                      {(isAdmin || student) && (
                        <button onClick={()=>setActiveTab('homework')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='homework' ? `border-${themeColor}-600 text-${themeColor}-600` : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Bài tập về nhà</button>
                      )}
                    </div>
                    <div className="pb-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                      {formattedTime}
                    </div>
                  </div>
                </header>
                
                <div className={`flex-1 relative overflow-y-auto custom-scrollbar bg-[#fcfdfe] ${activeTab === 'content' ? 'p-0' : 'p-6'}`}>
                  {activeTab === 'content' ? (
                    <div className="h-full relative">
                      {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm"><Loader2 className={`animate-spin text-${themeColor}-500 mb-2`} size={32}/><p className="text-[10px] uppercase font-bold text-slate-300 tracking-widest">Đang tải...</p></div>}
                      {selectedNode?.url ? <iframe src={selectedNode.url} title={selectedNode.title} className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-200 text-xl font-light tracking-widest">Nội dung chưa cập nhật...</div>}
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

      {/* PANEL 3: RESOURCES (Right side in Layout 1 & 3) */}
      {(activeLayout === 'layout1' || activeLayout === 'layout3') && (
        <ResourcesPanel 
          isAdmin={isAdmin} 
          selectedId={selectedId} 
          lessonResources={selectedNode?.lessonResources||[]} 
          globalResources={data?.globalResources || []}
          themeColor={themeColor}
          className="border-l border-slate-100 animate-in slide-in-from-right duration-300"
          onAdd={(isG)=> {setResModalData({title:'', url:'', isGlobal: isG}); setShowResModal(true);}}
          onEdit={(r,isG)=> {setResModalData({...r, isGlobal: isG}); setShowResModal(true);}}
          onDelete={handleDeleteResource}
        />
      )}
    </div>

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

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-100 mt-2">Cấu hình Quiz AI</h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Gemini API Key riêng</label>
                  <input 
                    type="password" 
                    value={tempApiKey} 
                    onChange={e=>setTempApiKey(e.target.value)} 
                    className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-amber-400 transition-all font-mono" 
                    placeholder="Nhập API Key riêng cho môn này..."
                  />
                  <p className="text-[8px] text-slate-400 px-1 leading-normal">Cấu hình API Key riêng của giáo viên phụ trách môn học này để soạn bài độc lập.</p>
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

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-100 mt-2">Mã PIN Giáo viên & Học sinh</h4>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Mã PIN Môn học</label>
                  <input 
                    type="text" 
                    value={tempSubjectPassword} 
                    onChange={e=>setTempSubjectPassword(e.target.value)} 
                    className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-amber-400 transition-all font-mono" 
                    placeholder="Mật khẩu môn học..."
                  />
                  <p className="text-[8px] text-slate-400 px-1 leading-normal">Thay đổi mã PIN dùng để truy cập Dashboard Giáo viên của riêng bộ môn/khối lớp này.</p>
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
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'folder'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='folder' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}>
                <Folder size={14}/> Thư mục
              </button>
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'lesson'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='lesson' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400'}`}>
                <Globe size={14}/> Bài học
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề</label>
              <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className={`w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder={nodeModalData.type==='folder'?'Tên thư mục...':'Tên bài học...'}/>
            </div>
            {nodeModalData.type === 'lesson' && (
              <>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center">
                    <span>Link tài liệu (Nhúng / Iframe)</span>
                  </label>
                  <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="https://drive.google.com/... hoặc link tài liệu khác"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center">
                    <span className="flex items-center gap-1"><ImageIcon size={10}/> Link hình ảnh minh họa bài học</span>
                  </label>
                  <input value={nodeModalData.imageUrl || ''} onChange={e=>setNodeModalData({...nodeModalData, imageUrl:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="Dán link ảnh từ Github, Imgur... (ví dụ: https://...)"/>
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
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex justify-between items-center">
                <span>Đường dẫn (URL)</span>
              </label>
              <input value={resModalData.url} onChange={e=>setResModalData({...resModalData, url:e.target.value})} className={`w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-${themeColor}-400 transition-all`} placeholder="Dán link tài liệu từ Google Drive, Youtube..."/>
            </div>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowResModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button type="submit" className={`flex-1 py-3 bg-${themeColor}-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-${themeColor}-100 tracking-widest`}>Lưu tài liệu</button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        onConfirm={() => {
          confirmConfig.onConfirm();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

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
