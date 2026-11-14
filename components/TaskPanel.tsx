import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Clock, CheckCircle2, AlertCircle, Loader2, Search, X, Users,
  RefreshCw, Calendar, BookOpen, Check, UserCheck, AlertTriangle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { LessonTask, StudyLog, Student } from '../types';

interface TaskPanelProps {
  nodeId: string;
  student: Student | null;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
}

interface TaskMeta {
  requireHomework: boolean;
  startDate: string;
  endDate: string;
  isDraft?: boolean;
  targetType: 'all' | 'students';
  targetClasses: string[];
  targetStudentIds: string[];
}

const DEFAULT_TASK_META: TaskMeta = {
  requireHomework: false,
  startDate: '',
  endDate: '',
  isDraft: false,
  targetType: 'all',
  targetClasses: [],
  targetStudentIds: [],
};

function parseTaskMeta(rawDescription: string): { cleanDescription: string; meta: TaskMeta } {
  if (!rawDescription) return { cleanDescription: '', meta: { ...DEFAULT_TASK_META } };
  const match = rawDescription.match(/<!--task_meta:([\s\S]*?)-->/);
  let meta: TaskMeta = { ...DEFAULT_TASK_META };

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      meta = {
        requireHomework: Boolean(parsed.requireHomework),
        startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
        endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
        isDraft: Boolean(parsed.isDraft),
        targetType:
          parsed.targetType === 'students' && Array.isArray(parsed.targetStudentIds) && parsed.targetStudentIds.length > 0
            ? 'students'
            : 'all',
        targetClasses: Array.isArray(parsed.targetClasses) ? parsed.targetClasses : [],
        targetStudentIds: Array.isArray(parsed.targetStudentIds) ? parsed.targetStudentIds : [],
      };
    } catch {
      // Ignore malformed JSON metadata
    }
  }

  const cleanDescription = rawDescription.replace(/<!--task_meta:[\s\S]*?-->/g, '').trimEnd();
  return { cleanDescription, meta };
}

function serializeTaskMeta(cleanDescription: string, meta: TaskMeta): string {
  const stripped = cleanDescription.replace(/<!--task_meta:[\s\S]*?-->/g, '').trimEnd();
  const payload: TaskMeta = {
    requireHomework: Boolean(meta.requireHomework),
    startDate: meta.startDate || '',
    endDate: meta.endDate || '',
    isDraft: Boolean(meta.isDraft),
    targetType: meta.targetType === 'students' && meta.targetStudentIds.length > 0 ? 'students' : 'all',
    targetClasses: meta.targetClasses || [],
    targetStudentIds: meta.targetType === 'students' ? meta.targetStudentIds : [],
  };
  return `${stripped}\n<!--task_meta:${JSON.stringify(payload)}-->`;
}

function toDatetimeLocalValue(val: string, isEnd: boolean): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return isEnd ? `${val}T23:59` : `${val}T00:00`;
  }
  return val.slice(0, 16);
}

function parseDeadlineDate(val?: string, isEnd = false): Date | null {
  if (!val) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(isEnd ? `${val}T23:59:59` : `${val}T00:00:00`);
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDeadlineDisplay(val?: string, isEnd = false): string {
  const d = parseDeadlineDate(val, isEnd);
  if (!d) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isQuestionTargetedToStudent(rawContent: string, s: Student | null): boolean {
  const match = (rawContent || '').match(/<!--hw_meta:([\s\S]*?)-->/);
  if (!match || !match[1]) return true;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.targetType !== 'students') return true;
    if (!s || s.is_guest) return false;
    const byId = Array.isArray(parsed.targetStudentIds) && parsed.targetStudentIds.includes(s.id);
    const byCode =
      Array.isArray(parsed.targetStudentCodes) &&
      parsed.targetStudentCodes.some((c: string) => c.toUpperCase() === s.name.toUpperCase());
    return Boolean(byId || byCode);
  } catch {
    return true;
  }
}

const TaskPanel: React.FC<TaskPanelProps> = ({ nodeId, student, isAdmin, themeColor, gradeId }) => {
  const [task, setTask] = useState<LessonTask | null>(null);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState<{
    description: string;
    minMaterialTime: number;
    minFlashcardTime: number;
    minQuizTime: number;
    requireHomework: boolean;
    startDate: string;
    endDate: string;
    targetType: 'all' | 'students';
    targetClasses: string[];
    targetStudentIds: string[];
  }>({
    description: '',
    minMaterialTime: 10,
    minFlashcardTime: 5,
    minQuizTime: 0,
    requireHomework: false,
    startDate: '',
    endDate: '',
    targetType: 'all',
    targetClasses: [],
    targetStudentIds: [],
  });

  // Homework status for current student
  const [hwStatus, setHwStatus] = useState<{
    completed: boolean;
    answeredCount: number;
    totalCount: number;
    lastSubmittedAt: string | null;
  }>({ completed: false, answeredCount: 0, totalCount: 0, lastSubmittedAt: null });

  // Student targeting inside Edit Form
  const [gradeStudents, setGradeStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Incomplete students modal
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);
  const [incompleteStudentsData, setIncompleteStudentsData] = useState<any[]>([]);
  const [incompleteSearch, setIncompleteSearch] = useState('');

  const matchesGrade = useCallback(
    (itemNodeId: string, itemGradeId: any) => {
      if (gradeId && itemGradeId) {
        return itemGradeId == gradeId;
      }
      const cleanId = itemNodeId.replace(/^homework_/, '');
      if (cleanId.startsWith('g10-')) return gradeId == 10;
      if (cleanId.startsWith('g11-')) return gradeId == 11;
      if (cleanId.startsWith('g12-')) return gradeId == 12;
      return true;
    },
    [gradeId]
  );

  const loadGradeStudents = useCallback(async () => {
    if (!gradeId) return;
    setLoadingStudents(true);
    try {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('grade_id', gradeId)
        .order('name', { ascending: true });
      if (data) setGradeStudents(data);
    } catch (err) {
      console.error('Error loading grade students:', err);
    } finally {
      setLoadingStudents(false);
    }
  }, [gradeId]);

  const fetchIncompleteStudents = async () => {
    if (!gradeId) return;
    setLoadingIncomplete(true);
    try {
      const minMat = task?.minMaterialTime || 0;
      const minFlash = task?.minFlashcardTime || 0;
      const requireHw = Boolean(task?.requireHomework);

      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('grade_id', gradeId)
        .order('name', { ascending: true });
      if (!students) return;

      const targetStudents =
        task?.targetType === 'students' && task.targetStudentIds && task.targetStudentIds.length > 0
          ? students.filter(s => task.targetStudentIds!.includes(s.id))
          : students;

      const { data: allLogs } = await supabase.from('study_logs').select('*').eq('node_id', nodeId);

      // Fetch homework records if required
      let hwQuestions: any[] = [];
      let hwAnswers: any[] = [];
      if (requireHw) {
        const hwNodeId = `homework_${nodeId}`;
        const { data: forumData } = await supabase.from('forum_comments').select('*');
        if (forumData) {
          const relevant = forumData.filter((item: any) => {
            const nid = item.nodeId || item.node_id || '';
            const gid = item.gradeId || item.grade_id;
            const isTarget = nid === hwNodeId || nid.startsWith(`${hwNodeId}_ans_`);
            return isTarget && matchesGrade(nid, gid);
          });
          hwQuestions = relevant.filter(
            (item: any) => item.isAdmin === true || item.isAdmin === 'true' || item.is_admin === true || item.author === 'Giáo viên'
          );
          hwAnswers = relevant.filter(
            (item: any) => !(item.isAdmin === true || item.isAdmin === 'true' || item.is_admin === true || item.author === 'Giáo viên')
          );
        }
      }

      const processed = targetStudents.map(s => {
        const studentLogs = allLogs?.filter(l => l.student_id === s.id) || [];
        const matSec = studentLogs.filter(l => l.type === 'material').reduce((acc, curr) => acc + curr.duration, 0);
        const flashSec = studentLogs.filter(l => l.type === 'flashcard').reduce((acc, curr) => acc + curr.duration, 0);

        const matCompleted = matSec / 60 >= minMat;
        const flashCompleted = flashSec / 60 >= minFlash;

        let hwCompleted = true;
        if (requireHw) {
          const hwNodeId = `homework_${nodeId}`;
          const assignedQs = hwQuestions.filter(q => isQuestionTargetedToStudent(q.content || '', s));
          const studentAns = hwAnswers.filter(a => (a.author || '').includes(`[${s.name}]`));
          if (assignedQs.length > 0) {
            hwCompleted = assignedQs.every(q =>
              studentAns.some(a => (a.nodeId || a.node_id) === `${hwNodeId}_ans_${q.id}`)
            );
          } else {
            hwCompleted = studentAns.length > 0;
          }
        }

        const fullyCompleted = matCompleted && flashCompleted && hwCompleted;

        return {
          id: s.id,
          name: s.name,
          fullName: s.full_name,
          matTime: matSec,
          flashTime: flashSec,
          matCompleted,
          flashCompleted,
          hwCompleted,
          fullyCompleted,
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
      const { data: allTasks, error } = await supabase
        .from('lesson_tasks')
        .select('*')
        .eq('node_id', nodeId);

      if (error) throw error;

      const taskData = allTasks?.find((t: any) => {
        const id = t.node_id || '';
        const tGradeId = t.grade_id || t.gradeId;
        return matchesGrade(id, tGradeId);
      });

      if (taskData) {
        const { cleanDescription, meta } = parseTaskMeta(taskData.description || '');
        const parsedTask: LessonTask = {
          id: taskData.id,
          nodeId: taskData.node_id,
          description: cleanDescription,
          minMaterialTime: taskData.min_material_time || 0,
          minFlashcardTime: taskData.min_flashcard_time || 0,
          minQuizTime: taskData.min_quiz_time || 0,
          createdAt: taskData.created_at,
          requireHomework: meta.requireHomework,
          startDate: meta.startDate,
          endDate: meta.endDate,
          targetType: meta.targetType,
          targetClasses: meta.targetClasses,
          targetStudentIds: meta.targetStudentIds,
          isDraft: meta.isDraft,
        };
        setTask(parsedTask);
        setFormData({
          description: cleanDescription,
          minMaterialTime: parsedTask.minMaterialTime,
          minFlashcardTime: parsedTask.minFlashcardTime,
          minQuizTime: parsedTask.minQuizTime,
          requireHomework: meta.requireHomework,
          startDate: toDatetimeLocalValue(meta.startDate, false),
          endDate: toDatetimeLocalValue(meta.endDate, true),
          targetType: meta.targetType,
          targetClasses: meta.targetClasses,
          targetStudentIds: meta.targetStudentIds,
        });
      } else {
        setTask(null);
      }

      if (student) {
        const { data: logData } = await supabase
          .from('study_logs')
          .select('*')
          .eq('student_id', student.id)
          .eq('node_id', nodeId);

        if (logData) setLogs(logData);

        // Fetch student homework submissions for this node
        const hwNodeId = `homework_${nodeId}`;
        const { data: forumData } = await supabase.from('forum_comments').select('*');
        if (forumData) {
          const relevant = forumData.filter((item: any) => {
            const nid = item.nodeId || item.node_id || '';
            const gid = item.gradeId || item.grade_id;
            const isTarget = nid === hwNodeId || nid.startsWith(`${hwNodeId}_ans_`);
            return isTarget && matchesGrade(nid, gid);
          });

          const hwQuestions = relevant.filter(
            (item: any) => item.isAdmin === true || item.isAdmin === 'true' || item.is_admin === true || item.author === 'Giáo viên'
          );
          const visibleQuestions = hwQuestions.filter(q => isQuestionTargetedToStudent(q.content || '', student));

          const myAnswers = relevant.filter(
            (item: any) =>
              !(item.isAdmin === true || item.isAdmin === 'true' || item.is_admin === true || item.author === 'Giáo viên') &&
              (item.author || '').includes(`[${student.name}]`)
          );

          let answeredCount = 0;
          const totalCount = visibleQuestions.length;
          let completed = false;

          if (totalCount > 0) {
            answeredCount = visibleQuestions.filter(q =>
              myAnswers.some(a => (a.nodeId || a.node_id) === `${hwNodeId}_ans_${q.id}`)
            ).length;
            completed = answeredCount >= totalCount;
          } else {
            answeredCount = myAnswers.length;
            completed = myAnswers.length > 0;
          }

          const sortedDates = myAnswers
            .map((a: any) => a.createdAt || a.created_at)
            .filter(Boolean)
            .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());

          setHwStatus({
            completed,
            answeredCount,
            totalCount,
            lastSubmittedAt: sortedDates[0] || null,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching task data:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId, student, matchesGrade]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  useEffect(() => {
    if (isEditing && isAdmin && gradeId && gradeStudents.length === 0) {
      loadGradeStudents();
    }
  }, [isEditing, isAdmin, gradeId, gradeStudents.length, loadGradeStudents]);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const fullDescription = serializeTaskMeta(formData.description, {
        requireHomework: formData.requireHomework,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isDraft: false,
        targetType: formData.targetType,
        targetClasses: formData.targetClasses,
        targetStudentIds: formData.targetStudentIds,
      });

      const payload = {
        node_id: nodeId,
        grade_id: String(gradeId),
        description: fullDescription,
        min_material_time: Number(formData.minMaterialTime) || 0,
        min_flashcard_time: Number(formData.minFlashcardTime) || 0,
        created_at: new Date().toISOString(),
      };

      if (task) {
        const { error } = await supabase.from('lesson_tasks').update(payload).eq('id', task.id);
        if (error) {
          console.warn("Update with grade_id failed, trying without:", error);
          const { error: error2 } = await supabase
            .from('lesson_tasks')
            .update({
              description: fullDescription,
              min_material_time: payload.min_material_time,
              min_flashcard_time: payload.min_flashcard_time,
            })
            .eq('id', task.id);
          if (error2) throw error2;
        }
      } else {
        const { error } = await supabase.from('lesson_tasks').insert([payload]);
        if (error) {
          console.error("Task insert error, retrying without grade_id:", error);
          const { error: error2 } = await supabase.from('lesson_tasks').insert([
            {
              node_id: payload.node_id,
              description: payload.description,
              min_material_time: payload.min_material_time,
              min_flashcard_time: payload.min_flashcard_time,
            },
          ]);
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
        fetchTaskData();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = (type: 'material' | 'flashcard' | 'quiz') => {
    return logs.filter(l => l.type === type).reduce((acc, curr) => acc + curr.duration, 0);
  };

  const getFilteredEditStudents = () => {
    const q = studentSearch.trim();
    if (!q) return gradeStudents;
    const tokens = q
      .split(/[\s,;]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.length > 1) {
      return gradeStudents.filter(s => {
        const code = s.name.toLowerCase();
        return tokens.some(tok => code === tok || code.startsWith(tok) || code.includes(tok));
      });
    }
    const lower = q.toLowerCase();
    return gradeStudents.filter(
      s => s.name.toLowerCase().includes(lower) || (s.full_name || '').toLowerCase().includes(lower)
    );
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
  const hwPercent = task?.requireHomework
    ? hwStatus.completed
      ? 100
      : hwStatus.totalCount > 0
      ? Math.round((hwStatus.answeredCount / hwStatus.totalCount) * 100)
      : 0
    : 100;

  const isCompleted =
    matTime >= matMinSec &&
    flashTime >= flashMinSec &&
    (!task?.requireHomework || hwStatus.completed);

  // Deadline status calculation
  const now = new Date();
  const startDt = parseDeadlineDate(task?.startDate, false);
  const endDt = parseDeadlineDate(task?.endDate, true);
  const isNotStarted = Boolean(startDt && now < startDt);
  const isOverdue = Boolean(endDt && now > endDt && !isCompleted);
  const timeRemainingMs = endDt ? endDt.getTime() - now.getTime() : null;
  const remainingDays = timeRemainingMs !== null ? Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24)) : null;
  const remainingHours =
    timeRemainingMs !== null ? Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : null;

  const isStudentExcluded =
    !isAdmin &&
    task?.targetType === 'students' &&
    task.targetStudentIds &&
    task.targetStudentIds.length > 0 &&
    (!student || student.is_guest || !task.targetStudentIds.includes(student.id));

  const filteredEditStudents = getFilteredEditStudents();

  return (
    <div className="space-y-6">
      {student?.is_guest && (
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500" size={20} />
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-tight">
              Bạn đang dùng tài khoản khách. <br />
              Kết quả sẽ KHÔNG được lưu vào danh sách quản lý của giáo viên.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (window.location.href = '/student')}
            className="px-4 py-2 bg-amber-500 text-white text-[9px] font-black uppercase rounded-xl shadow-lg shadow-amber-100"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <ClipboardCheck className={`text-${themeColor}-600`} size={20} />
            Nhiệm vụ học tập
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {isAdmin ? 'Quản lý yêu cầu, bài tập về nhà & thời hạn' : 'Tiến độ hoàn thành của em'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && task && !isEditing && (
            <button
              type="button"
              onClick={handleBatchUpdateGrade}
              className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 transition-all shadow-sm border border-amber-100 flex items-center gap-2"
              title="Khắc phục dữ liệu cũ bị ẩn"
            >
              <RefreshCw size={14} /> Đồng bộ Khối
            </button>
          )}
          {isAdmin && task && !isEditing && (
            <button
              type="button"
              onClick={() => {
                setShowIncompleteModal(true);
                fetchIncompleteStudents();
              }}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 hover:text-amber-700 transition-all shadow-sm border border-slate-200 flex items-center gap-2"
            >
              <Users size={14} /> Danh sách chưa xong
            </button>
          )}
          {isAdmin && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 bg-${themeColor}-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-${themeColor}-100 transition-all hover:scale-105 flex items-center gap-2`}
            >
              {task ? 'Chỉnh sửa / Giao nhiệm vụ' : 'Tạo nhiệm vụ'}
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveTask} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6 animate-in zoom-in-95">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả nhiệm vụ</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none transition-all min-h-[100px] text-sm font-medium"
              placeholder="Nhập yêu cầu học tập (Vd: Xem video bài giảng, luyện flashcard và nộp bài tập về nhà)..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600 font-medium">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian học liệu (Phút)</label>
              <input
                type="number"
                min={0}
                value={formData.minMaterialTime}
                onChange={e => setFormData({ ...formData, minMaterialTime: parseInt(e.target.value || '0', 10) })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian Flashcard (Phút)</label>
              <input
                type="number"
                min={0}
                value={formData.minFlashcardTime}
                onChange={e => setFormData({ ...formData, minFlashcardTime: parseInt(e.target.value || '0', 10) })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none font-bold"
              />
            </div>
          </div>

          {/* HOMEWORK REQUIREMENT TOGGLE */}
          <div
            onClick={() => setFormData(prev => ({ ...prev, requireHomework: !prev.requireHomework }))}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
              formData.requireHomework
                ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                formData.requireHomework ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300'
              }`}
            >
              {formData.requireHomework && <Check size={15} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className={formData.requireHomework ? 'text-emerald-600' : 'text-slate-400'} />
                <p className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Yêu cầu hoàn thành nhiệm vụ "Bài tập về nhà"
                </p>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                Khi bật, học sinh bắt buộc phải nộp câu trả lời trong mục <strong>Bài tập về nhà</strong> của bài học này mới được tính là hoàn thành nhiệm vụ.
              </p>
            </div>
          </div>

          {/* DEADLINE / SCHEDULE SETTINGS */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-indigo-600" />
                <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Thời hạn hoàn thành nhiệm vụ</h4>
              </div>
              {(formData.startDate || formData.endDate) && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, startDate: '', endDate: '' }))}
                  className="text-[10px] font-bold text-rose-500 hover:underline uppercase"
                >
                  Xóa thời hạn
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời gian bắt đầu (tùy chọn)</label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full p-3.5 bg-white border border-slate-200 focus:border-indigo-400 rounded-2xl outline-none text-sm font-semibold text-slate-700"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hạn chót hoàn thành (Deadline)</label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full p-3.5 bg-white border border-slate-200 focus:border-indigo-400 rounded-2xl outline-none text-sm font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* ASSIGN TO ALL OR SPECIFIC STUDENTS BY CODE */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Đối tượng giao nhiệm vụ</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, targetType: 'all' }))}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  formData.targetType === 'all' ? 'border-indigo-600 bg-white shadow-sm' : 'border-slate-200 bg-white/50'
                }`}
              >
                <p className="text-xs font-black text-slate-800 uppercase">Tất cả học sinh (Cả lớp)</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, targetType: 'students' }))}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  formData.targetType === 'students' ? 'border-indigo-600 bg-white shadow-sm' : 'border-slate-200 bg-white/50'
                }`}
              >
                <p className="text-xs font-black text-slate-800 uppercase">
                  Chọn HS / Nhóm theo mã ({formData.targetStudentIds.length} HS)
                </p>
              </button>
            </div>

            {formData.targetType === 'students' && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Tìm mã HS, tiền tố nhóm (vd: 11B, HS0) hoặc HS01, HS02..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-400 rounded-xl outline-none text-xs font-semibold text-slate-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const ids = filteredEditStudents.map(s => s.id);
                      setFormData(prev => ({
                        ...prev,
                        targetStudentIds: Array.from(new Set([...prev.targetStudentIds, ...ids])),
                      }));
                    }}
                    disabled={filteredEditStudents.length === 0}
                    className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-40 shrink-0"
                  >
                    Chọn nhóm lọc ({filteredEditStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetStudentIds: [] }))}
                    className="px-3.5 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0"
                  >
                    Bỏ chọn hết
                  </button>
                </div>

                {loadingStudents ? (
                  <p className="text-xs text-slate-400 font-bold py-4 text-center">Đang tải danh sách học sinh...</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto p-1">
                    {filteredEditStudents.map(s => {
                      const checked = formData.targetStudentIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                            checked ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setFormData(prev => ({
                                ...prev,
                                targetStudentIds: checked
                                  ? prev.targetStudentIds.filter(id => id !== s.id)
                                  : [...prev.targetStudentIds, s.id],
                              }))
                            }
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{s.full_name || ''}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
              Hủy
            </button>
            <button type="submit" className={`px-8 py-3 bg-${themeColor}-600 text-white font-bold text-xs uppercase rounded-xl tracking-widest shadow-lg shadow-${themeColor}-100`}>
              Lưu nhiệm vụ
            </button>
          </div>
        </form>
      ) : task ? (
        isStudentExcluded ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-16 text-center space-y-3">
            <UserCheck size={36} className="mx-auto text-slate-300" />
            <h4 className="text-base font-black text-slate-500 uppercase">Không có nhiệm vụ dành riêng cho mã của em</h4>
            <p className="text-xs text-slate-400 font-medium">Nhiệm vụ học tập của bài học này hiện đang được giáo viên giao cho nhóm học sinh khác.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* DEADLINE BANNER */}
              {(startDt || endDt) && (
                <div
                  className={`p-5 rounded-3xl border flex flex-wrap items-center justify-between gap-4 ${
                    isOverdue
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : isCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isNotStarted
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isOverdue
                          ? 'bg-rose-600 text-white'
                          : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isOverdue ? <AlertTriangle size={18} /> : <Calendar size={18} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Thời hạn hoàn thành</p>
                      <div className="text-xs font-bold flex flex-wrap gap-x-4 gap-y-1 mt-0.5">
                        {startDt && <span>Bắt đầu: {formatDeadlineDisplay(task.startDate, false)}</span>}
                        {endDt && <span>Hạn chót: {formatDeadlineDisplay(task.endDate, true)}</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isOverdue ? (
                      <span className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Đã quá hạn
                      </span>
                    ) : isCompleted && endDt ? (
                      <span className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Đã hoàn thành
                      </span>
                    ) : isNotStarted ? (
                      <span className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Chưa tới giờ mở
                      </span>
                    ) : endDt && timeRemainingMs !== null && timeRemainingMs > 0 ? (
                      <span className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider">
                        Còn {remainingDays} ngày {remainingHours} giờ
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full bg-${themeColor}-600`}></div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Yêu cầu từ giáo viên</h4>
                  {task.targetType === 'students' && task.targetStudentIds && task.targetStudentIds.length > 0 && (
                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[9px] font-black uppercase">
                      Giao cho {task.targetStudentIds.length} HS
                    </span>
                  )}
                </div>
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

                    {task.requireHomework && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-end">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                            <BookOpen size={14} className="text-emerald-600" />
                            Hoàn thành Bài tập về nhà
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${hwStatus.completed ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {hwStatus.totalCount > 0
                              ? `${hwStatus.answeredCount}/${hwStatus.totalCount} nhiệm vụ`
                              : hwStatus.completed
                              ? 'Đã nộp bài'
                              : 'Chưa nộp bài'}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div
                            className={`h-full transition-all duration-1000 shadow-sm ${hwStatus.completed ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${hwPercent}%` }}
                          ></div>
                        </div>
                        {!hwStatus.completed && (
                          <p className="text-[11px] font-medium text-amber-700">
                            Em hãy chuyển sang tab <strong>Bài tập về nhà</strong> để trả lời và gửi bài nộp.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
                <div
                  className={`w-20 h-20 rounded-[28px] flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100'
                      : isOverdue
                      ? 'bg-rose-50 text-rose-500'
                      : 'bg-slate-50 text-slate-300'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={40} /> : isOverdue ? <AlertTriangle size={40} /> : <AlertCircle size={40} />}
                </div>
                <div>
                  <h5
                    className={`font-black uppercase tracking-tight text-lg ${
                      isCompleted ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {isCompleted ? 'Đã hoàn thành' : isOverdue ? 'Quá hạn' : 'Chưa hoàn thành'}
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
                  <span className="text-[9px] font-black uppercase tracking-widest">Điều kiện hoàn thành</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Học liệu tối thiểu</p>
                    <p className="text-xl font-black text-white">{task.minMaterialTime}p</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Flashcard tối thiểu</p>
                    <p className="text-xl font-black text-white">{task.minFlashcardTime}p</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Bài tập về nhà</p>
                    <p className={`text-sm font-black mt-0.5 ${task.requireHomework ? 'text-emerald-400' : 'text-white/50'}`}>
                      {task.requireHomework ? 'Bắt buộc nộp bài' : 'Không bắt buộc'}
                    </p>
                  </div>
                  {endDt && (
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Hạn chót</p>
                      <p className="text-xs font-black text-amber-300 mt-1">{formatDeadlineDisplay(task.endDate, true)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
            <ClipboardCheck size={40} className="text-slate-200" />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-400 uppercase tracking-tight">Chưa có nhiệm vụ</h4>
            <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
              {isAdmin ? 'Mục này giúp quản lý yêu cầu học liệu, flashcard, bài tập về nhà và hạn hoàn thành cho học sinh.' : 'Giáo viên chưa giao nhiệm vụ cụ thể cho bài học này.'}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
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
                    Học sinh chưa hoàn thành ({incompleteStudentsData.length})
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ HỌC TẬP {task?.requireHomework ? '& BÀI TẬP VỀ NHÀ' : ''}
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
                <button
                  type="button"
                  onClick={() => {
                    setShowIncompleteModal(false);
                    setIncompleteStudentsData([]);
                  }}
                  className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm"
                >
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
                    .filter(
                      s =>
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

                        <div className="grid grid-cols-2 gap-3 mb-4">
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

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {s.matCompleted ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-amber-500" />}
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                              {s.matCompleted ? 'Đã xem học liệu' : 'Chưa xem đủ thời gian'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {s.flashCompleted ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-amber-500" />}
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                              {s.flashCompleted ? 'Đã luyện Flashcard' : 'Flashcard chưa đạt'}
                            </p>
                          </div>
                          {task?.requireHomework && (
                            <div className="flex items-center gap-2">
                              {s.hwCompleted ? <CheckCircle2 size={12} className="text-emerald-500" /> : <AlertCircle size={12} className="text-rose-500" />}
                              <p className={`text-[9px] font-bold uppercase tracking-tight ${s.hwCompleted ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {s.hwCompleted ? 'Đã nộp Bài tập về nhà' : 'Chưa nộp Bài tập về nhà'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

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
