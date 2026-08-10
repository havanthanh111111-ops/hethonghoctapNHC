
import React, { useState } from 'react';
import { User, Lock, Loader2, ArrowRight, GraduationCap, UserCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Student } from '../types';

interface StudentLoginProps {
  onLogin: (student: Student) => void;
  gradeId: number;
  themeColor: string;
}

const StudentLogin: React.FC<StudentLoginProps> = ({ onLogin, gradeId, themeColor }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const getThemeClasses = (color: string) => {
    switch (color) {
      case 'emerald':
        return {
          bg: 'bg-emerald-600',
          bgHover: 'hover:bg-emerald-700',
          bgLight: 'bg-emerald-50',
          text: 'text-emerald-600',
          shadow: 'shadow-emerald-200/50',
          focusBorder: 'focus:border-emerald-500'
        };
      case 'rose':
        return {
          bg: 'bg-rose-600',
          bgHover: 'hover:bg-rose-700',
          bgLight: 'bg-rose-50',
          text: 'text-rose-600',
          shadow: 'shadow-rose-200/50',
          focusBorder: 'focus:border-rose-500'
        };
      default:
        return {
          bg: 'bg-indigo-600',
          bgHover: 'hover:bg-indigo-700',
          bgLight: 'bg-indigo-50',
          text: 'text-indigo-600',
          shadow: 'shadow-indigo-200/50',
          focusBorder: 'focus:border-indigo-500'
        };
    }
  };

  const theme = getThemeClasses(themeColor);

  const handleGuestLogin = () => {
    const timestamp = Date.now().toString();
    const guestId = `00000000-0000-4000-a000-${timestamp.slice(-12).padStart(12, '0')}`;
    const guestStudent: Student = {
      id: guestId,
      name: 'Khách',
      full_name: 'Khách vãng lai',
      grade_id: gradeId,
      is_guest: true
    };
    onLogin(guestStudent);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return;

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('name', name.trim())
        .eq('password', password.trim())
        .eq('grade_id', gradeId)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError(`Lỗi CSDL: ${fetchError.message}`);
        return;
      }

      if (data) {
        onLogin(data);
        localStorage.setItem('student_auth_id', data.id);
        localStorage.setItem('forum_name', data.full_name || data.name);
      } else {
        setError(`Mã HS hoặc mật khẩu không chính xác.`);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Nút quay lại trang chủ */}
      <button 
        onClick={() => navigate('/')} 
        className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-all shadow-sm z-20"
      >
        <ArrowLeft size={14} /> Trang chủ
      </button>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className={`h-2 w-full ${theme.bg}`}></div>
        
        <div className="p-6 sm:p-7 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${theme.bgLight} rounded-2xl flex items-center justify-center ${theme.text} shrink-0`}>
              <GraduationCap size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Đăng nhập Học sinh</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lớp Vật Lý Khối {gradeId}</p>
            </div>
          </div>

          {/* Nút Đăng nhập với tư cách Khách - Nổi bật ở trên cùng */}
          <button 
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-2 group"
          >
            <UserCheck size={18} className="group-hover:scale-110 transition-transform" />
            Vào xem tự do với tư cách Khách
          </button>

          <div className="flex items-center gap-3">
            <div className="h-[1px] flex-1 bg-slate-100"></div>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Hoặc dùng tài khoản học sinh</span>
            <div className="h-[1px] flex-1 bg-slate-100"></div>
          </div>

          {/* Form đăng nhập tài khoản */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã học sinh (ID)</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 ${theme.focusBorder} rounded-xl outline-none font-medium text-xs transition-all`}
                  placeholder="Vd: HS2024001"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input 
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 ${theme.focusBorder} rounded-xl outline-none font-medium text-xs transition-all`}
                  placeholder="••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest text-center animate-shake bg-red-50 p-2 rounded-xl border border-red-100">
                {error}
              </p>
            )}

            <button 
              type="submit" 
              disabled={loading || !name || !password}
              className={`w-full py-3 ${loading || !name || !password ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : `${theme.bg} ${theme.bgHover} text-white shadow-md ${theme.shadow}`} rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2`}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  Vào lớp học <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-[9px] text-slate-400 font-medium text-center leading-tight">
            Tài khoản riêng chỉ cấp cho học sinh cần theo dõi đánh giá.
          </p>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;

