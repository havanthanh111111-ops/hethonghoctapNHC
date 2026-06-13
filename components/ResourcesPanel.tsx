
import React from 'react';
import { Plus, Pencil, Trash2, FileText, Cloud, Globe } from 'lucide-react';
import { ResourceLink } from '../types';

interface ResourcesPanelProps {
  isAdmin: boolean;
  selectedId: string | null;
  lessonResources: ResourceLink[];
  globalResources: ResourceLink[];
  themeColor: string;
  onAdd: (isGlobal: boolean) => void;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
  className?: string;
}

const ResourceItem: React.FC<{ 
  r: ResourceLink; 
  isGlobal: boolean; 
  isAdmin: boolean;
  themeColor: string;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
}> = ({ r, isGlobal, isAdmin, themeColor, onEdit, onDelete }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  
  const themeBorderClasses = {
    'indigo-600': 'hover:border-indigo-100',
    'emerald-600': 'hover:border-emerald-100',
    'rose-600': 'hover:border-rose-100',
  };

  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];

  return (
    <div className="group relative">
      <a href={r.url} target="_blank" className={`flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl font-bold text-[9px] text-slate-500 uppercase tracking-tighter shadow-sm hover:shadow-md transition-all ${currentThemeBorderClass}`}>
        {r.url.toLowerCase().includes('drive.google.com') ? <Cloud size={12} className="text-blue-500 shrink-0"/> : isDocument(r.url) ? <FileText size={12} className="text-red-500 shrink-0"/> : <Globe size={12} className="text-sky-500 shrink-0"/>}
        <span className="truncate">{r.title}</span>
      </a>
      {isAdmin && (
        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1 scale-90">
          <button onClick={()=>onEdit(r, isGlobal)} className="p-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100"><Pencil size={8}/></button>
          <button onClick={()=>onDelete(r.id, r.title, isGlobal)} className="p-1 bg-red-50 text-red-500 rounded-lg border border-red-100"><Trash2 size={8}/></button>
        </div>
      )}
    </div>
  );
};

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ isAdmin, selectedId, lessonResources, globalResources, themeColor, onAdd, onEdit, onDelete, className = "border-l border-slate-50" }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  const docResources = lessonResources.filter(r => isDocument(r.url));
  const htmlResources = lessonResources.filter(r => !isDocument(r.url));

  const themeTextClasses = {
    'indigo-600': 'text-indigo-600',
    'emerald-600': 'text-emerald-600',
    'rose-600': 'text-rose-600',
  };

  const themeHoverBgClasses = {
    'indigo-600': 'hover:bg-indigo-50',
    'emerald-600': 'hover:bg-emerald-50',
    'rose-600': 'hover:bg-rose-50',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeHoverBgClass = themeHoverBgClasses[themeColor as keyof typeof themeHoverBgClasses] || themeHoverBgClasses['indigo-600'];

  return (
    <aside className={`w-56 bg-[#fbfcfd] flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-all ${className}`}>
      {/* SECTION 1: LESSON RESOURCES */}
      <div className="sticky top-0 z-20 px-4 py-3 flex justify-between items-center border-b bg-white/95 backdrop-blur-sm text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">
        Học liệu riêng {isAdmin && selectedId && <button onClick={()=>onAdd(false)} className={`${currentThemeTextClass} ${currentThemeHoverBgClass} p-1 rounded-lg`}><Plus size={16}/></button>}
      </div>
      <div className="p-3 space-y-4">
        {docResources.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="px-2 py-1 text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-50/50 rounded-lg inline-block">Hệ thống File</h4>
            {docResources.map(r => (
              <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
        {htmlResources.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="px-2 py-1 text-[8px] font-black text-sky-400 uppercase tracking-widest bg-sky-50/50 rounded-lg inline-block">Liên kết ngoài</h4>
            {htmlResources.map(r => (
              <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
        {lessonResources.length === 0 && <p className="text-center text-[9px] text-slate-200 font-bold uppercase pt-4 pb-4 tracking-widest">Trống</p>}
      </div>

      {/* SECTION 2: GLOBAL RESOURCES */}
      <div className="sticky top-0 z-20 px-4 py-3 flex justify-between items-center border-y bg-white/95 backdrop-blur-sm text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">
        Thư viện chung {isAdmin && <button onClick={()=>onAdd(true)} className={`${currentThemeTextClass} ${currentThemeHoverBgClass} p-1 rounded-lg`}><Plus size={16}/></button>}
      </div>
      <div className="p-3 space-y-2 bg-white/30">
        {globalResources.map(r => (
          <ResourceItem key={r.id} r={r} isGlobal={true} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {globalResources.length === 0 && <p className="text-center text-[9px] text-slate-200 font-bold uppercase pt-4 pb-4 tracking-widest">Trống</p>}
      </div>
    </aside>
  );
};

export default ResourcesPanel;
