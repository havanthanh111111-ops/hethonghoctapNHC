import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Settings, HelpCircle, Copy, Check, ExternalLink, HardDrive } from 'lucide-react';

interface DriveUploaderProps {
  onUploadSuccess: (url: string, fileName: string) => void;
  themeColor?: string;
  buttonText?: string;
  className?: string;
}

const DEFAULT_GAS_SCRIPT_CODE = `// === CẤU HÌNH THƯ MỤC GOOGLE DRIVE ===
// Dán ID thư mục của bạn vào đây (nếu để trống "", file sẽ được lưu ở thư mục gốc Google Drive)
var TARGET_FOLDER_ID = ""; // Ví dụ: "1A2b3C4d5E6f7G8h9I0j..."

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Drive Upload API đang hoạt động bình thường!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    // Lấy ID thư mục từ cấu hình hoặc dữ liệu gửi lên
    var folderId = data.folderId || TARGET_FOLDER_ID; 
    var folder = (folderId && folderId.trim() !== "") ? DriveApp.getFolderById(folderId.trim()) : DriveApp.getRootFolder();
    
    var blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.mimeType, data.fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileUrl = file.getUrl();
    var embedUrl = "https://drive.google.com/file/d/" + file.getId() + "/preview";
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      fileId: file.getId(),
      fileUrl: fileUrl,
      embedUrl: embedUrl,
      fileName: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const DriveUploader: React.FC<DriveUploaderProps> = ({
  onUploadSuccess,
  themeColor = 'indigo',
  buttonText = 'Tải file lên Google Drive',
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return localStorage.getItem('gas_drive_script_url') || '';
  });

  const handleSaveConfig = (urlToSave: string) => {
    const trimmed = urlToSave.trim();
    localStorage.setItem('gas_drive_script_url', trimmed);
    setScriptUrl(trimmed);
    setShowConfigModal(false);
    setErrorMsg(null);
  };

  const handleTriggerUpload = () => {
    const savedUrl = localStorage.getItem('gas_drive_script_url') || '';
    if (!savedUrl.trim()) {
      setShowConfigModal(true);
      return;
    }
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentScriptUrl = localStorage.getItem('gas_drive_script_url') || '';
    if (!currentScriptUrl.trim()) {
      setShowConfigModal(true);
      return;
    }

    // Limit client side size warn if over 45MB due to Apps Script POST payload limits
    if (file.size > 48 * 1024 * 1024) {
      setErrorMsg('Kích thước file quá lớn (> 48MB). Vui lòng chọn file nhỏ hơn hoặc tải trực tiếp lên Google Drive rồi dán link.');
      return;
    }

    setIsUploading(true);
    setUploadStatus(`Đang đọc file: ${file.name}...`);
    setErrorMsg(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];

          setUploadStatus(`Đang tải file lên Google Drive...`);

          const payload = {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileData: base64Data
          };

          const response = await fetch(currentScriptUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8' // Avoid CORS preflight OPTIONS where possible for Apps Script
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (data && (data.status === 'success' || data.embedUrl || data.fileUrl)) {
            const finalUrl = data.embedUrl || data.fileUrl;
            setUploadStatus('Tải lên thành công!');
            setTimeout(() => {
              setIsUploading(false);
              setUploadStatus('');
            }, 1000);
            onUploadSuccess(finalUrl, file.name);
          } else {
            throw new Error(data?.message || 'Không thể tải file lên Google Drive. Vui lòng kiểm tra lại Google Apps Script.');
          }
        } catch (err: any) {
          console.error('Lỗi tải file lên Apps Script:', err);
          setErrorMsg(err?.message || 'Có lỗi xảy ra khi tải file lên Google Drive.');
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setErrorMsg('Lỗi khi đọc file local.');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error handling file:', err);
      setErrorMsg('Có lỗi xảy ra.');
      setIsUploading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(DEFAULT_GAS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTriggerUpload}
          disabled={isUploading}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-sm hover:shadow transition-all disabled:opacity-50`}
        >
          {isUploading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>{uploadStatus || 'Đang tải lên...'}</span>
            </>
          ) : (
            <>
              <UploadCloud size={15} />
              <span>{buttonText}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-slate-200"
          title="Cấu hình link Google Apps Script"
        >
          <Settings size={15} />
        </button>

        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className="p-2 text-sky-500 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-all border border-sky-100"
          title="Hướng dẫn tạo Google Apps Script miễn phí"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-600 text-[10.5px] font-medium leading-tight">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMsg}</span>
            {!scriptUrl && (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="block mt-1 font-bold underline hover:text-red-800"
              >
                Nhấp vào đây để dán Web App URL Google Apps Script
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFIG SCRIPT URL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                <HardDrive size={16} className="text-emerald-600" />
                Cấu hình Google Apps Script Web App
              </h4>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Dán URL Ứng dụng Web (Google Apps Script Web App) của bạn vào bên dưới để tự động tải file trực tiếp lên Google Drive cá nhân không giới hạn dung lượng lưu trữ server.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Web App URL (https://script.google.com/macros/s/.../exec)
              </label>
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-[10.5px] font-bold text-sky-600 hover:underline flex items-center gap-1"
              >
                <HelpCircle size={13} />
                Chưa có script? Xem hướng dẫn
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveConfig(scriptUrl)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-md hover:bg-emerald-700 transition-all"
                >
                  Lưu cấu hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSTRUCTIONS */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[450] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <HelpCircle size={18} className="text-sky-600" />
                Hướng dẫn tạo Google Apps Script tải file lên Google Drive
              </h4>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-[12px] text-slate-600 leading-relaxed">
              <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl text-sky-800 text-[11px] font-medium">
                👉 <strong>Lợi ích:</strong> File (PDF, Hình ảnh, Bài giảng...) sẽ được tải trực tiếp vào Google Drive cá nhân của thầy/cô, tự động cấp quyền xem và tự tạo link nhúng nhúng trực tiếp vào ứng dụng!
              </div>

              <ol className="list-decimal list-inside space-y-2.5 font-medium pl-1">
                <li>
                  Truy cập <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-sky-600 font-bold underline inline-flex items-center gap-0.5">script.google.com <ExternalLink size={11} /></a> và đăng nhập Google.
                </li>
                <li>Nhấn nút <strong>Dự án mới (New project)</strong>.</li>
                <li>
                  Xóa toàn bộ mã mặc định và dán đoạn mã JavaScript bên dưới vào:
                  <div className="relative mt-2">
                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[10.5px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                      {DEFAULT_GAS_SCRIPT_CODE}
                    </pre>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition-all"
                    >
                      {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedCode ? 'Đã sao chép' : 'Sao chép mã'}
                    </button>
                  </div>
                </li>
                <li>
                  Nhấn nút <strong>Triển khai (Deploy)</strong> ở góc trên bên phải &gt; chọn <strong>Dự án triển khai mới (New deployment)</strong>.
                </li>
                <li>
                  Ở biểu tượng bánh răng, chọn kiểu <strong>Ứng dụng web (Web app)</strong>.
                </li>
                <li>
                  Cấu hình bắt buộc:
                  <ul className="list-disc list-inside ml-5 mt-1 space-y-1 text-slate-700">
                    <li><strong>Thực thi dưới dạng (Execute as):</strong> Tôi (Me / your-email)</li>
                    <li><strong>Ai có quyền truy cập (Who has access):</strong> Bất kỳ ai (Anyone)</li>
                  </ul>
                </li>
                <li>
                  Nhấn <strong>Triển khai (Deploy)</strong> &gt; Nhấn <strong>Cấp quyền truy cập (Authorize access)</strong> &gt; Chọn tài khoản Google của bạn &gt; Nâng cao (Advanced) &gt; Đi tới Dự án (Go to project).
                </li>
                <li>
                  Sao chép <strong>URL ứng dụng web (Web App URL)</strong> dạng <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">https://script.google.com/macros/s/.../exec</code> và dán vào phần cấu hình của phần mềm.
                </li>
              </ol>
            </div>

            <div className="flex justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowHelpModal(false);
                  setShowConfigModal(true);
                }}
                className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-md hover:bg-sky-700 transition-all"
              >
                Nhập Web App URL ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
