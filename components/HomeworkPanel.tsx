import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Trash2, Image as ImageIcon, Wifi, WifiOff, RefreshCw, ChevronDown, Eye,
  AlertCircle, BookOpen, Clock, CheckCircle2, Bold, Italic, List, Table as TableIcon,
  Link, Type, Palette, AlignLeft, AlignCenter, AlignRight, Calculator, X, Search,
  Edit2, Users, Lock, Info, ShieldCheck, Check, Globe, Filter, FileText, ExternalLink, UserCheck
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { supabase } from '../supabaseClient';
import { ForumComment, HomeworkMeta, Student } from '../types';
import ConfirmModal from './ConfirmModal';

// Import Katex CSS
const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

interface HomeworkPanelProps {
  nodeId: string;
  student: Student | null;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
}

const MATH_FORMULAS = [
  { label: 'PHÂN SỐ', display: 'a/b', value: '$\\frac{a}{b}$' },
  { label: 'CĂN BẬC 2', display: '√x', value: '$\\sqrt{x}$' },
  { label: 'CĂN BẬC N', display: 'ⁿ√x', value: '$\\sqrt[n]{x}$' },
  { label: 'MŨ', display: 'xⁿ', value: '$x^{n}$' },
  { label: 'SỐ HẠ', display: 'xi', value: '$x_{i}$' },
  { label: 'TỔNG (Σ)', display: 'Σ', value: '$\\sum_{i=1}^{n}$' },
  { label: 'TÍCH PHÂN (∫)', display: '∫', value: '$\\int_{a}^{b}$' },
  { label: 'GIỚI HẠN (LIM)', display: 'lim', value: '$\\lim_{x \\to \\infty}$' },
  { label: 'VECTOR', display: '→v', value: '$\\vec{v}$' },
  { label: 'GÓC', display: '∠A', value: '$\\widehat{A}$' },
  { label: 'TAM GIÁC', display: 'Δ', value: '$\\Delta ABC$' },
  { label: 'HỆ PHƯƠNG TRÌNH', display: '{', value: '$\\begin{cases} x =  \\\\ y =  \\end{cases}$' },
];

const FONT_SIZES = [
  { label: 'XS (12PX)', value: '12px' },
  { label: 'SM (14PX)', value: '14px' },
  { label: 'REG (16PX)', value: '16px' },
  { label: 'LG (20PX)', value: '20px' },
  { label: 'XL (24PX)', value: '24px' },
  { label: '2XL (32PX)', value: '32px' },
  { label: '3XL (48PX)', value: '48px' },
];

const FONTS = [
  { label: 'Sans (Inter)', value: 'Inter, sans-serif' },
  { label: 'Serif (Times)', value: 'serif' },
  { label: 'Mono (Space)', value: 'monospace' },
  { label: 'Display (Outfit)', value: 'Outfit, sans-serif' },
];

const COLORS = [
  { label: 'ĐEN', value: '#000000', bg: 'bg-black' },
  { label: 'XÁM', value: '#64748b', bg: 'bg-slate-500' },
  { label: 'ĐỎ', value: '#ef4444', bg: 'bg-red-500' },
  { label: 'CAM', value: '#f97316', bg: 'bg-orange-500' },
  { label: 'VÀNG', value: '#eab308', bg: 'bg-yellow-500' },
  { label: 'XANH LÁ', value: '#22c55e', bg: 'bg-green-500' },
  { label: 'XANH DƯƠNG', value: '#3b82f6', bg: 'bg-blue-500' },
  { label: 'TÍM', value: '#a855f7', bg: 'bg-purple-500' },
  { label: 'HỒNG', value: '#ec4899', bg: 'bg-pink-500' },
];

// --- Metadata Helpers (stored safely inside HTML comments in content) ---
const HW_META_REGEX = /<!--hw_meta:([\s\S]*?)-->/g;
const LEGACY_META_REGEX = /<!--(?:public|status):[^>]*-->/g;

function parseHomeworkMeta(rawContent: string): { cleanContent: string; meta: HomeworkMeta } {
  let meta: HomeworkMeta = { targetType: 'all', targetStudentIds: [], targetStudentCodes: [] };
  if (!rawContent) return { cleanContent: '', meta };

  const match = rawContent.match(/<!--hw_meta:([\s\S]*?)-->/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      meta = {
        targetType: parsed.targetType === 'students' ? 'students' : 'all',
        targetStudentIds: Array.isArray(parsed.targetStudentIds) ? parsed.targetStudentIds : [],
        targetStudentCodes: Array.isArray(parsed.targetStudentCodes) ? parsed.targetStudentCodes : [],
      };
    } catch {
      // Ignore malformed metadata
    }
  }

  const cleanContent = rawContent
    .replace(HW_META_REGEX, '')
    .replace(LEGACY_META_REGEX, '')
    .trimEnd();

  return { cleanContent, meta };
}

function serializeHomeworkMeta(cleanContent: string, meta?: HomeworkMeta): string {
  const stripped = cleanContent.replace(HW_META_REGEX, '').trimEnd();
  if (
    meta &&
    meta.targetType === 'students' &&
    ((meta.targetStudentIds && meta.targetStudentIds.length > 0) ||
      (meta.targetStudentCodes && meta.targetStudentCodes.length > 0))
  ) {
    return `${stripped}\n<!--hw_meta:${JSON.stringify(meta)}-->`;
  }
  return stripped;
}

function setCommentApprovalTag(rawContent: string, approved: boolean): string {
  const stripped = (rawContent || '')
    .replace(/<!--(?:status|public):[^>]*-->/gi, '')
    .trimEnd();
  return `${stripped}\n<!--status:${approved ? 'approved' : 'pending'}-->`;
}

// --- URL Classification & Normalization Helpers ---
function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;
  if (!url.includes('drive.google.com') && !url.includes('docs.google.com')) return null;
  if (url.includes('/drive/folders/')) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return null;
}

function normalizeImageUrl(url: string): string {
  const trimmed = (url || '').trim();
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }
  return trimmed;
}

function normalizePdfPreviewUrl(url: string): string {
  const trimmed = (url || '').trim();
  const driveId = extractGoogleDriveId(trimmed);
  if (driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  }
  return trimmed;
}

function extractNodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractNodeText(node.props.children);
  }
  return '';
}

function classifyResourceLink(href: string, labelText: string): 'image' | 'pdf' | 'other' {
  const lowerHref = (href || '').toLowerCase();
  const lowerLabel = (labelText || '').toLowerCase();

  // Check explicit image extensions or known image CDNs
  const imageExtRegex = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i;
  if (
    imageExtRegex.test(lowerHref) ||
    imageExtRegex.test(lowerLabel) ||
    lowerHref.includes('lh3.googleusercontent.com/d/') ||
    lowerHref.includes('i.ibb.co/') ||
    lowerHref.includes('i.imgur.com/')
  ) {
    return 'image';
  }

  // Check explicit non-PDF office/archive document extensions first so Drive .docx links stay as links
  const otherDocRegex = /\.(docx?|xlsx?|pptx?|csv|zip|rar|7z|txt|json|mp3|wav)(\?|#|$)/i;
  if (
    otherDocRegex.test(lowerHref) ||
    otherDocRegex.test(lowerLabel) ||
    lowerHref.includes('drive.google.com/drive/folders') ||
    lowerHref.includes('docs.google.com/document') ||
    lowerHref.includes('docs.google.com/spreadsheets') ||
    lowerHref.includes('docs.google.com/presentation')
  ) {
    return 'other';
  }

  // Check PDF files or Google Drive file links (which preview PDFs cleanly via /preview)
  const pdfRegex = /\.pdf(\?|#|$)/i;
  const driveId = extractGoogleDriveId(href);
  if (
    pdfRegex.test(lowerHref) ||
    pdfRegex.test(lowerLabel) ||
    lowerLabel.includes('pdf') ||
    (driveId !== null && (lowerHref.includes('/preview') || lowerHref.includes('/view') || lowerHref.includes('drive.google.com/file/d/')))
  ) {
    return 'pdf';
  }

  return 'other';
}

function normalizeUrlInput(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isValidHttpUrl(rawUrl: string): boolean {
  const normalized = normalizeUrlInput(rawUrl);
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function convertRawUrlsToMarkdownLinks(rawText: string): string {
  if (!rawText) return rawText;

  // Fix legacy template mistake: [https://...](url) -> [https://...](https://...)
  const fixedLegacy = rawText.replace(
    /\[(https?:\/\/[^\]]+)\]\(\s*url\s*\)/gi,
    (_, u) => `[${u}](${u})`
  );

  // Preserve existing markdown images/links and HTML tags; wrap any remaining bare URLs as [url](url)
  const tokenRegex = /(!?\[[^\]]*\]\([^)]+\)|<[^>]+>|https?:\/\/[^\s<>()[\]]+|\bwww\.[^\s<>()[\]]+)/gi;
  return fixedLegacy.replace(tokenRegex, (match) => {
    if (match.startsWith('![') || match.startsWith('[') || match.startsWith('<')) {
      return match;
    }
    // Strip unbalanced trailing punctuation like '.', ',', ';', '!', '?'
    let url = match;
    let trailing = '';
    while (/[.,;!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    if (!url) return match;
    const normalized = normalizeUrlInput(url);
    return `[${url}](${normalized})${trailing}`;
  });
}

function validateStudentMarkdownLinks(rawText: string): string | null {
  const { cleanContent } = parseHomeworkMeta(rawText);
  if (!cleanContent.trim()) return null;

  // Only catch unedited template placeholder without a valid URL inside brackets
  if (/\]\(\s*url\s*\)/i.test(cleanContent)) {
    return 'Liên kết chưa có đường dẫn hợp lệ (đang còn chữ "url"). Vui lòng dán đường dẫn thật hoặc nhấn nút Liên kết trên thanh công cụ!';
  }

  return null;
}

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkBreaks];
const REHYPE_PLUGINS = [rehypeRaw, rehypeKatex];

const ImageEmbedCard = React.memo<{ href: string; imgUrl: string; label: string }>(
  ({ href, imgUrl, label }) => {
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
      setLoadError(false);
    }, [imgUrl]);

    return (
      <span className="block my-3 not-prose rounded-2xl border border-slate-200 bg-slate-50/70 p-3 max-w-2xl">
        {!loadError ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="block group">
            <img
              src={imgUrl}
              alt={label || 'Hình ảnh đính kèm'}
              onError={() => setLoadError(true)}
              className="max-w-full max-h-[460px] rounded-xl object-contain mx-auto bg-white shadow-sm"
            />
          </a>
        ) : (
          <span className="block py-6 text-center text-xs font-semibold text-slate-500">
            Không thể tải xem trước ảnh trực tiếp — bấm "Mở ảnh" bên dưới để xem.
          </span>
        )}
        <span className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/70 text-[11px]">
          <span className="font-bold text-slate-700 truncate flex items-center gap-1.5">
            <ImageIcon size={13} className="text-indigo-500 shrink-0" />
            {label || 'Hình ảnh'}
          </span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline font-bold shrink-0 flex items-center gap-1"
          >
            Mở ảnh <ExternalLink size={11} />
          </a>
        </span>
      </span>
    );
  }
);

const PdfEmbedCard = React.memo<{ href: string; previewUrl: string; label: string }>(
  ({ href, previewUrl, label }) => (
    <span className="block my-4 not-prose rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <span className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <FileText size={14} />
          </span>
          <span className="text-xs font-bold text-slate-700 truncate">
            {label || 'Tài liệu PDF đính kèm'}
          </span>
        </span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 transition-colors"
        >
          Mở tab mới <ExternalLink size={11} />
        </a>
      </span>
      <iframe
        key={previewUrl}
        src={previewUrl}
        title={label || 'Xem tài liệu PDF'}
        className="w-full h-[480px] bg-slate-100 border-0 block"
        allow="autoplay"
      />
    </span>
  )
);

const SmartAnchor: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }> = ({
  href,
  children,
  ...props
}) => {
  const safeHref = href || '';
  const labelText = extractNodeText(children).trim();
  const kind = classifyResourceLink(safeHref, labelText);

  if (kind === 'image' && safeHref) {
    const imgUrl = normalizeImageUrl(safeHref);
    return <ImageEmbedCard href={safeHref} imgUrl={imgUrl} label={labelText || safeHref} />;
  }

  if (kind === 'pdf' && safeHref) {
    const previewUrl = normalizePdfPreviewUrl(safeHref);
    return (
      <PdfEmbedCard
        href={safeHref}
        previewUrl={previewUrl}
        label={labelText || 'Tài liệu PDF đính kèm'}
      />
    );
  }

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 my-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs border border-indigo-200 transition-colors no-underline not-prose max-w-full"
      {...props}
    >
      <ExternalLink size={12} className="shrink-0" />
      <span className="truncate">{children}</span>
    </a>
  );
};

const SmartImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ src, alt }) => {
  const rawSrc = typeof src === 'string' ? src : '';
  const safeSrc = normalizeImageUrl(rawSrc);
  const caption = alt && alt !== 'Alt text' && alt !== 'Hình ảnh' ? alt : '';
  return (
    <span className="block my-3 not-prose">
      <span className="inline-block rounded-2xl border border-slate-200 bg-slate-50 p-2 max-w-full">
        <img
          src={safeSrc}
          alt={alt || 'Hình ảnh'}
          className="max-w-full max-h-[480px] rounded-xl object-contain bg-white"
        />
        {caption && (
          <span className="block text-[11px] font-semibold text-slate-600 mt-2 px-1 text-center">
            {caption}
          </span>
        )}
      </span>
    </span>
  );
};

const SMART_MARKDOWN_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  a: SmartAnchor,
  img: SmartImage,
};

const SmartMarkdown = React.memo<{ content: string; className?: string }>(({ content, className }) => {
  const { cleanContent } = parseHomeworkMeta(content);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={SMART_MARKDOWN_COMPONENTS}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
});

const HomeworkPanel: React.FC<HomeworkPanelProps> = ({ nodeId, student, isAdmin, themeColor, gradeId }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [content, setContent] = useState('');
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnswersModal, setShowAnswersModal] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState<HomeworkMeta | undefined>(undefined);
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved'>('all');

  // Validation error inside editor
  const [editorError, setEditorError] = useState<string | null>(null);

  // Hyperlink Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkModalError, setLinkModalError] = useState<string | null>(null);

  // Image Link Modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageName, setImageName] = useState('');
  const [imageLinkUrl, setImageLinkUrl] = useState('');
  const [imageModalError, setImageModalError] = useState<string | null>(null);

  // Assign Homework Mission to Students Modal state
  const [assigningQuestion, setAssigningQuestion] = useState<ForumComment | null>(null);
  const [assignTargetType, setAssignTargetType] = useState<'all' | 'students'>('all');
  const [assignSelectedIds, setAssignSelectedIds] = useState<string[]>([]);
  const [assignStudentSearch, setAssignStudentSearch] = useState('');
  const [gradeStudents, setGradeStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);

  const isGuest = !isAdmin && (!student || student.is_guest === true || student.name === 'Khách');
  const homeworkNodeId = `homework_${nodeId}`;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const [debouncedPreviewContent, setDebouncedPreviewContent] = useState('');

  useEffect(() => {
    if (!content.trim()) {
      setDebouncedPreviewContent('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedPreviewContent(content);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    // Inject Katex CSS
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = KATEX_CSS;
      document.head.appendChild(link);
    }
  }, []);

  const captureSelection = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      selectionRangeRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      };
      return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    }
    return '';
  };

  const insertAtSelection = (insertedText: string) => {
    const textarea = textareaRef.current;
    const { start, end } = selectionRangeRef.current;
    if (!textarea) {
      setContent(prev => prev + insertedText);
      return;
    }
    const text = textarea.value;
    const safeStart = Math.min(start, text.length);
    const safeEnd = Math.min(end, text.length);
    const before = text.substring(0, safeStart);
    const after = text.substring(safeEnd);
    const newText = before + insertedText + after;
    setContent(newText);
    setEditorError(null);
    setTimeout(() => {
      textarea.focus();
      const cursor = safeStart + insertedText.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const wrapText = (tag: string, endTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + tag + (endTag || ""));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + tag + selectedText + (endTag || "") + after;
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length + selectedText.length);
    }, 0);
  };

  const applyStyle = (property: string, value: string) => {
    wrapText(`<span style="${property}: ${value}">`, "</span>");
    setActiveDropdown(null);
  };

  const openLinkModal = () => {
    const selected = captureSelection();
    setLinkName(selected && !/^https?:\/\//i.test(selected.trim()) ? selected.trim() : '');
    setLinkUrl(selected && /^https?:\/\//i.test(selected.trim()) ? selected.trim() : '');
    setLinkModalError(null);
    setShowLinkModal(true);
  };

  const handleConfirmLinkModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = linkName.trim();
    const normalizedUrl = normalizeUrlInput(linkUrl);

    if (!trimmedName) {
      setLinkModalError('Vui lòng nhập tên hiển thị cho liên kết.');
      return;
    }
    if (!isValidHttpUrl(normalizedUrl)) {
      setLinkModalError('Đường dẫn không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      return;
    }

    insertAtSelection(`[${trimmedName}](${normalizedUrl})`);
    setShowLinkModal(false);
    setLinkName('');
    setLinkUrl('');
    setLinkModalError(null);
  };

  const openImageModal = () => {
    const selected = captureSelection();
    setImageName(selected && !/^https?:\/\//i.test(selected.trim()) ? selected.trim() : '');
    setImageLinkUrl(selected && /^https?:\/\//i.test(selected.trim()) ? selected.trim() : '');
    setImageModalError(null);
    setShowImageModal(true);
  };

  const handleConfirmImageModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = imageName.trim() || 'Hình ảnh minh họa';
    const normalizedUrl = normalizeUrlInput(imageLinkUrl);

    if (!imageName.trim()) {
      setImageModalError('Vui lòng nhập tên hoặc chú thích bức hình.');
      return;
    }
    if (!isValidHttpUrl(normalizedUrl)) {
      setImageModalError('Đường link hình ảnh không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      return;
    }

    insertAtSelection(`![${trimmedName}](${normalizedUrl})`);
    setShowImageModal(false);
    setImageName('');
    setImageLinkUrl('');
    setImageModalError(null);
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    // Do not auto-wrap if user is pasting a URL directly inside existing markdown `](...)` or HTML tag `<...`
    const insideMarkdownHref = /!?\[[^\]]*\]\([^)]*$/.test(before);
    const insideHtmlTag = /<[^>]*$/.test(before);
    if (insideMarkdownHref || insideHtmlTag) {
      return;
    }

    const hasRawUrl = /https?:\/\/[^\s<>()[\]]+|\bwww\.[^\s<>()[\]]+/i.test(pasted);
    if (!hasRawUrl) return;

    const converted = convertRawUrlsToMarkdownLinks(pasted);
    if (converted !== pasted) {
      e.preventDefault();
      const newText = before + converted + after;
      setContent(newText);
      setDebouncedPreviewContent(newText);
      setEditorError(null);
      setTimeout(() => {
        textarea.focus();
        const cursor = start + converted.length;
        textarea.setSelectionRange(cursor, cursor);
      }, 0);
    }
  };

  const fetchComments = async (silent = false) => {
    if (!silent) setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('forum_comments')
        .select('*');

      if (error) {
        console.error("Supabase Select Error:", error);
        return;
      }

      if (data) {
        const mappedData = data
          .filter((item: any) => {
            const id = item.nodeId || item.node_id || '';
            const itemGradeId = item.gradeId || item.grade_id;

            const isTargetNode = id === homeworkNodeId || id.startsWith(`${homeworkNodeId}_ans_`);
            if (!isTargetNode) return false;

            if (gradeId && itemGradeId) {
              return itemGradeId == gradeId;
            }

            const cleanId = id.replace('homework_', '');
            if (cleanId.startsWith('g10-')) return gradeId == 10;
            if (cleanId.startsWith('g11-')) return gradeId == 11;
            if (cleanId.startsWith('g12-')) return gradeId == 12;

            return true;
          })
          .map((item: any) => {
            const isAdminItem =
              item.isAdmin === true ||
              item.isAdmin === 'true' ||
              item.is_admin === true ||
              item.is_admin === 'true' ||
              item.author === 'Giáo viên';
            const rawText = item.content || '';
            const hasApprovedTag = /<!--status:approved-->/i.test(rawText);

            return {
              id: item.id,
              nodeId: item.nodeId || item.node_id,
              author: item.author,
              content: rawText,
              imageUrl: item.imageUrl || item.image_url,
              createdAt: item.createdAt || item.created_at,
              isAdmin: isAdminItem,
              isApproved:
                isAdminItem ||
                hasApprovedTag ||
                item.isApproved === true ||
                item.isApproved === 'true' ||
                item.is_approved === true ||
                item.is_approved === 'true' ||
                item.isApproved === 1 ||
                item.is_approved === 1,
            };
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        setComments(mappedData);
      }
    } catch (err: any) {
      console.error("Fetch Exception:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`homework:${nodeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_comments',
        },
        () => {
          fetchComments(true);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nodeId, homeworkNodeId]);

  const openAssignModal = async (q: ForumComment) => {
    setAssigningQuestion(q);
    const { meta } = parseHomeworkMeta(q.content);
    setAssignTargetType(meta.targetType === 'students' ? 'students' : 'all');
    setAssignSelectedIds(meta.targetStudentIds || []);
    setAssignStudentSearch('');

    if (!gradeId) return;
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('grade_id', gradeId)
        .order('name', { ascending: true });
      if (!error && data) {
        setGradeStudents(data);
        // Ensure code-based preselection also maps to student IDs
        if (meta.targetStudentCodes && meta.targetStudentCodes.length > 0 && (!meta.targetStudentIds || meta.targetStudentIds.length === 0)) {
          const upperCodes = new Set(meta.targetStudentCodes.map(c => c.toUpperCase()));
          setAssignSelectedIds(data.filter(s => upperCodes.has(s.name.toUpperCase())).map(s => s.id));
        }
      }
    } catch (err) {
      console.error('Error loading students for assignment:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const getFilteredAssignStudents = () => {
    const q = assignStudentSearch.trim();
    if (!q) return gradeStudents;

    // Support comma, semicolon, whitespace or newline separated code list (e.g., "HS01, HS02, 11B05")
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
      s =>
        s.name.toLowerCase().includes(lower) ||
        (s.full_name || '').toLowerCase().includes(lower)
    );
  };

  const handleSaveAssignment = async () => {
    if (!assigningQuestion) return;
    setSavingAssign(true);
    try {
      const { cleanContent } = parseHomeworkMeta(assigningQuestion.content);
      const selectedStudents = gradeStudents.filter(s => assignSelectedIds.includes(s.id));
      const newMeta: HomeworkMeta =
        assignTargetType === 'students' && selectedStudents.length > 0
          ? {
              targetType: 'students',
              targetStudentIds: selectedStudents.map(s => s.id),
              targetStudentCodes: selectedStudents.map(s => s.name),
            }
          : {
              targetType: 'all',
              targetStudentIds: [],
              targetStudentCodes: [],
            };

      const updatedContent = serializeHomeworkMeta(cleanContent, newMeta);

      const { error } = await supabase
        .from('forum_comments')
        .update({ content: updatedContent })
        .eq('id', assigningQuestion.id);

      if (error) throw error;

      setComments(prev =>
        prev.map(c => (c.id === assigningQuestion.id ? { ...c, content: updatedContent } : c))
      );
      setAssigningQuestion(null);
    } catch (err: any) {
      console.error('Error saving homework assignment:', err);
      setEditorError('Lỗi lưu phân công học sinh: ' + (err.message || 'Kiểm tra kết nối'));
    } finally {
      setSavingAssign(false);
    }
  };

  const handleSubmit = async () => {
    if (isGuest) {
      setEditorError(
        'Chức năng nộp bài/trả lời đã được đóng băng cho khách vãng lai. Vui lòng đăng nhập tài khoản học sinh.'
      );
      return;
    }
    if (!content.trim()) {
      setEditorError('Vui lòng nhập nội dung trước khi gửi.');
      return;
    }

    const normalizedContent = convertRawUrlsToMarkdownLinks(content);
    const linkValidationError = validateStudentMarkdownLinks(normalizedContent);
    if (linkValidationError) {
      setEditorError(linkValidationError);
      return;
    }

    setEditorError(null);
    setLoading(true);

    const createdAt = new Date().toISOString();
    const authorName = isAdmin
      ? 'Giáo viên'
      : student
      ? `[${student.name}] ${student.full_name || ''}`
      : 'Học sinh';
    const targetNodeId = isAdmin || !replyingToId ? homeworkNodeId : `${homeworkNodeId}_ans_${replyingToId}`;

    // Preserve assignment metadata if teacher is editing; tag student submissions as pending approval
    const finalContent = isAdmin
      ? editingId
        ? serializeHomeworkMeta(normalizedContent, editingMeta)
        : normalizedContent
      : setCommentApprovalTag(normalizedContent, false);

    const commentData: Record<string, any> = {
      nodeId: targetNodeId,
      author: authorName,
      content: finalContent,
      isAdmin,
      createdAt,
      ...(gradeId ? { grade_id: String(gradeId) } : {}),
    };

    try {
      let result;
      if (editingId) {
        result = await supabase
          .from('forum_comments')
          .update({ content: finalContent })
          .eq('id', editingId);
      } else {
        result = await supabase.from('forum_comments').insert([commentData]);

        if (result.error && gradeId) {
          console.warn("Insert with grade_id failed, retrying without grade_id:", result.error);
          const { grade_id: _ignored, ...withoutGrade } = commentData;
          result = await supabase.from('forum_comments').insert([withoutGrade]);
        }
      }

      if (result.error) throw result.error;

      setContent('');
      setDebouncedPreviewContent('');
      setReplyingToId(null);
      setEditingId(null);
      setEditingMeta(undefined);
      setEditorError(null);
      fetchComments(true);
    } catch (err: any) {
      console.error("Submission error:", err);
      setEditorError("Lỗi khi gửi nội dung: " + (err.message || "Kiểm tra kết nối"));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleApproval = async (id: string, currentStatus?: boolean) => {
    if (!isAdmin) return;
    const target = comments.find(c => c.id === id);
    if (!target) return;

    const newStatus = !currentStatus;
    const updatedContent = setCommentApprovalTag(target.content, newStatus);

    setComments(prev =>
      prev.map(c => (c.id === id ? { ...c, isApproved: newStatus, content: updatedContent } : c))
    );

    try {
      const { error } = await supabase
        .from('forum_comments')
        .update({ content: updatedContent })
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error("Error toggling approval:", err);
      fetchComments(true);
    }
  };

  const handleBatchApprove = async (qId?: string) => {
    if (!isAdmin) return;
    const targetList = (qId ? getAnswersForQuestion(qId) : answers).filter(a => !a.isApproved);
    if (targetList.length === 0) return;

    setConfirmConfig({
      isOpen: true,
      title: "Duyệt tất cả bài nộp",
      message: `Duyệt công khai ${targetList.length} bài làm của học sinh để hiển thị lên web?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const updatedMap = new Map<string, string>();
          targetList.forEach(a => {
            updatedMap.set(a.id, setCommentApprovalTag(a.content, true));
          });

          setComments(prev =>
            prev.map(c =>
              updatedMap.has(c.id)
                ? { ...c, isApproved: true, content: updatedMap.get(c.id)! }
                : c
            )
          );

          await Promise.all(
            targetList.map(a =>
              supabase
                .from('forum_comments')
                .update({ content: updatedMap.get(a.id)! })
                .eq('id', a.id)
            )
          );
        } catch (err: any) {
          console.error("Batch approval error:", err);
          fetchComments(true);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setConfirmConfig({
      isOpen: true,
      title: "Xóa bài tập nộp",
      message: "Bạn có chắc chắn muốn xóa mục này khỏi hệ thống?",
      onConfirm: async () => {
        await supabase.from('forum_comments').delete().eq('id', id);
        setComments(prev => prev.filter(c => c.id !== id));
      },
    });
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId || comments.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Cập nhật khối lớp hàng loạt",
      message: `Gắn nhãn Khối ${gradeId} cho toàn bộ bài viết và câu trả lời trong bài học này?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const gStr = String(gradeId);
          const { data, error } = await supabase
            .from('forum_comments')
            .update({ grade_id: gStr })
            .or(`nodeId.eq.${homeworkNodeId},nodeId.ilike.${homeworkNodeId}_ans_%`)
            .select('id');

          if (!error && data && data.length > 0) {
            fetchComments();
          }
        } catch (err: any) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const renderToolbar = () => (
    <div className="flex flex-wrap gap-1 items-center px-2 py-2 bg-slate-50/50 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button type="button" onClick={() => wrapText("**", "**")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="In đậm"><Bold size={18} /></button>
        <button type="button" onClick={() => wrapText("_", "_")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="In nghiêng"><Italic size={18} /></button>
        <button type="button" onClick={() => wrapText("### ")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Tiêu đề"><Type size={18}/></button>
      </div>

      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button type="button" onClick={() => wrapText("- ")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Danh sách"><List size={18} /></button>
        <button type="button" onClick={() => wrapText("\n| Cột 1 | Cột 2 |\n| :--- | :--- |\n| Nội dung | Nội dung |\n")} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Chèn bảng"><TableIcon size={18} /></button>
        <button
          type="button"
          onClick={openLinkModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all font-bold text-[10px] uppercase tracking-wider"
          title="Chèn liên kết (Hyperlink)"
        >
          <Link size={15} /> Liên kết
        </button>
        <button
          type="button"
          onClick={openImageModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all font-bold text-[10px] uppercase tracking-wider ml-1"
          title="Chèn hình ảnh từ đường link"
        >
          <ImageIcon size={15} /> Hình ảnh
        </button>

        <div className="relative ml-1">
          <button type="button" onClick={() => setShowMathDialog(!showMathDialog)} className={`p-2 rounded-lg transition-all flex items-center gap-1 ${showMathDialog ? 'bg-orange-50 text-orange-600' : 'text-slate-500 hover:text-orange-600 hover:bg-white'}`} title="Công thức Toán / Lý">
            <Calculator size={18}/> <ChevronDown size={12}/>
          </button>
          {showMathDialog && (
            <div className="absolute top-full left-0 mt-2 w-[340px] bg-white border border-slate-100 rounded-[32px] shadow-2xl z-50 p-6 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CÔNG THỨC LATEX</span>
                <span className="text-[8px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">PRO</span>
              </div>
              <div className="grid grid-cols-3 gap-6">
                {MATH_FORMULAS.map(m => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => { wrapText(m.value); setShowMathDialog(false); }}
                    className="flex flex-col items-center gap-2 group transition-all"
                  >
                    <div className="text-lg font-black text-orange-600 group-hover:scale-125 transition-transform">{m.display}</div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight text-center">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
        <button type="button" onClick={() => wrapText('<div align="left">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Căn trái"><AlignLeft size={18}/></button>
        <button type="button" onClick={() => wrapText('<div align="center">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Căn giữa"><AlignCenter size={18}/></button>
        <button type="button" onClick={() => wrapText('<div align="right">\n\n', '\n\n</div>')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all" title="Căn phải"><AlignRight size={18}/></button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'size' ? null : 'size')} className="flex items-center gap-1 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
            <Type size={14}/> SIZE <ChevronDown size={12} />
          </button>
          {activeDropdown === 'size' && (
            <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2">
              {FONT_SIZES.map(s => (
                <button key={s.label} type="button" onClick={() => applyStyle('font-size', s.value)} className="w-full px-4 py-2 text-left text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase">{s.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'font' ? null : 'font')} className="flex items-center gap-1 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
            <Type size={14}/> FONT <ChevronDown size={12} />
          </button>
          {activeDropdown === 'font' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 py-2">
              {FONTS.map(f => (
                <button key={f.label} type="button" onClick={() => applyStyle('font-family', f.value)} className="w-full px-4 py-2 text-left text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all uppercase">{f.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')} className="flex items-center gap-1 px-3 py-1.5 hover:bg-white text-[10px] font-black text-slate-500 uppercase tracking-tight rounded-xl transition-all">
            <Palette size={14}/> MÀU <ChevronDown size={12} />
          </button>
          {activeDropdown === 'color' && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 p-3 grid grid-cols-3 gap-2">
              {COLORS.map(c => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => applyStyle('color', c.value)}
                  className={`w-full aspect-square ${c.bg} rounded-lg border border-slate-200 hover:scale-110 transition-transform`}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderInputArea = () => (
    <div className="relative bg-white group flex flex-col min-h-[300px]">
      {!isAdmin && (
        <div className="px-6 py-2.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center gap-2 text-[11px] font-semibold text-indigo-700">
          <Info size={14} className="shrink-0" />
          <span>Mẹo: Em có thể nhấn nút <strong>Liên kết</strong> / <strong>Hình ảnh</strong> để đặt tên hiển thị, hoặc dán trực tiếp đường link (PDF, ảnh, tài liệu) vào ô văn bản để hệ thống tự động nhận diện.</span>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => {
          setContent(e.target.value);
          if (editorError) setEditorError(null);
        }}
        onPaste={handleTextareaPaste}
        placeholder={
          isAdmin
            ? "Nhập nội dung nhiệm vụ giao cho học sinh (sử dụng Markdown, nút Liên kết / Hình ảnh hoặc dán trực tiếp link)..."
            : "Em viết bài trả lời tại đây (dùng nút Liên kết / Hình ảnh hoặc dán trực tiếp link PDF, ảnh, tài liệu)..."
        }
        className="w-full flex-1 p-6 md:p-8 text-slate-600 text-base md:text-lg font-medium outline-none transition-all resize-none selection:bg-indigo-100 leading-relaxed placeholder:text-slate-300 min-h-[260px]"
      />
    </div>
  );

  const renderPreviewArea = () => (
    <div className="bg-slate-50/50 flex flex-col min-h-[300px] border-t lg:border-t-0 border-slate-100">
      <div className="bg-slate-100/50 px-8 py-3 border-b border-slate-200 flex items-center gap-3">
        <Eye size={14} className="text-indigo-600"/>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">XEM TRƯỚC NỘI DUNG</span>
      </div>
      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-h-[540px] prose prose-slate max-w-none prose-sm">
        {debouncedPreviewContent.trim() ? (
          <SmartMarkdown content={debouncedPreviewContent} className="prose-p:my-1 prose-headings:mb-4" />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-300 italic font-medium py-20">
            Đang đợi nội dung...
          </div>
        )}
      </div>
    </div>
  );

  const renderActionBar = () => (
    <div className="bg-slate-50/80 p-5 md:p-6 flex flex-col gap-4 border-t border-slate-100">
      {editorError && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 animate-in fade-in duration-200">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
          <p className="text-xs font-bold leading-relaxed flex-1">{editorError}</p>
          <button
            type="button"
            onClick={() => setEditorError(null)}
            className="text-rose-400 hover:text-rose-700 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        {editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setEditingMeta(undefined);
              setReplyingToId(null);
              setContent('');
              setEditorError(null);
            }}
            className="px-6 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl hover:bg-slate-100 font-black uppercase text-xs tracking-widest transition-all"
          >
            Hủy sửa
          </button>
        )}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={loading}
          className={`px-8 md:px-10 py-4 ${isAdmin ? 'bg-amber-600 shadow-amber-200' : 'bg-indigo-600 shadow-indigo-200'} text-white rounded-2xl hover:scale-[1.02] shadow-xl disabled:opacity-50 transition-all flex items-center gap-3 group font-black uppercase text-xs tracking-widest`}
        >
          {loading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />}
          {isAdmin ? (editingId ? 'Cập nhật nhiệm vụ' : 'Giao nhiệm vụ') : (editingId ? 'Cập nhật bài nộp' : 'Gửi bài nộp')}
        </button>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="bg-white overflow-hidden border border-slate-100">
      <div className="bg-white p-2 border-b border-slate-100">
        {renderToolbar()}
      </div>
      <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`}>
        {renderInputArea()}
        {showPreview && renderPreviewArea()}
      </div>
      {renderActionBar()}
    </div>
  );

  const allQuestions = comments.filter(c => c.isAdmin);
  const visibleStudentQuestions = allQuestions.filter(q => {
    const { meta } = parseHomeworkMeta(q.content);
    if (meta.targetType !== 'students') return true;
    if (!student || isGuest) return false;
    const matchById = meta.targetStudentIds?.includes(student.id);
    const matchByCode = meta.targetStudentCodes?.some(
      c => c.toUpperCase() === student.name.toUpperCase()
    );
    return Boolean(matchById || matchByCode);
  });

  const answers = comments.filter(c => !c.isAdmin);

  const getAnswersForQuestion = (qId: string) => {
    return answers.filter(a => a.nodeId === `${homeworkNodeId}_ans_${qId}`);
  };

  const getMyAnswerForQuestion = (qId: string) => {
    if (!student) return null;
    const qAnswers = getAnswersForQuestion(qId);
    return qAnswers.find(a => a.author.includes(`[${student.name}]`));
  };

  const filteredModalAnswers = (selectedQuestionId ? getAnswersForQuestion(selectedQuestionId) : answers)
    .filter(a => a.author.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(a => {
      if (approvalFilter === 'pending') return !a.isApproved;
      if (approvalFilter === 'approved') return a.isApproved;
      return true;
    });

  const filteredAssignStudents = getFilteredAssignStudents();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <BookOpen className={`text-${themeColor}-600`} size={20} />
            Hệ thống Bài tập
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {isAdmin ? 'Soạn thảo & Quản lý kết quả học tập' : 'Nhiệm vụ từ giáo viên & Nộp bài làm'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && comments.length > 0 && (
            <button
              type="button"
              onClick={handleBatchUpdateGrade}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all"
              title="Đồng bộ khối cho dữ liệu cũ"
            >
              <RefreshCw size={12} /> Đồng bộ Khối
            </button>
          )}
          {isConnected ? (
            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
              <Wifi size={10} /> Trực tiếp
            </span>
          ) : (
            <span className="text-[8px] font-black text-amber-500 flex items-center gap-1">
              <WifiOff size={10} /> Kết nối...
            </span>
          )}
          <button type="button" onClick={() => fetchComments()} className="p-2 text-slate-300 hover:text-indigo-600 transition-all">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STUDENT MISSION LIST VIEW */}
      {!isAdmin && (
        <div className="space-y-8">
          {isGuest && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-[28px] p-5 md:p-6 flex items-start gap-4 shadow-sm animate-in fade-in duration-300">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-200 mt-0.5">
                <Lock size={18} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase text-amber-900 tracking-wider">
                    Chế độ Xem Khách Vãng Lai &bull; Nút Trả Lời Đã Đóng Băng
                  </h4>
                </div>
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Để phục vụ <strong>quản lý tập trung</strong> và chấm điểm chính xác theo danh sách học sinh của nhà trường, nút trả lời/nộp bài đã được <strong>đóng băng</strong> đối với khách vãng lai. Học sinh vui lòng đăng nhập tài khoản chính thức để nộp bài làm.
                </p>
              </div>
            </div>
          )}

          {visibleStudentQuestions.length === 0 ? (
            <div className="bg-white p-16 rounded-[48px] border-2 border-dashed border-slate-200 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                <BookOpen size={40} className="text-slate-200" />
              </div>
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest leading-relaxed">
                Chào {isGuest ? 'bạn (Khách vãng lai)' : (student?.full_name || student?.name)},<br/>
                hiện chưa có nhiệm vụ nào được giao cho em trong bài học này.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              {visibleStudentQuestions.map((q, idx) => {
                const { cleanContent, meta } = parseHomeworkMeta(q.content);
                const myAnswer = isGuest ? null : getMyAnswerForQuestion(q.id);
                const isReplying = isGuest ? false : replyingToId === q.id;
                const isTargetedToStudent = meta.targetType === 'students';

                return (
                  <div key={q.id} className="space-y-6">
                    <div className={`bg-white rounded-[40px] border-2 transition-all overflow-hidden ${isReplying ? 'border-amber-400 shadow-2xl scale-[1.01]' : 'border-slate-100 shadow-xl'}`}>
                      <div className="p-8">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-black border border-amber-100 shadow-sm leading-none shrink-0">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Nhiệm vụ {idx + 1}</p>
                                {isTargetedToStudent && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <UserCheck size={11} /> Giao riêng cho em
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-slate-300" />
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(q.createdAt).toLocaleString('vi-VN')}</p>
                              </div>
                            </div>
                          </div>

                          {isGuest ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled
                                className="px-5 py-3 bg-slate-100/90 border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 select-none cursor-not-allowed shadow-inner"
                                title="Nút trả lời đã đóng băng cho khách vãng lai. Vui lòng đăng nhập tài khoản Học sinh để nộp bài."
                              >
                                <Lock size={14} className="text-slate-400" />
                                <span>Trả lời</span>
                                <span className="text-[8px] bg-slate-200/90 text-slate-500 px-2 py-0.5 rounded-full font-bold">Đóng băng</span>
                              </button>
                            </div>
                          ) : (
                            <>
                              {!myAnswer && !isReplying && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingToId(q.id);
                                    setEditingId(null);
                                    setContent('');
                                    setEditorError(null);
                                  }}
                                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-100 flex items-center gap-2 group"
                                >
                                  <Send size={14} className="group-hover:translate-x-1 transition-all" /> Trả lời
                                </button>
                              )}

                              {myAnswer && !isReplying && (
                                <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                  <CheckCircle2 size={14} /> Đã hoàn thành
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <SmartMarkdown content={cleanContent} className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed mb-6" />

                        {q.imageUrl && (
                          <div className="rounded-[32px] overflow-hidden border border-slate-100 mb-6">
                            <img src={q.imageUrl} className="max-w-full h-auto" />
                          </div>
                        )}

                        {/* STUDENT ANSWER (IF EXISTS) */}
                        {myAnswer && !isReplying && (
                          <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-lg shadow-emerald-50">
                                  EM
                                </div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Nội dung em đã trả lời</p>
                              </div>

                              {myAnswer.isApproved ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[9px] font-black uppercase tracking-wider border border-emerald-200 shadow-sm">
                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                  <span>Đã được Giáo viên duyệt & hiển thị công khai</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-xl text-[9px] font-black uppercase tracking-wider border border-amber-200 shadow-sm">
                                  <Clock size={13} className="text-amber-600 animate-pulse" />
                                  <span>Đã nộp bài &bull; Chờ Giáo viên duyệt để hiển thị công khai</span>
                                </div>
                              )}
                            </div>

                            <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50 prose prose-emerald max-w-none prose-sm text-emerald-900 font-medium leading-relaxed">
                              <SmartMarkdown content={myAnswer.content} />
                            </div>

                            {myAnswer.imageUrl && (
                              <div className="rounded-2xl overflow-hidden border border-emerald-100 max-w-md">
                                <img src={myAnswer.imageUrl} className="w-full h-auto opacity-90" />
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setReplyingToId(q.id);
                                setContent(parseHomeworkMeta(myAnswer.content).cleanContent);
                                setEditingId(myAnswer.id);
                                setEditorError(null);
                              }}
                              className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-all"
                            >
                              Sửa lại câu trả lời
                            </button>
                          </div>
                        )}

                        {/* PUBLIC APPROVED ANSWERS SHOWCASE */}
                        {(() => {
                          const approvedAnswers = getAnswersForQuestion(q.id).filter(a => a.isApproved);
                          return (
                            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <Globe size={13} />
                                  </div>
                                  <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                    Bài làm tiêu biểu đã được Giáo viên duyệt ({approvedAnswers.length})
                                  </h5>
                                </div>
                                {approvedAnswers.length > 0 && (
                                  <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <ShieldCheck size={11} /> Đã kiểm duyệt công khai
                                  </span>
                                )}
                              </div>

                              {approvedAnswers.length > 0 ? (
                                <div className="space-y-4">
                                  {approvedAnswers.map(ans => {
                                    const isMine = student && ans.author.includes(`[${student.name}]`);
                                    return (
                                      <div
                                        key={ans.id}
                                        className={`p-6 rounded-3xl border transition-all ${
                                          isMine
                                            ? 'bg-emerald-50/40 border-emerald-200 shadow-sm'
                                            : 'bg-slate-50/70 border-slate-100 hover:border-emerald-200 hover:bg-white shadow-sm'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                                              {ans.author.split(']').pop()?.trim().split(' ').pop()?.charAt(0).toUpperCase() || 'S'}
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-black text-slate-800 flex items-center gap-2">
                                                {ans.author}
                                                {isMine && <span className="text-[8px] bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">Bài của em</span>}
                                              </p>
                                              <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tight">
                                                {new Date(ans.createdAt).toLocaleString('vi-VN')}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 text-[8.5px] font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-xl">
                                            <CheckCircle2 size={11} /> Đã duyệt công khai
                                          </div>
                                        </div>

                                        <SmartMarkdown content={ans.content} className="prose prose-slate max-w-none text-slate-700 text-sm font-medium leading-relaxed" />
                                        {ans.imageUrl && (
                                          <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 max-w-md">
                                            <img src={ans.imageUrl} className="w-full h-auto" />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl p-4 flex items-center gap-3 text-slate-400">
                                  <Info size={16} className="shrink-0 text-slate-400" />
                                  <p className="text-[10px] font-medium leading-relaxed">
                                    Chưa có bài viết nào được giáo viên duyệt công khai cho nhiệm vụ này. Để đảm bảo chất lượng và tránh tình trạng bài viết tràn lan, bài làm của học sinh sẽ hiển thị tại đây sau khi được giáo viên duyệt.
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* INLINE EDITOR FOR REPLIES */}
                      {isReplying && (
                        <div className="bg-slate-50/50 border-t border-amber-100 animate-in slide-in-from-top-4 duration-300">
                          <div className="p-4 bg-amber-50/50 flex items-center justify-between">
                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                              <Edit2 size={12} /> Đang soạn thảo câu trả lời cho nhiệm vụ {idx + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingToId(null);
                                setEditingId(null);
                                setContent('');
                                setEditorError(null);
                              }}
                              className="p-2 hover:bg-white rounded-lg text-amber-600 transition-all"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {renderEditor()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADMIN EDITOR SECTION */}
      {isAdmin && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border-t-8 border-t-indigo-50">
          <div className="bg-white p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                {editingId ? 'CHỈNH SỬA NHIỆM VỤ' : 'CỬA SỔ SOẠN THẢO NHIỆM VỤ'}
              </h4>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showPreview ? 'text-indigo-600' : 'text-slate-400'}`}
                >
                  <Eye size={14} /> {showPreview ? 'Bản xem trước (ON)' : 'Bản xem trước (OFF)'}
                </button>
              </div>
            </div>
            {renderToolbar()}
          </div>

          <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-x divide-slate-100`}>
            {renderInputArea()}
            {showPreview && renderPreviewArea()}
          </div>
          {renderActionBar()}
        </div>
      )}

      {/* ADMIN MANAGEMENT SECTION: MISSION LIST */}
      {isAdmin && (
        <div className="space-y-6 pt-10">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-amber-500 pl-3">
              NHIỆM VỤ ĐÃ GIAO ({allQuestions.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allQuestions.map((q, idx) => {
              const { cleanContent, meta } = parseHomeworkMeta(q.content);
              const qAnswers = getAnswersForQuestion(q.id);
              const pendingCount = qAnswers.filter(a => !a.isApproved).length;
              const isTargeted = meta.targetType === 'students' && (meta.targetStudentCodes?.length || meta.targetStudentIds?.length || 0) > 0;
              const targetCount = meta.targetStudentCodes?.length || meta.targetStudentIds?.length || 0;

              return (
                <div key={q.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative group hover:border-amber-200 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-black border border-amber-100 uppercase tracking-widest shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhiệm vụ {idx + 1}</span>
                          {isTargeted ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <UserCheck size={11} /> Đã giao {targetCount} HS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-black uppercase tracking-wider">
                              Cả lớp
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[9px] font-black uppercase tracking-wider">
                              {pendingCount} bài chờ duyệt
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">{new Date(q.createdAt).toLocaleString('vi-VN')}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAssignModal(q)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-100 transition-all border border-indigo-200"
                        title="Giao nhiệm vụ này cho học sinh hoặc nhóm theo mã"
                      >
                        <Users size={14} /> Giao cho HS
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuestionId(q.id);
                          setApprovalFilter('all');
                          setShowAnswersModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-100 transition-all border border-emerald-100"
                      >
                        <Eye size={14} /> Xem bài nộp ({qAnswers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContent(cleanContent);
                          setEditingId(q.id);
                          setEditingMeta(meta);
                          setEditorError(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Sửa nội dung"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(q.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Xóa nhiệm vụ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <SmartMarkdown content={cleanContent} className="prose prose-slate max-w-none prose-sm text-slate-600 leading-relaxed font-medium" />
                  {q.imageUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-100">
                      <img src={q.imageUrl} className="max-w-md h-auto" />
                    </div>
                  )}
                </div>
              );
            })}

            {allQuestions.length === 0 && (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-10 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic mb-2">Chưa tìm thấy bản ghi nhiệm vụ nào trong CSDL cho bài học này</p>
                <p className="text-[10px] text-slate-300 font-mono">Current ID: {homeworkNodeId}</p>
                <button type="button" onClick={() => fetchComments()} className="mt-4 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-50 transition-all">THỬ TẢI LẠI DỮ LIỆU</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HYPERLINK INSERT MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Link size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Chèn Liên Kết (Hyperlink)</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhập tên hiển thị và dán đường dẫn tài liệu / PDF</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowLinkModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmLinkModal} className="p-6 space-y-4">
              {linkModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{linkModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tên hiển thị của liên kết *</label>
                <input
                  type="text"
                  autoFocus
                  value={linkName}
                  onChange={e => { setLinkName(e.target.value); setLinkModalError(null); }}
                  placeholder="Ví dụ: Bài giải PDF tuần 5, File Word báo cáo..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-sm font-semibold text-slate-700 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Đường dẫn (URL) *</label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={e => { setLinkUrl(e.target.value); setLinkModalError(null); }}
                  placeholder="https://drive.google.com/file/d/... hoặc https://..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-sm font-medium text-slate-700 transition-all"
                />
                <p className="text-[10px] text-slate-400 font-medium px-1">
                  Link PDF hoặc Google Drive PDF sẽ tự động hiển thị nội dung trực tiếp trong màn hình; link tài liệu khác (.docx, .xlsx...) sẽ hiển thị dạng nút mở liên kết.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLinkModal(false)} className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                  Hủy
                </button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all">
                  Chèn liên kết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE LINK INSERT MODAL */}
      {showImageModal && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Chèn Hình Ảnh</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhập tên bức hình và dán đường link ảnh</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowImageModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmImageModal} className="p-6 space-y-4">
              {imageModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{imageModalError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tên / Chú thích bức hình *</label>
                <input
                  type="text"
                  autoFocus
                  value={imageName}
                  onChange={e => { setImageName(e.target.value); setImageModalError(null); }}
                  placeholder="Ví dụ: Sơ đồ lực tác dụng, Ảnh chụp bài làm trang 1..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl outline-none text-sm font-semibold text-slate-700 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Đường link bức hình *</label>
                <input
                  type="text"
                  value={imageLinkUrl}
                  onChange={e => { setImageLinkUrl(e.target.value); setImageModalError(null); }}
                  placeholder="https://... (hỗ trợ link ảnh trực tiếp hoặc Google Drive)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl outline-none text-sm font-medium text-slate-700 transition-all"
                />
              </div>

              {isValidHttpUrl(imageLinkUrl) && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Xem trước ảnh</p>
                  <img
                    src={normalizeImageUrl(imageLinkUrl)}
                    alt={imageName || 'Preview'}
                    className="max-h-40 rounded-xl mx-auto object-contain bg-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowImageModal(false)} className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                  Hủy
                </button>
                <button type="submit" className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-100 transition-all">
                  Chèn hình ảnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN HOMEWORK TO STUDENTS / GROUPS BY CODE MODAL */}
      {assigningQuestion && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl max-h-[88vh] rounded-[36px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="px-8 py-6 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Giao nhiệm vụ cho Học sinh</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Gán theo mã học sinh hoặc tìm & chọn nhanh 1 nhóm học sinh theo mã
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setAssigningQuestion(null)} className="p-2.5 bg-white text-slate-400 hover:text-slate-700 rounded-xl border border-slate-200 transition-all">
                <X size={18} />
              </button>
            </header>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Target mode selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAssignTargetType('all')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    assignTargetType === 'all'
                      ? 'border-indigo-600 bg-indigo-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-black text-slate-800 uppercase">Tất cả học sinh (Cả lớp)</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Mọi học sinh thuộc khối lớp đều thấy nhiệm vụ này.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignTargetType('students')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    assignTargetType === 'students'
                      ? 'border-indigo-600 bg-indigo-50/60'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-black text-slate-800 uppercase">Giao theo mã / Nhóm học sinh</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    Đã chọn <strong className="text-indigo-600">{assignSelectedIds.length}</strong> học sinh.
                  </p>
                </button>
              </div>

              {assignTargetType === 'students' && (
                <div className="space-y-4">
                  {/* Search / Group Code Filter Bar */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={assignStudentSearch}
                        onChange={e => setAssignStudentSearch(e.target.value)}
                        placeholder="Nhập mã HS, tiền tố nhóm (vd: 11B, HS0) hoặc danh sách mã: HS01, HS02..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm font-semibold text-slate-700"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-500">
                        Hiển thị <strong>{filteredAssignStudents.length}</strong> / {gradeStudents.length} học sinh
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ids = filteredAssignStudents.map(s => s.id);
                            setAssignSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
                          }}
                          disabled={filteredAssignStudents.length === 0}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Chọn nhóm đang lọc ({filteredAssignStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const filteredSet = new Set(filteredAssignStudents.map(s => s.id));
                            setAssignSelectedIds(prev => prev.filter(id => !filteredSet.has(id)));
                          }}
                          disabled={filteredAssignStudents.length === 0}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                        >
                          Bỏ chọn nhóm này
                        </button>
                        {assignSelectedIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAssignSelectedIds([])}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            Xóa hết ({assignSelectedIds.length})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected chips preview */}
                  {assignSelectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100">
                      {gradeStudents
                        .filter(s => assignSelectedIds.includes(s.id))
                        .map(s => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black"
                          >
                            {s.name}
                            <button
                              type="button"
                              onClick={() => setAssignSelectedIds(prev => prev.filter(id => id !== s.id))}
                              className="text-indigo-400 hover:text-rose-600"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Student Grid */}
                  {loadingStudents ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      Đang tải danh sách học sinh...
                    </div>
                  ) : filteredAssignStudents.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Không tìm thấy học sinh phù hợp với mã tìm kiếm
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {filteredAssignStudents.map(s => {
                        const checked = assignSelectedIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                              checked
                                ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-indigo-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAssignSelectedIds(prev =>
                                  checked ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                )
                              }
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-slate-800 truncate">{s.name}</p>
                              <p className="text-[11px] font-medium text-slate-500 truncate">{s.full_name || 'Chưa cập nhật tên'}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setAssigningQuestion(null)}
                className="px-5 py-2.5 text-slate-500 hover:bg-slate-200/60 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={savingAssign || (assignTargetType === 'students' && assignSelectedIds.length === 0)}
                onClick={handleSaveAssignment}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
              >
                {savingAssign ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Lưu phân công
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* STUDENT ANSWERS MODAL (WITH APPROVAL CONTROLS) */}
      {showAnswersModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 shrink-0 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                      {selectedQuestionId ? `Bài nộp - Nhiệm vụ ${allQuestions.findIndex(q => q.id === selectedQuestionId) + 1}` : 'Danh sách bài nộp'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {selectedQuestionId
                        ? `${getAnswersForQuestion(selectedQuestionId).length} Bài làm cho nhiệm vụ này`
                        : `${answers.length} Tổng số bài nộp`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative group flex-1 md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-all" size={16} />
                    <input
                      type="text"
                      placeholder="Tìm theo Mã HS hoặc Họ tên..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-emerald-400 rounded-2xl outline-none text-sm font-bold text-slate-700 transition-all shadow-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAnswersModal(false);
                      setSelectedQuestionId(null);
                    }}
                    className="p-3 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-400" />
                  {(['all', 'pending', 'approved'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setApprovalFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                        approvalFilter === f
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f === 'all' ? 'Tất cả' : f === 'pending' ? 'Chờ duyệt' : 'Đã duyệt'}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleBatchApprove(selectedQuestionId || undefined)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all"
                  >
                    <ShieldCheck size={14} /> Duyệt tất cả bài chờ
                  </button>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/30">
              {filteredModalAnswers.map(a => (
                <div key={a.id} className="bg-white p-6 md:p-8 rounded-[36px] border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col md:flex-row gap-6">
                  <div className="bg-slate-50 rounded-3xl p-5 md:w-60 shrink-0 border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center text-lg font-black text-emerald-600 mb-3 border-2 border-emerald-50">
                      {a.author.split(']').pop()?.trim().split(' ').pop()?.charAt(0).toUpperCase() || 'S'}
                    </div>
                    <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight mb-1">{a.author}</h5>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Học sinh</p>

                    <div className="mt-4 pt-4 border-t border-slate-200/70 w-full space-y-2">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Ngày nộp</p>
                        <p className="text-[10px] font-bold text-slate-600">{new Date(a.createdAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Giờ nộp</p>
                        <p className="text-[10px] font-bold text-slate-600">{new Date(a.createdAt).toLocaleTimeString('vi-VN')}</p>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="mt-4 pt-4 border-t border-slate-200/70 w-full flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleApproval(a.id, a.isApproved)}
                          className={`w-full py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            a.isApproved
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-amber-100 hover:text-amber-800 border border-emerald-200'
                              : 'bg-amber-500 hover:bg-emerald-600 text-white shadow-sm'
                          }`}
                        >
                          {a.isApproved ? <CheckCircle2 size={13} /> : <Check size={13} />}
                          {a.isApproved ? 'Đã duyệt công khai' : 'Duyệt hiển thị'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="w-full py-2 px-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all border border-red-100 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                          title="Gỡ bài"
                        >
                          <Trash2 size={13} /> Xóa bài
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <SmartMarkdown content={a.content} className="prose prose-emerald max-w-none prose-sm text-slate-700 leading-relaxed font-medium text-base" />
                    {a.imageUrl && (
                      <div className="mt-6 rounded-[24px] overflow-hidden border-2 border-slate-100 shadow-md">
                        <img src={a.imageUrl} className="w-full h-auto" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredModalAnswers.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <CheckCircle2 size={56} className="text-slate-300 mb-4" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-400">Không có bài nộp phù hợp</p>
                </div>
              )}
            </div>
          </div>
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

export default HomeworkPanel;
