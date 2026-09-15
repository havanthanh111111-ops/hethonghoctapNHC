
import React, { useState, useEffect } from 'react';
import { Users, Loader2, Search, UserPlus, Trash2, Key, FileUp, Edit2, X, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Student } from '../types';
import ConfirmModal from './ConfirmModal';

interface StudentManagerProps {
  gradeId: number;
  themeColor: string;
  onClose: () => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ gradeId, themeColor, onClose }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState({ name: '', full_name: '', password: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('grade_id', gradeId)
        .order('name');
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [gradeId]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.password) return;

    try {
      const { error } = await supabase
        .from('students')
        .insert([{
          name: newStudent.name.trim(),
          full_name: newStudent.full_name?.trim() || '',
          password: newStudent.password.trim(),
          grade_id: gradeId
        }]);
      if (error) throw error;
      
      setNewStudent({ name: '', full_name: '', password: '' });
      setShowAddForm(false);
      fetchStudents();
    } catch (err: any) {
      alert('Lỗi khi thêm học sinh: ' + err.message);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.name || !editingStudent.password) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editingStudent.name.trim(),
          full_name: editingStudent.full_name?.trim() || '',
          password: editingStudent.password?.trim()
        })
        .eq('id', editingStudent.id);
      
      if (error) throw error;
      
      setEditingStudent(null);
      fetchStudents();
    } catch (err: any) {
      alert('Lỗi khi cập nhật: ' + err.message);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const studentsToInsert = [];

      // Skip header if exists (detect by common names)
      const startIdx = (lines[0].toLowerCase().includes('mã') || lines[0].toLowerCase().includes('tên')) ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Support both comma and semicolon
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length >= 2) {
          const csvGrade = parts[3] ? parseInt(parts[3].trim()) : null;
          studentsToInsert.push({
            name: parts[0].trim(), // Mã SV
            full_name: parts[1].trim(), // Họ tên
            password: (parts[2] || '123456').trim(), // Mật khẩu (mặc định 123456)
            grade_id: !isNaN(Number(csvGrade)) && csvGrade !== null ? csvGrade : gradeId
          });
        }
      }

      if (studentsToInsert.length === 0) {
        alert("Không tìm thấy dữ liệu hợp lệ trong file CSV.");
        return;
      }

      setConfirmConfig({
        isOpen: true,
        title: "Thêm học sinh từ CSV",
        message: `Bạn có chắc chắn muốn thêm ${studentsToInsert.length} học sinh từ file CSV này?`,
        onConfirm: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) throw error;
            alert(`Đã thêm thành công ${studentsToInsert.length} học sinh.`);
            fetchStudents();
          } catch (err: any) {
            alert("Lỗi khi nhập CSV: " + err.message);
          } finally {
            setLoading(false);
          }
        }
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa học sinh",
      message: `Bạn có chắc chắn muốn xóa học sinh ${name}? Mọi dữ liệu học tập của em sẽ bị xóa vĩnh viễn.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', id);
          if (error) throw error;
          fetchStudents();
        } catch (err: any) {
          alert('Lỗi khi xóa: ' + err.message);
        }
      }
    });
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.full_name && s.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name.split(' ').pop()?.charAt(0).toUpperCase() || 'S';
  };

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white p-0 rounded-[40px] shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
        <header className={`p-8 bg-${themeColor}-600 text-white shrink-0`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white/20 rounded-xl">
                    <Users size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-black uppercase tracking-tight">Quản lý lớp học</h3>
                    <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Khối {gradeId} • {students.length} Thành viên</p>
                 </div>
              </div>
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase rounded-xl transition-all border border-white/20"
                  title="Cột CSV: 1. Mã HS, 2. Họ tên, 3. Mật khẩu (tùy chọn), 4. Khối (tùy chọn)"
                >
                  <FileUp size={14} /> Nhập CSV
                </button>
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="px-5 py-2.5 bg-white text-slate-900 text-[10px] font-black uppercase rounded-xl hover:scale-105 transition-all shadow-lg"
                >
                  + Học sinh
                </button>
              </div>
           </div>
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" size={16} />
              <input 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm theo tên..." 
                className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-2xl outline-none placeholder:text-white/40 font-medium text-sm focus:bg-white/20 transition-all"
              />
           </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-slate-200" size={32} />
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Đang tải danh sách...</p>
             </div>
          ) : filteredStudents.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                <Users size={48} className="text-slate-100" />
                <p className="text-slate-400 font-medium italic">Không tìm thấy học sinh nào.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredStudents.map(student => (
                  <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 bg-${themeColor}-50 rounded-xl flex items-center justify-center text-${themeColor}-600 font-black shadow-sm`}>
                           {getInitials(student.full_name || student.name)}
                        </div>
                        <div>
                           <h5 className="font-bold text-slate-800 text-sm leading-tight">{student.full_name || 'Chưa đặt tên'}</h5>
                           <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight bg-indigo-50 px-1.5 py-0.5 rounded-md">ID: {student.name}</span>
                              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1">
                                 <Key size={10} /> {student.password}
                              </span>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => setEditingStudent(student)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                           <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(student.id, student.full_name || student.name)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-100 bg-white flex justify-end">
           <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:scale-105 transition-all">Đóng</button>
        </footer>
      </div>

      {(showAddForm || editingStudent) && (
        <div className="fixed inset-0 z-[500] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm">
           <form 
             onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent} 
             className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm space-y-6 border border-slate-100 animate-in zoom-in-95"
           >
              <div className="flex justify-between items-center border-b pb-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{editingStudent ? 'Cập nhật học sinh' : 'Tạo học sinh mới'}</h4>
                 <button type="button" onClick={() => { setShowAddForm(false); setEditingStudent(null); }} className="text-slate-300 hover:text-slate-600 transition-all">
                    <X size={18} />
                 </button>
              </div>
              
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Mã học sinh (ID)</label>
                    <input 
                      autoFocus 
                      value={editingStudent ? editingStudent.name : newStudent.name} 
                      onChange={e => editingStudent ? setEditingStudent({...editingStudent, name: e.target.value}) : setNewStudent({...newStudent, name: e.target.value})} 
                      className="w-full px-5 py-3 bg-slate-50 border border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold text-sm text-slate-700" 
                      placeholder="vd: HS2024001" 
                      required 
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Họ và tên</label>
                    <input 
                      value={editingStudent ? editingStudent.full_name : newStudent.full_name} 
                      onChange={e => editingStudent ? setEditingStudent({...editingStudent, full_name: e.target.value}) : setNewStudent({...newStudent, full_name: e.target.value})} 
                      className="w-full px-5 py-3 bg-slate-50 border border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold text-sm text-slate-700" 
                      placeholder="vd: Nguyễn Văn A" 
                      required 
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Mật khẩu</label>
                    <input 
                      value={editingStudent ? editingStudent.password : newStudent.password} 
                      onChange={e => editingStudent ? setEditingStudent({...editingStudent, password: e.target.value}) : setNewStudent({...newStudent, password: e.target.value})} 
                      className="w-full px-5 py-3 bg-slate-50 border border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold text-sm text-slate-700" 
                      placeholder="Mặc định: 123456" 
                      required 
                    />
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                 <button 
                   type="button" 
                   onClick={() => { setShowAddForm(false); setEditingStudent(null); }} 
                   className="flex-1 font-bold text-slate-300 uppercase text-[10px] tracking-widest hover:text-slate-400 transition-all"
                 >
                   Hủy bỏ
                 </button>
                 <button 
                   type="submit" 
                   className={`flex-[2] px-4 py-4 bg-${themeColor}-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-${themeColor}-100 tracking-widest hover:scale-105 transition-all`}
                 >
                   {editingStudent ? 'Lưu thay đổi' : 'Thêm ngay'}
                 </button>
              </div>
           </form>
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

export default StudentManager;
