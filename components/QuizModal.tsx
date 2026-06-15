
import React, { useState, useEffect, useCallback } from 'react';
import { X, BrainCircuit, Trophy, CheckCircle2, XCircle, AlertCircle, Send, Save, RefreshCw, Trash2, Shuffle, Pencil, PlusCircle, Eye } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { QuizQuestion, Student } from '../types';
import { renderLatex, getSafeEnv } from '../utils';
import ConfirmModal from './ConfirmModal';

// Robust helper to sanitize a list of quiz questions, guaranteeing that options is always a valid string array.
const sanitizeQuestions = (rawQuestions: any): QuizQuestion[] => {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions.map((q: any) => {
    if (!q) {
      return {
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: ''
      };
    }
    
    // 1. Ensure options is an array of strings
    let options: string[] = [];
    if (Array.isArray(q.options)) {
      options = q.options.map((opt: any) => opt !== null && opt !== undefined ? String(opt).trim() : '');
    } else if (q.options && typeof q.options === 'object') {
      // If options is an object somehow (e.g. {A: '...', B: '...'})
      options = Object.values(q.options).map((opt: any) => opt !== null && opt !== undefined ? String(opt).trim() : '');
    }
    
    // Default to 4 options if not enough are present
    if (options.length === 0) {
      options = ['', '', '', ''];
    }

    const explanationText = typeof q.explanation === 'string' ? q.explanation : '';

    // 2. Normalize correctIndex
    let correctIndex = -1;
    const rawVal = q.correctIndex;

    if (rawVal !== null && rawVal !== undefined) {
      if (typeof rawVal === 'number') {
        correctIndex = rawVal;
      } else {
        const valStr = String(rawVal).trim();
        // Check if rawVal is exactly matching one of the option texts (case insensitive)
        const optMatchIdx = options.findIndex(opt => opt.toLowerCase() === valStr.toLowerCase());
        if (optMatchIdx !== -1) {
          correctIndex = optMatchIdx;
        } else {
          const parsed = parseInt(valStr, 10);
          if (!isNaN(parsed)) {
            correctIndex = parsed;
          } else {
            // Check for 'A', 'B', 'C', 'D'
            const charCode = valStr.toUpperCase().charCodeAt(0);
            if (charCode >= 65 && charCode <= 68) {
              correctIndex = charCode - 65;
            }
          }
        }
      }
    }

    // 3. Smart parsing from the 'explanation' text.
    // Dynamic explanations written by AI usually indicate the correct answer clearly.
    // e.g., "Chọn đáp án A", "Phương án đúng là C", "Đáp án đúng: B", "Chọn D", "Do đó chọn B".
    let explanationChoice = -1;
    if (explanationText) {
      const patterns = [
        /(?:chọn|đáp án|phương án|lựa chọn|đúng là|kết quả là|đáp số)\s+([A-D])\b/i,
        /\b([A-D])\s+(?:là\s+)?(?:đáp án|phương án|lựa chọn)\s+(?:đúng|chính xác)\b/i,
        /(?:đáp án|phương án|chọn)\s*:\s*([A-D])\b/i,
        /\bphương án đúng\s+(?:là\s+)?([A-D])\b/i,
        /\bvậy\s+(?:ta\s+)?(?:chọn|đáp án)\s+([A-D])\b/i
      ];

      for (const pattern of patterns) {
        const match = explanationText.match(pattern);
        if (match && match[1]) {
          explanationChoice = match[1].toUpperCase().charCodeAt(0) - 65;
          break;
        }
      }
    }

    // If an explicit choice is found in explanations, prioritize it (since AI's explanations are usually correct)
    if (explanationChoice >= 0 && explanationChoice < options.length) {
      correctIndex = explanationChoice;
    } else {
      // Sửa lỗi 1-based index (A=1, B=2, C=3, D=4)
      // Nếu correctIndex có giá trị bằng độ dài (ví dụ: gán bằng 4 với mảng 4 phần tử) thì chắc chắn là 1-based
      if (correctIndex === options.length) {
        correctIndex = options.length - 1; // 4 -> 3
      }
    }

    // Ensure within valid bounds
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    return {
      question: typeof q.question === 'string' ? q.question : (q.title || ''),
      options,
      correctIndex,
      explanation: explanationText
    };
  });
};

interface QuizModalProps {
  nodeId: string;
  lessonTitle: string;
  lessonUrl?: string;
  isAdmin: boolean;
  selectedGrade: number | null;
  themeColor: string;
  student: Student | null;
  subjectName?: string;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ nodeId, lessonTitle, lessonUrl, isAdmin, selectedGrade, themeColor, student, subjectName, onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [fullBank, setFullBank] = useState<QuizQuestion[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{title: string, msg: string} | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [resolvedDbId, setResolvedDbId] = useState<number | null>(null);
  
  // State quản lý API Key riêng của môn/grade hiện tại
  const [modalApiKey, setModalApiKey] = useState(() => {
    return localStorage.getItem(`gemini_api_key_grade_${selectedGrade}`) || '';
  });

  const handleSaveModalApiKey = (keyVal: string) => {
    setModalApiKey(keyVal);
    if (keyVal.trim()) {
      localStorage.setItem(`gemini_api_key_grade_${selectedGrade}`, keyVal.trim());
    } else {
      localStorage.removeItem(`gemini_api_key_grade_${selectedGrade}`);
    }
  };

  // State cho việc sửa/thêm thủ công
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // -1 là thêm mới
  const [editForm, setEditForm] = useState<QuizQuestion | null>(null);

  // Helper chuẩn hóa chỉ số đáp án đúng (hỗ trợ cả Number, String, "A","B","C","D" hay Option Text)
  const getNormalizedIndex = (correctVal: any, options: string[]): number => {
    const opts = Array.isArray(options) ? options : [];
    if (correctVal === null || correctVal === undefined) return 0;
    if (typeof correctVal === 'number' && correctVal >= 0 && correctVal < opts.length) {
      return correctVal;
    }
    const valStr = String(correctVal).trim();
    const parsedNum = parseInt(valStr, 10);
    if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum < opts.length) {
      return parsedNum;
    }
    if (valStr.length === 1) {
      const charCode = valStr.toUpperCase().charCodeAt(0);
      if (charCode >= 65 && charCode <= 65 + opts.length - 1) {
        return charCode - 65;
      }
    }
    const lowercaseVal = valStr.toLowerCase();
    const matchedIdx = opts.findIndex(opt => String(opt).trim().toLowerCase() === lowercaseVal);
    if (matchedIdx !== -1) {
      return matchedIdx;
    }
    return 0;
  };

  // Helper so khớp đáp án đã chọn với đáp án đúng
  const checkIsCorrect = (userAns: number | null, correctVal: any, options: string[]): boolean => {
    if (userAns === null || userAns === undefined) return false;
    const opts = Array.isArray(options) ? options : [];
    const normalizedCorrect = getNormalizedIndex(correctVal, opts);
    return userAns === normalizedCorrect;
  };

  const getDbId = () => {
    // 1. Nếu nodeId dạng uniqueId có dấu gạch ngang (g{grade}-{timestamp})
    // Lấy trực tiếp phần timestamp (13 chữ số) để truy vấn CSDL đồng bộ, chính xác
    if (typeof nodeId === 'string' && nodeId.includes('-')) {
      const parts = nodeId.split('-');
      const lastPart = parts[parts.length - 1];
      const timestamp = parseInt(lastPart);
      // Đảm bảo là một timestamp Unix millisecond hợp lệ (ít nhất 11 chữ số trở lên, ví dụ >= 100 tỉ)
      if (!isNaN(timestamp) && timestamp >= 100000000000) {
        return timestamp;
      }
    }

    // 2. Fallback cho các cấu trúc bài học di sản
    const numericPart = nodeId.replace(/\D/g, '');
    const baseId = parseInt(numericPart || "0");
    if (!selectedGrade || selectedGrade <= 12) {
      if (selectedGrade === 11 || selectedGrade === 1 || !selectedGrade) return baseId;
      return (selectedGrade * 100000000000000) + baseId;
    } else {
      return baseId % 900000000000000;
    }
  };

  const getPossibleDbIds = () => {
    const ids: number[] = [];
    const directId = getDbId();
    ids.push(directId);

    // Xử lý tiền tố và phần số
    const numericPart = nodeId.replace(/\D/g, '');
    const baseId = parseInt(numericPart || "0");
    if (!isNaN(baseId) && baseId > 0) {
      ids.push(baseId);
      if (selectedGrade && selectedGrade <= 12) {
        ids.push((selectedGrade * 100000000000000) + baseId);
      }
      ids.push((10 * 100000000000000) + baseId);
      ids.push((11 * 100000000000000) + baseId);
      ids.push((12 * 100000000000000) + baseId);
      ids.push((1 * 100000000000000) + baseId);
    }

    // Nếu ID có dấu gạch ngang (timestamp sau dấu gạch)
    if (typeof nodeId === 'string' && nodeId.includes('-')) {
      const parts = nodeId.split('-');
      const lastPart = parts[parts.length - 1];
      const timestamp = parseInt(lastPart);
      if (!isNaN(timestamp) && timestamp >= 100000000000) {
        ids.push(timestamp);
        if (selectedGrade && selectedGrade <= 12) {
          ids.push((selectedGrade * 100000000000000) + timestamp);
        }
        ids.push((10 * 100000000000000) + timestamp);
        ids.push((11 * 100000000000000) + timestamp);
        ids.push((12 * 100000000000000) + timestamp);
        ids.push((1 * 100000000000000) + timestamp);
      }
    }

    return Array.from(new Set(ids.filter(id => id > 0)));
  };

  const pickRandomQuestions = (bank: QuizQuestion[], count: number = 5) => {
    if (bank.length <= count) return [...bank];
    const shuffled = [...bank].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const fetchFromDB = async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const candidateIds = getPossibleDbIds();
      const { data: records, error } = await supabase.from('quiz_data').select('id, data').in('id', candidateIds);
      if (error) {
        console.error("Lỗi khi tải Quiz từ Database:", error);
      }
      
      if (records && records.length > 0) {
        let bestMatch = null;
        const currentPrefixStr = selectedGrade ? String(selectedGrade) : '';
        const exactCurrentDbId = getDbId();
        
        const matchedExact = records.find(r => r.id === exactCurrentDbId);
        if (matchedExact) {
          bestMatch = matchedExact;
        } else if (currentPrefixStr) {
          const matchedPrefix = records.find(r => String(r.id).startsWith(currentPrefixStr));
          if (matchedPrefix) {
            bestMatch = matchedPrefix;
          }
        }

        // Với lớp 11 hoặc khối 1, kiểm tra xem có ID di sản không có tiền tố để làm fallback (< 1e14)
        if (!bestMatch && (selectedGrade === 11 || selectedGrade === 1)) {
          const legacyMatch = records.find(r => r.id < 100000000000000);
          if (legacyMatch) {
            bestMatch = legacyMatch;
          }
        }
        
        if (bestMatch) {
          setResolvedDbId(bestMatch.id);
          
          if (bestMatch.data && Array.isArray(bestMatch.data)) {
            const bank = sanitizeQuestions(bestMatch.data);
            setFullBank(bank);
            const displaySet = isAdmin ? bank : pickRandomQuestions(bank, 5);
            setQuestions(displaySet);
            setUserAnswers(new Array(displaySet.length).fill(null));
            setIsAiMode(false);
            setLoading(false);
            return;
          }
        }
      }
      
      // Nếu không tìm thấy quiz nào trong toàn bộ candidateIds
      setResolvedDbId(getDbId()); // Gán ID mặc định theo tiêu chuẩn hiện tại
      setQuestions([]);
      setFullBank([]);
      if (!isAdmin) {
        setErrorInfo({ title: "Chưa có bài tập", msg: "Giáo viên chưa soạn bài tập cho mục này." });
      }
    } catch (e) { 
      console.error("Exception in fetchFromDB:", e); 
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFromDB(); }, [nodeId]);
  
  const handleShuffleNewSet = () => {
    if (fullBank.length === 0) return;
    const newSet = pickRandomQuestions(fullBank, 5);
    setQuestions(newSet);
    setUserAnswers(new Array(newSet.length).fill(null));
    setShowResults(false);
  };

  const generateQuiz = async () => {
    setLoading(true);
    setErrorInfo(null);
    const apiKey = modalApiKey || getSafeEnv('API_KEY');
    if (!apiKey) {
      setErrorInfo({ title: "Lỗi cấu hình", msg: "Vui lòng thiết lập API Key." });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const gradeLabel = selectedGrade === 1 ? '11' : (selectedGrade || '11');
      const resolvedSubject = subjectName || `Vật lý ${gradeLabel}`;
      
      let prompt = `Bạn là một giáo viên chuyên nghiệp môn ${resolvedSubject}. Hãy tạo 10 câu hỏi trắc nghiệm khách quan về bài học/chủ đề: "${lessonTitle}". 
      Phân bổ mức độ câu hỏi hợp lý: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng. 
      Lưu ý bắt buộc về tính nhất quán của đáp án đúng:
      1. Trường "options" chứa 4 đáp án trắc nghiệm dạng văn bản.
      2. Trường "correctIndex" PHẢI là chỉ số index 0-based (từ 0 đến 3) tương ứng với vị trí đáp án đúng trong mảng "options". Có nghĩa là: 0 = đáp án thứ nhất, 1 = đáp án thứ hai, 2 = đáp án thứ ba, 3 = đáp án thứ tư. Tuyệt đối không được dùng số 1-based (1, 2, 3, 4) hay các ký tự A, B, C, D cho trường "correctIndex".
      3. Ở cuối phần giải thích chi tiết trong trường "explanation", bạn phải luôn ghi rõ một câu kết luận có dạng "Chọn đáp án [A|B|C|D]." (ví dụ: "Chọn đáp án B." hoặc "Do vậy, phương án đúng là C.") để người dùng dễ theo dõi và đối chiếu.

      QUY TẮC CÔNG THỨC & KÝ HIỆU VẬT LÝ BẮT BUỘC (RẤT QUAN TRỌNG):
      - Mọi ký hiệu đại lượng vật lý (ví dụ: F, m, a, v, t, d, s, P, N, F_mst, u_t...), đơn vị đo lường (ví dụ: m/s^2, kg, N, m/s...) hay công thức dù là siêu đơn giản hay phức tạp (ví dụ: P = m.g, F = m.a...) ĐỀU PHẢI được bọc hoàn toàn bằng cặp dấu đô-la đơn $...$ (ví dụ: $F_{mst} = \\mu_t . N$, $m$, $a$, $m/s^2$) để hiển thị đẹp dưới định dạng LaTeX.
      - TUYỆT ĐỐI KHÔNG viết dạng chữ thường thông thường như "F_mst" hay "N", "P" hay "u_t", hãy chuyển tất cả thành LaTeX chuẩn tương đương như $F_{mst}$, $N$, $P$, $\\mu_t$.
      - Chữ cái chỉ số dưới (subscript) phải được đặt trong dấu ngoặc nhọn đúng chuẩn LaTeX (ví dụ: viết $F_{mst}$ hoặc $F_{\\text{mst}}$, KHÔNG viết thô $F\\_mst$).
      - Bạn phải kiểm tra kỹ toàn bộ câu hỏi (question), các lựa chọn (options) và phần giải thích (explanation) để đảm bảo không một đại lượng vật lý hay công thức nào bị sót mà viết thô không bọc dấu $. Sau khi viết xong, hãy quét lại một lần để bọc $ cho mọi đại lượng vật lý đơn lẻ và công thức.`;

      const tools: any[] = [];
      if (lessonUrl) {
        tools.push({ googleSearch: {} });
        prompt = `Hãy truy cập và đọc nội dung tài liệu học tập từ đường link sau đây: ${lessonUrl}. 
        Dựa trên nội dung tài liệu đó, với vai trò là giáo viên môn ${resolvedSubject}, hãy soạn thảo 10 câu hỏi trắc nghiệm khách quan. 
        Nếu không truy cập được link hoặc nội dung không phù hợp, hãy soạn dựa trên tên bài học/chủ đề chính: "${lessonTitle}".
        Phân bổ mức độ câu hỏi hợp lý: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng (Tỉ lệ 40% - 30% - 30%). 
        Lưu ý bắt buộc về tính nhất quán của đáp án đúng:
        1. Trường "options" chứa 4 đáp án trắc nghiệm dạng văn bản.
        2. Trường "correctIndex" PHẢI là chỉ số index 0-based (từ 0 đến 3) tương ứng với vị trí đáp án đúng trong mảng "options". Có nghĩa là: 0 = đáp án thứ nhất, 1 = đáp án thứ hai, 2 = đáp án thứ ba, 3 = đáp án thứ tư. Tuyệt đối không được dùng số 1-based (1, 2, 3, 4) hay các ký tự A, B, C, D cho trường "correctIndex".
        3. Ở cuối phần giải thích chi tiết trong trường "explanation", bạn phải luôn ghi rõ một câu kết luận có dạng "Chọn đáp án [A|B|C|D]." (ví dụ: "Chọn đáp án B." hoặc "Do vậy, phương án đúng là C.") để người dùng dễ theo dõi và đối chiếu.

        QUY TẮC CÔNG THỨC & KÝ HIỆU VẬT LÝ BẮT BUỘC (RẤT QUAN TRỌNG):
        - Mọi ký hiệu đại lượng vật lý (ví dụ: F, m, a, v, t, d, s, P, N, F_mst, u_t...), đơn vị đo lường (ví dụ: m/s^2, kg, N, m/s...) hay công thức dù là siêu đơn giản hay phức tạp (ví dụ: P = m.g, F = m.a...) ĐỀU PHẢI được bọc hoàn toàn bằng cặp dấu đô-la đơn $...$ (ví dụ: $F_{mst} = \\mu_t . N$, $m$, $a$, $m/s^2$) để hiển thị đẹp dưới định dạng LaTeX.
        - TUYỆT ĐỐI KHÔNG viết dạng chữ thường thông thường như "F_mst" hay "N", "P" hay "u_t", hãy chuyển tất cả thành LaTeX chuẩn tương đương như $F_{mst}$, $N$, $P$, $\\mu_t$.
        - Chữ cái chỉ số dưới (subscript) phải được đặt trong dấu ngoặc nhọn đúng chuẩn LaTeX (ví dụ: viết $F_{mst}$ hoặc $F_{\\text{mst}}$, KHÔNG viết thô $F\\_mst$).
        - Bạn phải kiểm tra kỹ toàn bộ câu hỏi (question), các lựa chọn (options) và phần giải thích (explanation) để đảm bảo không một đại lượng vật lý hay công thức nào bị sót mà viết thô không bọc dấu $. Sau khi viết xong, hãy quét lại một lần để bọc $ cho mọi đại lượng vật lý đơn lẻ và công thức.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          tools: tools.length > 0 ? tools : undefined,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            }
          }
        }
      });
      const qDataRaw = JSON.parse(response.text || "[]");
      const qData = sanitizeQuestions(qDataRaw);
      setQuestions(qData);
      setUserAnswers(new Array(qData.length).fill(null));
      setIsAiMode(true);
      setShowResults(false);
    } catch (e: any) { 
      console.error("AI Error:", e);
      // Fallback: If tools/link failing, try one more time without tools
      if (lessonUrl) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const gradeLabel = selectedGrade === 1 ? '11' : (selectedGrade || '11');
          const resolvedSubject = subjectName || `Vật lý ${gradeLabel}`;
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: `Bạn là giáo viên môn ${resolvedSubject}. Hãy tạo 10 câu trắc nghiệm cho bài/chủ đề: "${lessonTitle}". Phân bổ 4 Biết, 3 Hiểu, 3 Vận dụng. 
            Mỗi câu hỏi phải có mảng "options" chứa đúng 4 phần tử. Trường "correctIndex" PHẢI là chỉ số index dạng 0-based từ 0 đến 3 (0 = phương án đầu tiên, 1 = phương án thứ hai, v.v.). Tuyệt đối không dùng 1-based index (1-4) hay chữ cái A-D.
            Ở câu cuối của phần giải thích "explanation", hãy viết rõ dòng kết luận: "Chọn đáp án [A|B|C|D]."
            
            QUY TẮC CÔNG THỨC & KÝ HIỆU VẬT LÝ BẮT BUỘC: 
            Mọi ký hiệu, đại lượng vật lý đơn lẻ (như $F$, $m$, $a$, $v$, $t$, $N$, $P$, $F_{mst}$, $\\mu_t$...), đơn vị đo lường (như $m/s^2$, $kg$, $N$, $m/s$...) hoặc công thức (như $P = m.g$, $F = m.a$...) ĐỀU PHẢI được bọc tuyệt đối bằng cặp dấu đô-la đơn $...$ (LaTeX). Không viết dạng chữ thường thông thường hay viết tắt không bọc dấu $.`,
            config: { responseMimeType: "application/json" }
          });
          const qDataRaw = JSON.parse(response.text || "[]");
          const qData = sanitizeQuestions(qDataRaw);
          setQuestions(qData);
          setUserAnswers(new Array(qData.length).fill(null));
          setIsAiMode(true);
          setShowResults(false);
          return;
        } catch (innerE) {}
      }
      setErrorInfo({ title: "Lỗi AI", msg: "AI gặp khó khăn khi truy cập tài liệu. Vui lòng thử lại sau hoặc kiểm tra link." }); 
    }
    finally { setLoading(false); }
  };

  const saveToDB = async (customData?: QuizQuestion[]) => {
    const dataToSave = sanitizeQuestions(customData || questions);
    if (dataToSave.length === 0) return;
    setSaving(true);
    setSaveStatus(null);
    const targetDbId = resolvedDbId || getDbId();
    try {
      const { data: current, error: fetchError } = await supabase.from('quiz_data').select('data').eq('id', targetDbId).maybeSingle();
      if (fetchError) {
        console.error("Lỗi khi đọc quiz_data cũ:", fetchError);
        throw new Error("Không thể kiểm tra dữ liệu cũ: " + fetchError.message);
      }
      
      let updatedBank: QuizQuestion[] = (current?.data && Array.isArray(current.data)) ? sanitizeQuestions(current.data) : [];
      
      if (customData) {
        // Trường hợp cập nhật từ form sửa/thêm thủ công (đã xử lý logic mảng ở ngoài)
        updatedBank = sanitizeQuestions(customData);
      } else {
        // Trường hợp lưu từ AI Draft (cộng dồn)
        const newQuestions = dataToSave.filter(q => !updatedBank.some(ex => ex.question === q.question));
        updatedBank = [...updatedBank, ...newQuestions];
      }

      const { error: upsertError } = await supabase.from('quiz_data').upsert({ id: targetDbId, data: updatedBank });
      if (upsertError) {
        console.error("Lỗi upsert quiz_data:", upsertError);
        throw new Error(upsertError.message + " | Code: " + upsertError.code);
      }

      setFullBank(updatedBank);
      setQuestions(updatedBank);
      setUserAnswers(new Array(updatedBank.length).fill(null));
      setIsAiMode(false);
      
      setSaveStatus({
        type: 'success',
        message: customData 
          ? "Đã lưu thay đổi vào CSDL đám mây thành công!" 
          : "Đã lưu kho câu hỏi thành công vào CSDL đám mây!"
      });
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (e: any) { 
      console.error("Chi tiết lỗi lưu CSDL:", e);
      setSaveStatus({ 
        type: 'error', 
        message: "Lỗi lưu CSDL: " + (e?.message || "Không xác định. Kiểm tra RLS hoặc kết nối mạng.") 
      });
      setTimeout(() => setSaveStatus(null), 8000);
    }
    finally { setSaving(false); }
  };

  // Logic Sửa / Xóa từng câu
  const deleteQuestion = (index: number) => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa câu hỏi trắc nghiệm",
      message: "Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi? Thao tác này sẽ cập nhật kho lưu trữ.",
      onConfirm: () => {
        const newBank = fullBank.filter((_, i) => i !== index);
        saveToDB(newBank);
      }
    });
  };

  const openEditForm = (index: number) => {
    setEditingIndex(index);
    if (index === -1) {
      setEditForm({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });
    } else {
      setEditForm({ ...fullBank[index] });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    let newBank = [...fullBank];
    if (editingIndex === -1) {
      newBank.push(editForm);
    } else if (editingIndex !== null) {
      newBank[editingIndex] = editForm;
    }
    const sanitizedBank = sanitizeQuestions(newBank);
    saveToDB(sanitizedBank);
    setEditingIndex(null);
    setEditForm(null);
  };

  const clearBank = async () => {
    setConfirmConfig({
      isOpen: true,
      title: "Xóa sạch bộ câu hỏi",
      message: "Bạn có chắc chắn muốn xóa sạch toàn bộ câu hỏi trong bộ câu hỏi của bài học này? Thao tác này không thể hoàn tác.",
      onConfirm: async () => {
        setSaving(true);
        setSaveStatus(null);
        const targetDbId = resolvedDbId || getDbId();
        try {
          const { error } = await supabase.from('quiz_data').delete().eq('id', targetDbId);
          if (error) throw error;
          setQuestions([]); 
          setFullBank([]); 
          setIsAiMode(false);
          setSaveStatus({ type: 'success', message: "Đã xóa sạch bộ câu hỏi khỏi CSDL đám mây!" });
          setTimeout(() => setSaveStatus(null), 4000);
        } catch (e: any) { 
          setSaveStatus({ type: 'error', message: "Lỗi xóa bộ câu hỏi: " + (e?.message || "Không xác định") }); 
          setTimeout(() => setSaveStatus(null), 4000);
        }
        finally { setSaving(false); }
      }
    });
  };

  const calculateScore = () => questions.filter((q, i) => checkIsCorrect(userAnswers[i], q.correctIndex, q.options)).length;

  const themeTextClasses = {
    'indigo-600': 'text-indigo-600',
    'emerald-600': 'text-emerald-600',
    'rose-600': 'text-rose-600',
  };

  const themeBgClasses = {
    'indigo-600': 'bg-indigo-600',
    'emerald-600': 'bg-emerald-600',
    'rose-600': 'bg-rose-600',
  };

  const themeHoverBgClasses = {
    'indigo-600': 'hover:bg-indigo-700',
    'emerald-600': 'hover:bg-emerald-700',
    'rose-600': 'hover:bg-rose-700',
  };

  const themeBorderClasses = {
    'indigo-600': 'focus:border-indigo-400',
    'emerald-600': 'focus:border-emerald-400',
    'rose-600': 'focus:border-rose-400',
  };

  const themeShadowClasses = {
    'indigo-600': 'shadow-indigo-100',
    'emerald-600': 'shadow-emerald-100',
    'rose-600': 'shadow-rose-100',
  };

  const themeLightBgClasses = {
    'indigo-600': 'bg-indigo-50/30',
    'emerald-600': 'bg-emerald-50/30',
    'rose-600': 'bg-rose-50/30',
  };

  const themeLightBorderClasses = {
    'indigo-600': 'border-indigo-100/50',
    'emerald-600': 'border-emerald-100/50',
    'rose-600': 'border-rose-100/50',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeBgClass = themeBgClasses[themeColor as keyof typeof themeBgClasses] || themeBgClasses['indigo-600'];
  const currentThemeHoverBgClass = themeHoverBgClasses[themeColor as keyof typeof themeHoverBgClasses] || themeHoverBgClasses['indigo-600'];
  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];
  const currentThemeShadowClass = themeShadowClasses[themeColor as keyof typeof themeShadowClasses] || themeShadowClasses['indigo-100'];
  const currentThemeLightBgClass = themeLightBgClasses[themeColor as keyof typeof themeLightBgClasses] || themeLightBgClasses['indigo-600'];
  const currentThemeLightBorderClass = themeLightBorderClasses[themeColor as keyof typeof themeLightBorderClasses] || themeLightBorderClasses['indigo-600'];

  const handleSubmit = () => {
    if (userAnswers.some(a => a === null)) { 
      setSaveStatus({ type: 'warning', message: "⚠️ Hãy hoàn thành tất cả câu hỏi trước khi nộp!" }); 
      setTimeout(() => setSaveStatus(null), 5000);
      return; 
    }
    
    // saveCurrentDuration(); // Gỡ bỏ theo yêu cầu
    
    const score = calculateScore();
    if (score >= (questions.length * 0.8)) { 
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); 
    }
    setShowResults(true);
  };

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl h-[85vh] flex flex-col rounded-[40px] shadow-2xl overflow-hidden border border-white relative">
        
        {/* MODAL SỬA/THÊM CÂU HỎI (OVERLAY) */}
        {editingIndex !== null && editForm && (
          <div className="absolute inset-0 z-[600] bg-white flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <header className="px-8 py-5 border-b flex justify-between items-center shrink-0">
               <h3 className={`text-xs font-black uppercase tracking-widest ${currentThemeTextClass}`}>{editingIndex === -1 ? 'Thêm câu hỏi mới' : `Chỉnh sửa câu ${editingIndex + 1}`}</h3>
               <button onClick={() => setEditingIndex(null)} className="p-2 text-slate-300 hover:text-red-500"><X size={20}/></button>
            </header>
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi (Dùng $...$ cho công thức)</label>
                 <textarea required value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm min-h-[100px] outline-none ${currentThemeBorderClass} transition-all font-medium`} />
                 <div className={`p-3 ${currentThemeLightBgClass} rounded-xl border ${currentThemeLightBorderClass} text-xs`}>
                    <span className={`font-black ${currentThemeTextClass} text-[9px] uppercase block mb-1`}>Xem trước:</span>
                    {renderLatex(editForm.question || '...')}
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {editForm.options.map((opt, i) => (
                   <div key={i} className="space-y-1">
                     <label className={`text-[9px] font-black uppercase tracking-widest ${editForm.correctIndex === i ? 'text-emerald-500' : 'text-slate-400'}`}>Đáp án {getOptionLabel(i)}</label>
                     <div className="flex gap-2">
                       <input required value={opt} onChange={e => { const o = [...editForm.options]; o[i] = e.target.value; setEditForm({...editForm, options: o}); }} className={`flex-1 p-3 bg-slate-50 border rounded-xl text-xs outline-none ${currentThemeBorderClass}`} />
                       <button type="button" onClick={() => setEditForm({...editForm, correctIndex: i})} className={`px-3 rounded-xl border transition-all ${editForm.correctIndex === i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-slate-300 hover:border-emerald-200'}`}><CheckCircle2 size={14}/></button>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lời giải chi tiết</label>
                 <textarea value={editForm.explanation} onChange={e => setEditForm({...editForm, explanation: e.target.value})} className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs min-h-[80px] outline-none ${currentThemeBorderClass}`} />
               </div>

               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setEditingIndex(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Hủy bỏ</button>
                 <button type="submit" className={`flex-1 py-4 ${currentThemeBgClass} text-white rounded-2xl font-black uppercase text-[10px] shadow-lg ${currentThemeShadowClass} tracking-widest flex items-center justify-center gap-2`}>
                   <Save size={14}/> {editingIndex === -1 ? 'Thêm vào kho' : 'Cập nhật câu hỏi'}
                 </button>
               </div>
            </form>
          </div>
        )}

        <header className="px-8 py-5 border-b flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${currentThemeBgClass} text-white rounded-2xl`}>
              <BrainCircuit size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 leading-none mb-1">
                {isAdmin ? (isAiMode ? 'BẢN NHÁP AI (10 CÂU)' : `NGÂN HÀNG (${fullBank.length} CÂU)`) : `LUYỆN TẬP (5/${fullBank.length} CÂU)`}
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[200px] leading-none">{lessonTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                {isAiMode && (
                  <button onClick={() => saveToDB()} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 disabled:opacity-50">
                    {saving ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>} Lưu & Cộng dồn
                  </button>
                )}
                {!isAiMode && fullBank.length > 0 && (
                  <button onClick={clearBank} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100">
                    <Trash2 size={12}/> Xóa sạch
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button>
          </div>
        </header>

        {saveStatus && (
          <div className={`px-8 py-3 flex items-center justify-between border-b animate-in fade-in slide-in-from-top duration-300 ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
            saveStatus.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-100' :
            'bg-rose-50 text-rose-800 border-rose-100'
          }`}>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              {saveStatus.type === 'success' ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> :
               saveStatus.type === 'warning' ? <AlertCircle size={14} className="text-amber-600 shrink-0" /> :
               <AlertCircle size={14} className="text-rose-600 shrink-0" />}
              <span>{saveStatus.message}</span>
            </div>
            <button onClick={() => setSaveStatus(null)} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Đóng</button>
          </div>
        )}

        {!student && !isAdmin && questions.length > 0 && (
           <div className="px-8 py-2 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest text-center border-b border-amber-100 animate-pulse">
             ⚠️ Bạn chưa đăng nhập. Thời gian luyện tập sẽ không được ghi nhận.
             <button onClick={() => window.location.href = '/student'} className="ml-2 underline text-amber-700">Đăng nhập ngay</button>
           </div>
        )}
        {student?.is_guest && !isAdmin && questions.length > 0 && (
           <div className="px-8 py-2 bg-sky-50 text-sky-600 text-[10px] font-black uppercase tracking-widest text-center border-b border-sky-100">
             ℹ️ Đang ở chế độ Khách. Kết quả sẽ không được lưu vào danh sách lớp.
             <button onClick={() => window.location.href = '/student'} className="ml-2 underline text-sky-700 font-black">ĐĂNG NHẬP CHÍNH THỨC</button>
           </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12 bg-slate-50/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className={`w-10 h-10 border-4 border-slate-100 border-t-${themeColor.split('-')[0]}-600 rounded-full animate-spin`}></div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Đang tải...</p>
            </div>
          ) : errorInfo ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle size={40} className="text-amber-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{errorInfo.msg}</p>
              {isAdmin && (
                <div className="flex flex-col gap-4 items-center w-full max-w-xs">
                  <button onClick={generateQuiz} className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full">Soạn bài với AI</button>
                  <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left mt-2 shadow-sm">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">API Key Gemini riêng</span>
                    <input 
                      type="password" 
                      value={modalApiKey} 
                      onChange={(e) => handleSaveModalApiKey(e.target.value)} 
                      placeholder="Nhập API Key riêng cho môn học..." 
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-400 font-mono"
                    />
                    <span className="text-[7.5px] text-slate-400 font-medium block mt-1 leading-normal">Lưu ý: API Key của bạn phải có quyền tạo câu hỏi về nội dung học thuật.</span>
                  </div>
                </div>
              )}
            </div>
          ) : questions.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className={`w-20 h-20 bg-${themeColor.split('-')[0]}-50 rounded-full flex items-center justify-center`}><BrainCircuit size={40} className={currentThemeTextClass}/></div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Chưa có câu hỏi nào</h4>
                  <p className="text-[11px] text-slate-400 font-medium max-w-[200px] mx-auto">Hãy sử dụng AI hoặc tự soạn câu hỏi để xây dựng ngân hàng tài liệu.</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-3 items-center w-full max-w-xs">
                    <button onClick={generateQuiz} className={`px-10 py-4 w-full ${currentThemeBgClass} text-white text-[11px] font-black uppercase rounded-2xl shadow-xl ${currentThemeShadowClass} ${currentThemeHoverBgClass} transition-all`}>Tạo 10 câu với AI</button>
                    <button onClick={() => openEditForm(-1)} className={`text-[10px] font-black uppercase text-slate-400 hover:${currentThemeTextClass} tracking-widest animate-pulse`}>Hoặc soạn thủ công</button>
                    
                    <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left mt-4 shadow-sm">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">API Key Gemini riêng</span>
                      <input 
                        type="password" 
                        value={modalApiKey} 
                        onChange={(e) => handleSaveModalApiKey(e.target.value)} 
                        placeholder="Nhập API Key riêng (nếu muốn)..." 
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="text-[7.5px] text-slate-400 font-medium block mt-1 leading-normal">Nếu để trống, hệ thống sẽ sử dụng API Key dùng chung để soạn bài.</span>
                    </div>
                  </div>
                )}
             </div>
          ) : !showResults ? (
            <>
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="group space-y-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative">
                  {isAdmin && !isAiMode && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 origin-right">
                       <button onClick={() => openEditForm(qIdx)} className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 hover:bg-amber-100"><Pencil size={12}/></button>
                       <button onClick={() => deleteQuestion(qIdx)} className="p-2 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-100"><Trash2 size={12}/></button>
                    </div>
                  )}
                  <div className="flex gap-4 items-start pr-12">
                    <span className={`${currentThemeTextClass} font-black text-lg leading-none`}>{qIdx + 1}.</span>
                    <div className="text-sm md:text-base font-bold text-slate-700 leading-relaxed">
                      {renderLatex(q.question)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => { const n = [...userAnswers]; n[qIdx] = oIdx; setUserAnswers(n); }} className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-3 ${userAnswers[qIdx] === oIdx ? `bg-${themeColor.split('-')[0]}-50 ${currentThemeBorderClass}` : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                        <span className={`text-xs font-black ${userAnswers[qIdx] === oIdx ? currentThemeTextClass : 'text-slate-300'}`}>{getOptionLabel(oIdx)}.</span>
                        <div className={`text-[13px] font-medium leading-tight ${userAnswers[qIdx] === oIdx ? `text-${themeColor.split('-')[0]}-900` : 'text-slate-600'}`}>{renderLatex(opt)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="h-4"></div>
            </>
          ) : (
            <div className="space-y-8 pb-10">
              <div className={`text-center p-8 bg-${themeColor.split('-')[0]}-50 rounded-[32px] border border-${themeColor.split('-')[0]}-100`}>
                  <Trophy size={48} className="text-amber-500 mx-auto mb-3" />
                  <h2 className="text-3xl font-black text-slate-900 uppercase">Kết quả: {calculateScore()}/{questions.length}</h2>
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const normalizedCorrect = getNormalizedIndex(q.correctIndex, q.options);
                  const isCorrect = checkIsCorrect(userAnswers[i], q.correctIndex, q.options);
                  const studentAnsIndex = userAnswers[i];
                  
                  return (
                    <div key={i} className={`p-5 rounded-[24px] border-2 ${isCorrect ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20'}`}>
                      <div className="flex gap-3 mb-3 items-start">
                         {isCorrect ? (
                           <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0"/>
                         ) : (
                           <XCircle size={18} className="text-red-500 mt-0.5 shrink-0"/>
                         )}
                         <p className="text-sm font-bold text-slate-700 leading-tight">{i+1}. {renderLatex(q.question)}</p>
                      </div>
                      
                      <div className="ml-7 space-y-2">
                         {/* Student's answer line */}
                         <div className="text-xs">
                           <span className="font-bold text-slate-500">Lựa chọn của em: </span>
                           {studentAnsIndex !== null && studentAnsIndex !== undefined && q.options[studentAnsIndex] !== undefined ? (
                             <span className={`font-semibold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                               {getOptionLabel(studentAnsIndex)}. {renderLatex(q.options[studentAnsIndex])}
                             </span>
                           ) : (
                             <span className="text-slate-400 italic font-medium">Chưa chọn đáp án</span>
                           )}
                         </div>

                         {/* Correct answer line */}
                         <div className="text-xs">
                           <span className="font-bold text-slate-500 font-sans">Đáp án chính xác: </span>
                           <span className="font-semibold text-green-600">
                             {getOptionLabel(normalizedCorrect)}. {renderLatex(q.options[normalizedCorrect] || '')}
                           </span>
                         </div>

                         {/* List of 4 options with color marks for visual reference */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-2.5">
                           {q.options.map((opt, oIdx) => {
                             const isCorrectOption = oIdx === normalizedCorrect;
                             const isStudentSelected = oIdx === studentAnsIndex;
                             
                             let optionStyle = "bg-slate-50 border-slate-100 text-slate-600";
                             let badgeStyle = "text-slate-300 font-bold";
                             
                             if (isCorrectOption) {
                               optionStyle = "bg-emerald-50 border-emerald-400 text-emerald-900 font-medium";
                               badgeStyle = "text-emerald-600 font-black";
                             } else if (isStudentSelected) {
                               optionStyle = "bg-rose-50 border-rose-400 text-rose-900 font-medium";
                               badgeStyle = "text-rose-600 font-black";
                             }
                             
                             return (
                               <div key={oIdx} className={`p-3 rounded-2xl text-left border-2 flex items-center gap-2 text-xs transition-colors ${optionStyle}`}>
                                 <span className={badgeStyle}>{getOptionLabel(oIdx)}.</span>
                                 <div className="leading-tight">{renderLatex(opt)}</div>
                               </div>
                             );
                           })}
                         </div>
                         
                         {/* Explanation */}
                         {q.explanation && (
                           <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl text-[11px] text-slate-500 mt-2">
                             <span className="font-black text-slate-400 uppercase tracking-widest block text-[8px] mb-1">Giải thích chi tiết:</span>
                             <div className="leading-relaxed">{renderLatex(q.explanation)}</div>
                           </div>
                         )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!loading && !errorInfo && questions.length > 0 && (
          <footer className="px-8 py-5 border-t bg-white flex justify-between items-center shrink-0">
             <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
               {showResults ? "ĐÃ HOÀN THÀNH" : (isAdmin ? (isAiMode ? "ĐANG SOẠN THẢO" : "XEM TOÀN BỘ KHO") : "BỘ 5 CÂU NGẪU NHIÊN")}
             </div>
             <div className="flex gap-2">
                {showResults ? (
                  <>
                    {!isAdmin && (
                      <button onClick={handleShuffleNewSet} className="px-8 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-emerald-700 flex items-center gap-2">
                        <Shuffle size={14}/> Làm bộ khác
                      </button>
                    )}
                    <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-black transition-all">Đóng</button>
                  </>
                ) : (
                  <>
                    {isAdmin ? (
                        <div className="flex gap-2">
                           <button onClick={() => openEditForm(-1)} className="px-4 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                             <PlusCircle size={14}/> Thủ công
                           </button>
                           <button onClick={generateQuiz} className="px-6 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                             <RefreshCw size={14}/> {isAiMode ? "Đổi bộ AI" : "Thêm 10 câu (AI)"}
                           </button>
                        </div>
                    ) : (
                        <button onClick={handleShuffleNewSet} className="px-6 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                          <Shuffle size={14}/> Trộn câu khác
                        </button>
                    )}
                    {isAdmin && isAiMode ? (
                      <button onClick={() => saveToDB()} disabled={saving} className="px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl shadow-emerald-100 flex items-center gap-2 active:scale-95 transition-all">
                        {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} Lưu vào CSDL
                      </button>
                    ) : (
                      <button onClick={handleSubmit} className={`px-10 py-3 ${currentThemeBgClass} text-white text-[10px] font-black uppercase rounded-2xl shadow-xl ${currentThemeShadowClass} flex items-center gap-2 ${currentThemeHoverBgClass} active:scale-95 transition-all`}>
                        Nộp bài <Send size={14}/>
                      </button>
                    )}
                  </>
                )}
             </div>
          </footer>
        )}
      </div>

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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .katex { font-size: 1.1em; color: inherit; white-space: normal; }
      `}</style>
    </div>
  );
};

export default QuizModal;
