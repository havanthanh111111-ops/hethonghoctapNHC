import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Plus, Trash2, Key, Save, LogOut, ArrowLeft, ShieldAlert, CheckCircle, RefreshCw, Palette, HelpCircle, Activity } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Subject } from '../types';
import ConfirmModal from './ConfirmModal';

interface SuperAdminViewProps {
  subjects: Subject[];
  onSaveSubjects: (updated: Subject[]) => Promise<void>;
  visitorCount: number;
}

const THEME_OPTIONS = [
  { id: 'indigo', label: 'Indigo (Xanh dương)', bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', text: 'text-indigo-600', cardBg: 'bg-indigo-50/50', ring: 'ring-indigo-500' },
  { id: 'emerald', label: 'Emerald (Xanh lá)', bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-600', cardBg: 'bg-emerald-50/50', ring: 'ring-emerald-500' },
  { id: 'rose', label: 'Rose (Hồng/Đỏ)', bg: 'bg-rose-600', hover: 'hover:bg-rose-700', text: 'text-rose-600', cardBg: 'bg-rose-50/50', ring: 'ring-rose-500' },
  { id: 'violet', label: 'Violet (Tím)', bg: 'bg-violet-600', hover: 'hover:bg-violet-700', text: 'text-violet-600', cardBg: 'bg-violet-50/50', ring: 'ring-violet-500' },
  { id: 'amber', label: 'Amber (Vàng/Cam)', bg: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-amber-600', cardBg: 'bg-amber-50/50', ring: 'ring-amber-500' },
  { id: 'sky', label: 'Sky (Xanh trời)', bg: 'bg-sky-600', hover: 'hover:bg-sky-700', text: 'text-sky-600', cardBg: 'bg-sky-50/50', ring: 'ring-sky-500' },
];

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ subjects, onSaveSubjects, visitorCount }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Form states
  const [newSub, setNewSub] = useState<{ label: string; theme: string; password: string; layout: 'layout1' | 'layout2' | 'layout3' }>({ label: '', theme: 'indigo', password: '123', layout: 'layout1' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<{ label: string; theme: string; password?: string; layout?: 'layout1' | 'layout2' | 'layout3' }>({ label: '', theme: '', password: '', layout: 'layout1' });

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSub.label.trim()) return;

    setLoading(true);
    try {
      // Generate unique numerical id (int8 compatible, strictly positive)
      const newId = Math.floor(Date.now() / 1000) % 1000000;
      
      const themeConfig = THEME_OPTIONS.find(t => t.id === newSub.theme) || THEME_OPTIONS[0];

      const createdSub: Subject = {
        id: newId,
        label: newSub.label.trim(),
        theme: newSub.theme,
        color: themeConfig.bg,
        shadow: `shadow-${newSub.theme}-100`,
        password: newSub.password.trim() || '123',
        layout: newSub.layout || 'layout1'
      };

      // 1. Initial Empty Content Row in app_settings table
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          id: newId,
          data: {
            nodes: [],
            globalResources: []
          }
        });

      if (insertError) {
        throw new Error(`Lỗi tạo bảng học liệu môn học: ${insertError.message}`);
      }

      // 2. Add to general subjects list
      const updatedSubjects = [...subjects, createdSub];
      await onSaveSubjects(updatedSubjects);

      setNewSub({ label: '', theme: 'indigo', password: '123', layout: 'layout1' });
      showStatus(`Đã tạo thành công môn học mới: "${createdSub.label}"!`);
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || 'Lỗi không xác định khi tạo môn học', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (sub: Subject) => {
    setEditingId(sub.id);
    setEditingData({
      label: sub.label,
      theme: sub.theme,
      password: sub.password || '123',
      layout: sub.layout || 'layout1'
    });
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingData.label.trim()) return;
    setLoading(true);
    try {
      const themeConfig = THEME_OPTIONS.find(t => t.id === editingData.theme) || THEME_OPTIONS[0];

      const updated = subjects.map(sub => {
        if (sub.id === id) {
          return {
            ...sub,
            label: editingData.label.trim(),
            theme: editingData.theme,
            color: themeConfig.bg,
            shadow: `shadow-${editingData.theme}-100`,
            password: editingData.password?.trim() || '123',
            layout: editingData.layout || 'layout1'
          };
        }
        return sub;
      });

      await onSaveSubjects(updated);
      setEditingId(null);
      showStatus('Bản ghi môn học đã được cập nhật thành công!');
    } catch (err: any) {
      showStatus('Không thể lưu cập nhật: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (sub: Subject) => {
    setConfirmConfig({
      isOpen: true,
      title: "CẢNH BÁO CỰC KỲ QUAN TRỌNG",
      message: `Bạn đang chuẩn bị XÓA HOÀN TOÀN môn "${sub.label}" (ID: ${sub.id}). Hành động này hoàn toàn không thể hoàn tác. Mọi tư liệu, cấu trúc sách học, bài kiểm tra Quiz, Flashcards, và điểm của học sinh thuộc môn học này đều sẽ bị xóa vĩnh viễn khỏi hệ thống đám mây. Bạn có thực sự chắc chắn muốn tiếp tục?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          // 1. Delete course structure in app_settings table
          const { error: dbError } = await supabase
            .from('app_settings')
            .delete()
            .eq('id', sub.id);

          if (dbError) {
            throw dbError;
          }

          // Also clean up students assigned to this subject (grade_id maps to subject id)
          try {
            await supabase.from('students').delete().eq('grade_id', sub.id);
          } catch (e) {
            console.warn('Silent warning clearing student cascade:', e);
          }

          // 2. Remove from active subjects manifest
          const updated = subjects.filter(s => s.id !== sub.id);
          await onSaveSubjects(updated);

          showStatus(`Đã xóa hoàn toàn môn "${sub.label}"`);
        } catch (err: any) {
          showStatus('Lỗi khi xóa môn học: ' + err.message, 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('super_auth');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col p-6 font-sans">
      {/* HEADER BAR */}
      <header className="max-w-7xl w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">HỆ THỐNG QUẢN TRỊ TOÀN CỤC</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Quản lý các môn học, giáo viên & phân quyền tối cao (Super Admin)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2">
            <Activity size={14} className="text-amber-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hệ thống: {visitorCount} Lượt xem</span>
          </div>
          <button 
            onClick={handleLogout}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-rose-100 hover:scale-[1.02]"
          >
            <LogOut size={14} /> Đăng xuất Super Admin
          </button>
        </div>
      </header>

      {/* BODY INTERFACE */}
      <main className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
        
        {/* PANEL A: ADD NEW SUBJECT FORM */}
        <section className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm h-fit">
          <div className="flex items-center gap-2.5 pb-6 border-b border-slate-100 mb-6">
            <Plus size={20} className="text-indigo-600" />
            <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">Tạo Môn Học Mới</h2>
          </div>

          <form onSubmit={handleCreateSubject} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Tên môn học & Phân nhóm</label>
              <input 
                type="text" 
                value={newSub.label}
                onChange={e => setNewSub({ ...newSub, label: e.target.value })}
                placeholder="Ví dụ: Vật Lý 11, Hóa Học 10, Toán Số Học..."
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-indigo-500 hover:bg-slate-100/50 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Mật khẩu giáo viên môn này</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                  type="text" 
                  value={newSub.password}
                  onChange={e => setNewSub({ ...newSub, password: e.target.value })}
                  placeholder="Mặc định: 123"
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:outline-none focus:border-indigo-500 hover:bg-slate-100/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1 text-slate-400">Kiểu Bố Cục Giao Diện (Layout)</label>
              <select
                value={newSub.layout}
                onChange={e => setNewSub({ ...newSub, layout: e.target.value as 'layout1' | 'layout2' | 'layout3' })}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-indigo-500 hover:bg-slate-100/50 transition-all"
              >
                <option value="layout1">Layout 1: Bố cục cột bên trái (Mặc định)</option>
                <option value="layout2">Layout 2: Menu ngang trên đầu + Thư mục tài liệu bên TRÁI</option>
                <option value="layout3">Layout 3: Menu ngang trên đầu + Thư mục tài liệu bên PHẢI</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1 text-slate-400">Chọn Màu & Chủ Đề Giao Diện</label>
              <div className="grid grid-cols-2 gap-2">
                {THEME_OPTIONS.map((theme) => (
                  <button
                    type="button"
                    key={theme.id}
                    onClick={() => setNewSub({ ...newSub, theme: theme.id })}
                    className={`p-3 border rounded-2xl flex items-center gap-2 text-left transition-all ${
                      newSub.theme === theme.id 
                        ? `border-indigo-500 bg-indigo-50/20 ring-2 ${theme.ring}` 
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${theme.bg} shrink-0`}></div>
                    <span className="text-[10px] font-bold text-slate-600 truncate">{theme.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {statusMsg && (
              <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2 animate-in fade-in duration-300 ${
                statusMsg.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !newSub.label.trim()}
              className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 transition-all ${
                loading || !newSub.label.trim() ? 'bg-slate-300 shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02]'
              }`}
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
              Tạo môn học & Khởi tạo CSDL
            </button>
          </form>
        </section>

        {/* PANEL B: ACTIVE SUBJECTS MANAGE LIST */}
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-100 rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5">
                <Book size={20} className="text-amber-500" />
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">Danh Sách Môn Học Hệ Thống ({subjects.length})</h2>
              </div>
              <span className="text-[10px] font-black uppercase bg-amber-50 border border-amber-100 text-amber-500 px-3 py-1 rounded-full animate-pulse">Lưu trữ đám mây</span>
            </div>

            {subjects.length === 0 ? (
              <div className="p-12 text-center text-slate-300">
                <Palette size={48} className="mx-auto opacity-30 mb-4" />
                <p className="text-sm font-medium">Chưa có môn học nào được đăng ký trong hệ thống.</p>
                <p className="text-[10px] uppercase font-bold mt-1 tracking-widest">Sử dụng bảng bên trái để tạo môn học đầu tiên.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjects.map((sub) => {
                  const subjectTheme = THEME_OPTIONS.find(t => t.id === sub.theme) || THEME_OPTIONS[0];
                  const isEditing = editingId === sub.id;

                  return (
                    <div 
                      key={sub.id} 
                      className={`relative overflow-hidden border bg-white rounded-3xl p-5 hover:shadow-md transition-all ${
                        isEditing ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500/20' : 'border-slate-100'
                      }`}
                    >
                      {/* Theme band indicator */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isEditing ? 'bg-indigo-600' : subjectTheme.bg}`}></div>

                      {isEditing ? (
                        /* EDIT MODE FOR A SUBJECT */
                        <div className="space-y-4 pt-2">
                          <h3 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1 flex items-center gap-1.5">
                            <RefreshCw size={12} className="animate-spin" /> Đang cập nhật môn học
                          </h3>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">Tên môn học</span>
                              <input 
                                type="text"
                                value={editingData.label}
                                onChange={e => setEditingData({ ...editingData, label: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">PIN giáo viên môn</span>
                              <input 
                                type="text"
                                value={editingData.password}
                                onChange={e => setEditingData({ ...editingData, password: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">Chủ đề g.diện</span>
                              <select 
                                value={editingData.theme}
                                onChange={e => setEditingData({ ...editingData, theme: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                              >
                                {THEME_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">Bố cục giao diện</span>
                              <select 
                                value={editingData.layout || 'layout1'}
                                onChange={e => setEditingData({ ...editingData, layout: e.target.value as 'layout1' | 'layout2' | 'layout3' })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                              >
                                <option value="layout1">Layout 1 (Gốc bên trái)</option>
                                <option value="layout2">Layout 2 (Top + Links trái)</option>
                                <option value="layout3">Layout 3 (Top + Links phải)</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-slate-50">
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex-1 py-2 border border-slate-100 hover:bg-slate-50 rounded-xl text-[8px] font-black text-slate-400 uppercase tracking-widest transition-all"
                            >
                              Hủy bỏ
                            </button>
                            <button
                              onClick={() => handleSaveEdit(sub.id)}
                              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all shadow-md shadow-indigo-100"
                            >
                              <Save size={10} /> Đồng ý
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* READ MODE FOR A SUBJECT */
                        <div className="pt-2 h-full flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[7px] font-bold uppercase tracking-wider mb-1 ${subjectTheme.text} ${subjectTheme.cardBg}`}>
                                  ID: {sub.id}
                                </span>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight truncate leading-tight">{sub.label}</h3>
                              </div>
                              <div className={`w-8 h-8 rounded-xl ${subjectTheme.bg} flex items-center justify-center text-white shrink-0 shadow-sm shadow-slate-100`}>
                                <Book size={16} />
                              </div>
                            </div>

                            <div className="space-y-1 px-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-[10px] font-medium text-slate-500">
                              <div className="flex justify-between">
                                <span>PIN Teacher:</span>
                                <span className="font-mono font-bold text-slate-800">{sub.password || '123'}</span>
                              </div>
                              <div className="flex justify-between mt-1">
                                <span>Giao diện:</span>
                                <span className="font-semibold text-slate-600 capitalize">{sub.theme}</span>
                              </div>
                              <div className="flex justify-between mt-1 pt-1 border-t border-slate-100">
                                <span>Kiểu bố cục:</span>
                                <span className="font-bold text-slate-700">
                                  {sub.layout === 'layout2' ? 'Layout 2 (Top, Trái)' : sub.layout === 'layout3' ? 'Layout 3 (Top, Phải)' : 'Layout 1 (Mặc định)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-4 border-t border-slate-50/50 mt-4">
                            <button
                              onClick={() => handleStartEdit(sub)}
                              className="flex-1 py-2.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                            >
                              Cấu hình PIN/G diện
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => handleDeleteSubject(sub)}
                              className="px-3.5 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 hover:shadow-lg hover:shadow-rose-100"
                              title="Xóa môn học vĩnh viễn"
                            >
                              <Trash2 size={12} /> XÓA
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* HELP CARD AND TIPS */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[32px] p-8 text-white shadow-xl shadow-amber-50 border border-white/10">
            <div className="flex items-center gap-3 pb-4 border-b border-white/15 mb-4">
              <HelpCircle size={22} className="text-amber-200 shrink-0" />
              <h3 className="text-sm font-black uppercase tracking-wider">Nguyên lý Hoạt Động & Hướng Dẫn Sử Dụng</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] leading-relaxed opacity-95">
              <div className="space-y-2">
                <p className="font-bold text-amber-200">1. ĐĂNG NHẬP MÔN HỌC & ADMINS</p>
                <p>Khách hàng có thể linh hoạt nhấp chọn bất kỳ môn học nào có trong hệ thống và tiến hành các tác vụ bình thường:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Học sinh:</strong> Đăng nhập bằng tên & mật khẩu được giáo viên cấp thuộc ID lớp học đó.</li>
                  <li><strong>Giáo viên môn (Admin Môn):</strong> Nhấp vào Giáo viên, nhập mật mã riêng đã thiết lập tại bảng này để truy cập độc quyền.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-amber-200">2. CSDL & BLUEPRINT ĐỨNG ĐỘC LẬP</p>
                <p>Khi bấm "Tạo môn học":</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Hệ thống tự động cấp phát 1 phân vùng học liệu CSDL mới trên Supabase với mã ID riêng, đảm bảo giáo trình giữa các môn là cô lập, độc lập và bảo mật an toàn.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

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
