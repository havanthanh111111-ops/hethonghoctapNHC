import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Check, 
  Sparkles, 
  Loader2, 
  Clipboard, 
  AlertCircle 
} from 'lucide-react';
import { uploadToImgBB } from '../imgbb';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (snippet: string) => void;
  isAdmin: boolean;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'tip'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('Hình minh họa');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP, GIF...).');
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const res = await uploadToImgBB(file);
      const markdownSnippet = `\n\n![${altText.trim() || 'Hình minh họa'}](${res.url})\n\n`;
      onInsert(markdownSnippet);
      setIsUploading(false);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi tải ảnh lên ImgBB:', err);
      setErrorMessage(err.message || 'Không thể tải ảnh lên dịch vụ lưu trữ ImgBB. Vui lòng thử lại.');
      setIsUploading(false);
    }
  };

  const handleUrlInsert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) return;

    let finalUrl = imageUrl.trim();

    // Chuyển đổi link Google Drive nếu có
    const driveMatch = finalUrl.match(/https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      finalUrl = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    const markdownSnippet = `\n\n![${altText.trim() || 'Hình minh họa'}](${finalUrl})\n\n`;
    onInsert(markdownSnippet);
    setImageUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[600] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <ImageIcon size={16} />
            </div>
            <h3 className="font-black text-sm uppercase tracking-wide">
              Chèn hình ảnh vào bài viết
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'file'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload size={14} />
            <span>Tải ảnh lên (ImgBB)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'url'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LinkIcon size={14} />
            <span>Dán link URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tip')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-all ${
              activeTab === 'tip'
                ? 'bg-white text-amber-600 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Mẹo dán ảnh nhanh (Ctrl+V)"
          >
            <Clipboard size={14} />
            <span className="hidden sm:inline">Mẹo Ctrl+V</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Nhập Alt text chung */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Chú thích ảnh (Mô tả ngắn)
            </label>
            <input
              type="text"
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="VD: Giản đồ vectơ các lực tác dụng / Đồ thị vận tốc"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: TẢI BẰNG FILE */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group text-center block">
                {isUploading ? (
                  <div className="py-4 flex flex-col items-center space-y-2">
                    <Loader2 size={32} className="animate-spin text-indigo-600" />
                    <p className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                      Đang tải ảnh lên đám mây...
                    </p>
                    <p className="text-[10px] text-slate-400">Vui lòng chờ trong giây lát</p>
                  </div>
                ) : (
                  <div className="py-2 flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        Bấm để chọn file ảnh từ thiết bị
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                        Hỗ trợ PNG, JPG, GIF, WEBP • Tối đa 32MB • Tự động lấy link
                      </p>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                <p className="font-bold text-slate-700">⚡ Tự động chèn Snippet Markdown:</p>
                <code className="block bg-white p-2 rounded-lg border border-slate-200 font-mono text-[10px] text-indigo-600">
                  ![{altText || 'Hình minh họa'}](https://i.ibb.co/example.png)
                </code>
              </div>
            </div>
          )}

          {/* TAB 2: DÁN LINK URL */}
          {activeTab === 'url' && (
            <form onSubmit={handleUrlInsert} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  Đường dẫn liên kết hình ảnh (URL) *
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... hoặc link Google Drive"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Hỗ trợ dán cả đường dẫn chia sẻ file Google Drive công khai.
                </p>
              </div>

              <button
                type="submit"
                disabled={!imageUrl.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check size={16} />
                <span>Chèn hình ảnh ngay</span>
              </button>
            </form>
          )}

          {/* TAB 3: MẸO DÁN TRỰC TIẾP (CTRL+V) */}
          {activeTab === 'tip' && (
            <div className="space-y-3 p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase">
                <Sparkles size={16} className="text-amber-600" />
                <span>Cách dán ảnh siêu tốc không cần mở Modal:</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-xs text-amber-900 leading-relaxed font-medium">
                <li>Sao chép bất kỳ hình ảnh nào (Chụp màn hình, Copy Image từ Zalo, Web, Word...).</li>
                <li>Đặt con trỏ chuột vào ô **Đề bài** hoặc **Lời giải**.</li>
                <li>Nhấn tổ hợp phím <kbd className="bg-white px-1.5 py-0.5 rounded border border-amber-300 font-mono text-[11px] font-bold shadow-xs">Ctrl + V</kbd>.</li>
                <li>Hệ thống sẽ **tự động tải ảnh lên ImgBB** và chèn đoạn mã Markdown vào đúng vị trí con trỏ!</li>
              </ol>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Đóng
          </button>
        </footer>

      </div>
    </div>
  );
};
