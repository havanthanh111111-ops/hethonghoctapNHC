
import React, { useState } from 'react';
import { User, Lock, Loader2, ArrowRight, GraduationCap, UserCheck } from 'lucide-react';
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

  const handleGuestLogin = () => {
    // Tạo ID giả dạng UUID để tránh lỗi nếu cột student_id trong study_logs là kiểu UUID
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
      // Find student with matching name and password for this grade
      const { data, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('name', name.trim())
        .eq('password', password.trim())
        .eq('grade_id', gradeId)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        setError(`Lỗi CSDL: ${fetchError.message} (${fetchError.code})`);
        return;
      }

      if (data) {
        onLogin(data);
        localStorage.setItem('student_auth_id', data.id);
        localStorage.setItem('forum_name', data.full_name || data.name);
      } else {
        setError(`Không tìm thấy học sinh "${name.trim()}" với mật khẩu đã nhập ở Khối ${gradeId}.`);
        console.log('Login attempt failed for:', { name: name.trim(), gradeId: gradeId });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className={`h-3 w-full bg-${themeColor}-600`}></div>
        <div className="p-10 space-y-8">
           <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-20 h-20 bg-${themeColor}-50 rounded-3xl flex items-center justify-center text-${themeColor}-600 shadow-sm`}>
                 <GraduationCap size={40} />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Đăng nhập Học sinh</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Sử dụng tài khoản giáo viên cấp</p>
              </div>
           </div>

           <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã học sinh (ID)</label>
                 <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                       type="text"
                       value={name}
                       onChange={e => setName(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-medium transition-all"
                       placeholder="Vd: HS2024001"
                       required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                 <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                       type="password"
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-medium transition-all"
                       placeholder="••••••"
                       required
                    />
                 </div>
              </div>

              {error && (
                 <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest text-center animate-shake bg-red-50 p-3 rounded-xl border border-red-100">
                   {error}
                 </p>
              )}

              <button 
                type="submit" 
                disabled={loading || !name || !password}
                className={`w-full py-5 ${loading ? 'bg-slate-100' : `bg-${themeColor}-600 shadow-xl shadow-${themeColor}-100 hover:scale-[1.02]`} text-white rounded-[24px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2`}
              >
                {loading ? (
                   <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Vào lớp học ngay <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="flex items-center gap-4 py-2">
                 <div className="h-[1px] flex-1 bg-slate-100"></div>
                 <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Hoặc</span>
                 <div className="h-[1px] flex-1 bg-slate-100"></div>
              </div>

              <button 
                type="button"
                onClick={handleGuestLogin}
                className="w-full py-4 bg-white border-2 border-slate-100 text-slate-500 hover:border-amber-400 hover:text-amber-600 rounded-[24px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2 text-xs"
              >
                 Vào xem với tư cách Khách <UserCheck size={18} />
              </button>
           </form>

           <div className="text-center">
              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Nếu chưa có tài khoản, hãy liên hệ Thầy/Cô để được cấp phép.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
