
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, BookOpen } from 'lucide-react';
import { BookNode } from '../types';

interface FolderSummaryProps {
  folder: BookNode;
  children: BookNode[];
  onSelectLesson: (id: string) => void;
  themeColor: string;
}

const FolderSummary: React.FC<FolderSummaryProps> = ({ folder, children, onSelectLesson, themeColor }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [folder.id]);

  if (children.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
        <BookOpen size={48} className="mb-4" />
        <p className="text-xs font-black uppercase tracking-[0.3em]">Thư mục này chưa có bài học</p>
      </div>
    );
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % children.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + children.length) % children.length);
  };

  const currentLesson = children[currentIndex];

  const themeClasses = {
    'indigo-600': 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20',
    'emerald-600': 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20',
    'rose-600': 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20',
  };

  const themeTextClasses = {
    'indigo-600': 'text-indigo-500',
    'emerald-600': 'text-emerald-500',
    'rose-600': 'text-rose-500',
  };

  const themeBgBlurClasses = {
    'indigo-600': 'bg-indigo-400',
    'emerald-600': 'bg-emerald-400',
    'rose-600': 'bg-rose-400',
  };

  const themeDotClasses = {
    'indigo-600': 'bg-indigo-600 shadow-indigo-100',
    'emerald-600': 'bg-emerald-600 shadow-emerald-100',
    'rose-600': 'bg-rose-600 shadow-rose-100',
  };

  const currentThemeClass = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses['indigo-600'];
  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeBgBlurClass = themeBgBlurClasses[themeColor as keyof typeof themeBgBlurClasses] || themeBgBlurClasses['indigo-600'];
  const currentThemeDotClass = themeDotClasses[themeColor as keyof typeof themeDotClasses] || themeDotClasses['indigo-600'];

  return (
    <div className="h-full w-full flex flex-col bg-white relative overflow-hidden">
      {/* Background Blur Effect */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
        <div className={`absolute top-[-10%] right-[-10%] w-[50%] h-[50%] ${currentThemeBgBlurClass} rounded-full blur-[120px]`}></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-400 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Scrollable Area */}
      <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-3 md:p-5 lg:p-6">
        <div className="max-w-full w-full mx-auto">
          
          {/* Header Chương - Thu gọn tối đa */}
          <div className="mb-2">
            <h2 className={`text-[7px] font-black ${currentThemeTextClass} uppercase tracking-[0.4em] mb-0 opacity-70`}>CHƯƠNG HIỆN TẠI</h2>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tighter leading-tight">{folder.title}</h1>
          </div>

          {/* Thông tin bài học */}
          <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-500">
             <div className="mb-0.5">
                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">BÀI {currentIndex + 1} / {children.length}</span>
                <h3 className="text-sm font-black text-slate-800 tracking-tight leading-none">{currentLesson.title}</h3>
             </div>
             <p className="text-slate-400 text-[8px] font-medium leading-none max-w-2xl">
               Khám phá các kiến thức trọng tâm. Nhấn "Bắt đầu" để truy cập học liệu.
             </p>
          </div>

          {/* Carousel Area */}
          <div className="flex flex-col gap-2 w-full">
            {/* Image Container - Mở rộng full width Panel 2 */}
            <div className={`relative w-full aspect-video group rounded-[24px] overflow-hidden shadow-2xl border-[2px] border-white transition-all duration-700`}>
               {currentLesson.imageUrl ? (
                 <img 
                   src={currentLesson.imageUrl} 
                   className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                   alt={currentLesson.title}
                   key={currentLesson.id}
                 />
               ) : (
                 <div className={`w-full h-full bg-gradient-to-br from-${themeColor.split('-')[0]}-500 via-purple-500 to-sky-500 flex items-center justify-center text-white/20`}>
                   <Play size={60} strokeWidth={1} />
                 </div>
               )}
               
               {/* Controls Overlay */}
               <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/5">
                  <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="w-7 h-7 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 active:scale-95 transition-all">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="w-7 h-7 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 active:scale-95 transition-all">
                    <ChevronRight size={14} />
                  </button>
               </div>

               {/* Nút vào học */}
               <button 
                onClick={() => onSelectLesson(currentLesson.id)}
                className={`absolute bottom-3 right-3 text-white px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-[0.15em] shadow-2xl flex items-center gap-1.5 hover:translate-y-[-2px] active:translate-y-0 transition-all z-20 ${currentThemeClass}`}
               >
                 BẮT ĐẦU <Play size={7} fill="currentColor" />
               </button>
            </div>

            {/* Pagination Dots */}
            <div className="flex gap-1 justify-center md:justify-start px-2">
              {children.map((_, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-1 transition-all duration-500 rounded-full ${idx === currentIndex ? `w-6 ${currentThemeDotClass}` : 'w-1 bg-slate-200 hover:bg-slate-300'}`}
                />
              ))}
            </div>
          </div>
          
          <div className="h-4"></div>
        </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default FolderSummary;
