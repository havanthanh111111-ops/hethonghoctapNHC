
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Clock, CheckCircle2, AlertCircle, Loader2, Search, X, Users, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { LessonTask, StudyLog, Student } from '../types';

interface TaskPanelProps {
  nodeId: string;
  student: Student | null;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
}

const TaskPanel: React.FC<TaskPanelProps> = ({ nodeId, student, isAdmin, themeColor, gradeId }) => {
  const [task, setTask] = useState<LessonTask | null>(null);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ description: '', minMaterialTime: 10, minFlashcardTime: 5, minQuizTime: 0 });
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);
  const [incompleteStudentsData, setIncompleteStudentsData] = useState<any[]>([]);
  const [incompleteSearch, setIncompleteSearch] = useState('');

  const fetchIncompleteStudents = async () => {
    if (!gradeId) return;
    setLoadingIncomplete(true);
    try {
      const minMat = task?.minMaterialTime || 0;
      const minFlash = task?.minFlashcardTime || 0;

      const { data: students } = await supabase.from('students').select('*').eq('grade_id', gradeId);
      if (!students) return;

      const { data: allLogs } = await supabase.from('study_logs').select('*').eq('node_id', nodeId);
      
      const processed = students.map(s => {
        const studentLogs = allLogs?.filter(l => l.student_id === s.id) || [];
        const matSec = studentLogs.filter(l => l.type === 'material').reduce((acc, curr) => acc + curr.duration, 0);
        const flashSec = studentLogs.filter(l => l.type === 'flashcard').reduce((acc, curr) => acc + curr.duration, 0);
        
        const matCompleted = (matSec / 60) >= minMat;
        const flashCompleted = (flashSec / 60) >= minFlash;
        const fullyCompleted = matCompleted && flashCompleted;

        return {
          id: s.id,
          name: s.name,
          fullName: s.full_name,
          matTime: matSec,
          flashTime: flashSec,
          matCompleted,
          flashCompleted,
          fullyCompleted
        };
      });

      setIncompleteStudentsData(processed.filter(p => !p.fullyCompleted));
    } catch (err) {
      console.error("Error fetching incomplete students:", err);
    } finally {
      setLoadingIncomplete(false);
    }
  };

  const fetchTaskData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch task for this node
      let query = supabase
        .from('lesson_tasks')
        .select('*')
        .eq('node_id', nodeId);
      
      const { data: allTasks, error } = await query;
      
      if (error) throw error;

      // Filter by grade_id and prefix logic to ensure isolation
      const taskData = allTasks?.find((t: any) => {
        const id = t.node_id || '';
        const tGradeId = t.grade_id || t.gradeId;
        
        // 1. Khớp theo grade_id rõ ràng
        if (gradeId && tGradeId) {
          return tGradeId == gradeId;
        }

        // 2. Khớp theo tiền tố ID
        if (id.startsWith('g10-')) return gradeId == 10;
        if (id.startsWith('g11-')) return gradeId == 11;
        if (id.startsWith('g12-')) return gradeId == 12;

        // 3. Dự phòng cho dữ liệu cũ
        return true;
      });
      
      setTask(taskData ? {
        id: taskData.id,
        nodeId: taskData.node_id,
        description: taskData.description,
        minMaterialTime: taskData.min_material_time,
        minFlashcardTime: taskData.min_flashcard_time,
        minQuizTime: taskData.min_quiz_time || 0,
        createdAt: taskData.created_at
      } : null);

      if (taskData) {
        setFormData({
          description: taskData.description,
          minMaterialTime: taskData.min_material_time,
          minFlashcardTime: taskData.min_flashcard_time,
          minQuizTime: taskData.min_quiz_time || 0
        });
      }

      // Fetch logs for this student and node
      if (student) {
        const { data: logData } = await supabase
          .from('study_logs')
          .select('*')
          .eq('student_id', student.id)
          .eq('node_id', nodeId);
        
        if (logData) setLogs(logData);
      }
    } catch (err) {
      console.error('Error fetching task data:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId, student]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        node_id: nodeId,
        grade_id: String(gradeId),
        description: formData.description,
        min_material_time: formData.minMaterialTime,
        min_flashcard_time: formData.minFlashcardTime,
        created_at: new Date().toISOString()
      };

      if (task) {
        let { error } = await supabase
          .from('lesson_tasks')
          .update(payload)
          .eq('id', task.id);
        if (error) {
           console.warn("Update with grade_id failed, trying without:", error);
           const { error: error2 } = await supabase.from('lesson_tasks').update({
             description: formData.description,
             min_material_time: formData.minMaterialTime,
             min_flashcard_time: formData.minFlashcardTime
           }).eq('id', task.id);
           if (error2) throw error2;
        }
      } else {
        const { error } = await supabase
          .from('lesson_tasks')
          .insert([payload]);
        if (error) {
           console.error("Task insert error, retrying without grade_id:", error);
           const { error: error2 } = await supabase.from('lesson_tasks').insert([{
             node_id: payload.node_id,
             description: payload.description,
             min_material_time: payload.min_material_time,
             min_flashcard_time: payload.min_flashcard_time
           }]);
           if (error2) throw error2;
        }
      }

      setIsEditing(false);
      fetchTaskData();
    } catch (err: any) {
      console.error('Error saving task:', err);
      alert('Lỗi lưu nhiệm vụ: ' + (err.message || "Kiểm tra quyền truy cập CSDL (Table lesson_tasks?)"));
    }
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId) return;
    setLoading(true);
    let successCount = 0;
    try {
      const gStr = String(gradeId);
      
      const tryUpdate = async (colNode: string, colGrade: string) => {
        const { data, error } = await supabase
          .from('lesson_tasks')
          .update({ [colGrade]: gStr })
          .eq(colNode, nodeId)
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
        alert(`Đã đồng bộ Khối ${gradeId} cho nhiệm vụ.`);
        fetchTaskData();
      } else {
        alert("Nhiệm vụ này đã có nhãn chính xác hoặc lỗi cấu trúc bảng.");
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = (type: 'material' | 'flashcard' | 'quiz') => {
    return logs
      .filter(l => l.type === type)
      .reduce((acc, curr) => acc + curr.duration, 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-slate-300" size={32} />
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Đang tải nhiệm vụ...</p>
      </div>
    );
  }

  const matTime = calculateTotalTime('material');
  const flashTime = calculateTotalTime('flashcard');
  const matMinSec = (task?.minMaterialTime || 0) * 60;
  const flashMinSec = (task?.minFlashcardTime || 0) * 60;

  const matPercent = Math.min(100, matMinSec > 0 ? (matTime / matMinSec) * 100 : 100);
  const flashPercent = Math.min(100, flashMinSec > 0 ? (flashTime / flashMinSec) * 100 : 100);

  const isCompleted = matTime >= matMinSec && flashTime >= flashMinSec;

  return (
    <div className="space-y-6">
      {student?.is_guest && (
         <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
               <AlertCircle className="text-amber-500" size={20} />
               <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-tight">
                  Bạn đang dùng tài khoản khách. <br/>
                  Kết quả sẽ KHÔNG được lưu vào danh sách quản lý của giáo viên.
               </p>
            </div>
            <button 
              onClick={() => window.location.href = '/student'}
              className="px-4 py-2 bg-amber-500 text-white text-[9px] font-black uppercase rounded-xl shadow-lg shadow-amber-100"
            >
              Đăng nhập ngay
            </button>
         </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <ClipboardCheck className={`text-${themeColor}-600`} size={20} />
            Nhiệm vụ học tập
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {isAdmin ? 'Quản lý yêu cầu bắt buộc' : 'Tiến độ hoàn thành của em'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && task && !isEditing && (
            <button 
              onClick={handleBatchUpdateGrade}
              className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 transition-all shadow-sm border border-amber-100 flex items-center gap-2"
              title="Khắc phục dữ liệu cũ bị ẩn"
            >
              <RefreshCw size={14} /> Đồng bộ Khối
            </button>
          )}
          {isAdmin && task && !isEditing && (
            <button 
              onClick={() => { setShowIncompleteModal(true); fetchIncompleteStudents(); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 hover:text-amber-700 transition-all shadow-sm border border-slate-200 flex items-center gap-2"
            >
              <Users size={14} /> Danh sách
            </button>
          )}
          {isAdmin && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 bg-${themeColor}-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-${themeColor}-100 transition-all hover:scale-105 flex items-center gap-2`}
            >
              {task ? 'Chỉnh sửa nhiệm vụ' : 'Tạo nhiệm vụ'}
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveTask} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-4 animate-in zoom-in-95">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả nhiệm vụ</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none transition-all min-h-[100px] text-sm font-medium"
              placeholder="Nhập yêu cầu học tập (Vd: Xem video bài giảng và rèn luyện flashcard)..."
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-500 font-medium">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian học liệu (Phút)</label>
              <input 
                type="number"
                value={formData.minMaterialTime}
                onChange={e => setFormData({ ...formData, minMaterialTime: parseInt(e.target.value) })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian Flashcard (Phút)</label>
              <input 
                type="number"
                value={formData.minFlashcardTime}
                onChange={e => setFormData({ ...formData, minFlashcardTime: parseInt(e.target.value) })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest">Hủy</button>
            <button type="submit" className={`px-8 py-2 bg-${themeColor}-600 text-white font-bold text-xs uppercase rounded-xl tracking-widest shadow-lg shadow-${themeColor}-100`}>Lưu nhiệm vụ</button>
          </div>
        </form>
      ) : task ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
               <div className={`absolute top-0 left-0 w-1.5 h-full bg-${themeColor}-600`}></div>
               <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3">Yêu cầu từ giáo viên</h4>
               <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                 {task.description}
               </div>
            </div>

            {!isAdmin && (
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tiến độ thực hiện</h4>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Xem học liệu</span>
                      <span className="text-[10px] font-black text-slate-400 tracking-tighter">
                        {Math.floor(matTime / 60)}p {matTime % 60}s <span className="text-slate-200">/</span> {task.minMaterialTime}p
                      </span>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full bg-${themeColor}-600 transition-all duration-1000 shadow-sm`} 
                        style={{ width: `${matPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Luyện Flashcards</span>
                      <span className="text-[10px] font-black text-slate-400 tracking-tighter">
                        {Math.floor(flashTime / 60)}p {flashTime % 60}s <span className="text-slate-200">/</span> {task.minFlashcardTime}p
                      </span>
                    </div>
                    <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full bg-${themeColor}-600 transition-all duration-1000 shadow-sm`} 
                        style={{ width: `${flashPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
             <div className={`bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4`}>
                <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-300'}`}>
                   {isCompleted ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                </div>
                <div>
                   <h5 className={`font-black uppercase tracking-tight text-lg ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                     {isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
                   </h5>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Trạng thái nhiệm vụ</p>
                </div>
                {isCompleted && (
                  <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100 animate-bounce">
                    Rất tốt!
                  </div>
                )}
             </div>

             <div className="bg-slate-900 p-8 rounded-[32px] shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-white opacity-40">
                   <Clock size={14} />
                   <span className="text-[9px] font-black uppercase tracking-widest">Thời gian tối thiểu</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Học liệu</p>
                      <p className="text-xl font-black text-white">{task.minMaterialTime}p</p>
                   </div>
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Flashcard</p>
                      <p className="text-xl font-black text-white">{task.minFlashcardTime}p</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4">
           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
              <ClipboardCheck size={40} className="text-slate-200" />
           </div>
           <div>
              <h4 className="text-xl font-black text-slate-400 uppercase tracking-tight">Chưa có nhiệm vụ</h4>
              <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
                {isAdmin ? 'Mục này giúp em quản lý yêu cầu học tập cho học sinh.' : 'Giáo viên chưa giao nhiệm vụ cụ thể cho bài học này.'}
              </p>
           </div>
           {isAdmin && (
             <button 
               onClick={() => setIsEditing(true)}
               className={`mt-4 px-8 py-3 bg-${themeColor}-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-${themeColor}-100`}
             >
               Thiết lập nhiệm vụ
             </button>
           )}
        </div>
      )}
      {/* INCOMPLETE STUDENTS MODAL */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-8 bg-slate-50 border-b border-slate-100 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-100">
                     <AlertCircle size={24} />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                        Học sinh chưa hoàn thành
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ HỌC TẬP
                     </p>
                  </div>
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="relative group flex-1 md:w-80">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-all" size={16} />
                     <input 
                       type="text" 
                       placeholder="Tìm theo Mã HS hoặc Họ tên..." 
                       value={incompleteSearch}
                       onChange={e => setIncompleteSearch(e.target.value)}
                       className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 focus:border-amber-400 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all shadow-sm"
                     />
                  </div>
                  <button onClick={() => { setShowIncompleteModal(false); setIncompleteStudentsData([]); }} className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                     <X size={20} />
                  </button>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
               {loadingIncomplete ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                     <RefreshCw className="animate-spin text-amber-600" size={32} />
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải danh sách...</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {incompleteStudentsData
                      .filter(s => 
                        s.name.toLowerCase().includes(incompleteSearch.toLowerCase()) || 
                        (s.fullName || '').toLowerCase().includes(incompleteSearch.toLowerCase())
                      )
                      .map(s => (
                        <div key={s.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all border-l-4 border-l-amber-500">
                           <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 shrink-0">
                                 {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                 <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{s.fullName || s.name}</h5>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mã HS: {s.name}</p>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                              <div className={`p-3 rounded-2xl border ${s.matCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Học liệu</p>
                                 <p className={`text-[10px] font-black ${s.matCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {Math.floor(s.matTime / 60)}p {s.matTime % 60}s
                                 </p>
                              </div>
                              <div className={`p-3 rounded-2xl border ${s.flashCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Flashcard</p>
                                 <p className={`text-[10px] font-black ${s.flashCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {Math.floor(s.flashTime / 60)}p {s.flashTime % 60}s
                                 </p>
                              </div>
                           </div>

                           <div className="flex items-center gap-2">
                              {s.matCompleted ? <CheckCircle2 size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-amber-500"/>}
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                 {s.matCompleted ? 'Đã xem học liệu' : 'Chưa xem đủ thời gian'}
                              </p>
                           </div>
                           <div className="flex items-center gap-2 mt-1">
                              {s.flashCompleted ? <CheckCircle2 size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-amber-500"/>}
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                 {s.flashCompleted ? 'Đã luyện Flashcard' : 'Flashcard chưa đạt'}
                              </p>
                           </div>
                        </div>
                      ))
                    }
                    
                    {incompleteStudentsData.length === 0 && !loadingIncomplete && (
                      <div className="col-span-full py-20 text-center opacity-40">
                         <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                         <p className="text-sm font-black uppercase tracking-widest text-slate-500">Tất cả học sinh đã hoàn thành!</p>
                      </div>
                    )}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskPanel;
