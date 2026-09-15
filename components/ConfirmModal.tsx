import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  type = 'danger',
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id="confirm-modal-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            id="confirm-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Dialog Card */}
          <motion.div
            id="confirm-modal-card"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center z-10"
          >
            {/* Close Button */}
            <button
              id="confirm-modal-close"
              onClick={onCancel}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all active:scale-90"
            >
              <X size={16} />
            </button>

            {/* Icon Banner */}
            <div
              id="confirm-modal-icon-container"
              className={`w-16 h-16 rounded-[24px] flex items-center justify-center mb-5 shadow-lg ${
                type === 'danger'
                  ? 'bg-red-50 text-red-500 shadow-red-100'
                  : type === 'warning'
                  ? 'bg-amber-50 text-amber-500 shadow-amber-100'
                  : 'bg-indigo-50 text-indigo-500 shadow-indigo-100'
              }`}
            >
              {type === 'danger' ? (
                <Trash2 size={28} />
              ) : type === 'warning' ? (
                <AlertTriangle size={28} />
              ) : (
                <Info size={28} />
              )}
            </div>

            {/* Content info */}
            <h3 id="confirm-modal-title" className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight mb-2">
              {title}
            </h3>
            <p id="confirm-modal-message" className="text-sm font-medium text-slate-500 mb-8 leading-relaxed px-2">
              {message}
            </p>

            {/* Buttons UI */}
            <div id="confirm-modal-buttons" className="flex gap-4 w-full">
              <button
                id="confirm-modal-btn-cancel"
                type="button"
                onClick={onCancel}
                className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 tracking-widest hover:bg-slate-50 rounded-2xl transition-all active:scale-95 border border-transparent"
              >
                {cancelText}
              </button>
              <button
                id="confirm-modal-btn-action"
                type="button"
                onClick={onConfirm}
                className={`flex-1 py-4 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 ${
                  type === 'danger'
                    ? 'bg-red-500 shadow-red-200 hover:bg-red-600 hover:shadow-xl'
                    : type === 'warning'
                    ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600 hover:shadow-xl'
                    : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700 hover:shadow-xl'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
