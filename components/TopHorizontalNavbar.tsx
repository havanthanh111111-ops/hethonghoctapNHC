import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Book, ChevronDown, ChevronRight, Settings, Plus, Search, LogOut, Folder, Globe, Users, Maximize2, Home, Sparkles, FolderOpen, PanelRightOpen, Terminal, CheckCircle2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { BookNode, Subject, Student } from '../types';

interface TopHorizontalNavbarProps {
  nodes: BookNode[];
  selectedId: string | null;
  themeColor: string;
  isAdmin: boolean;
  student: Student | null;
  currentSubject: Subject | null;
  visitorCount: number;
  onSelectNode: (id: string | null) => void;
  onShowSettings: () => void;
  onAddNode: (parentId: string | null, type: 'folder' | 'lesson') => void;
  onEditNode: (node: BookNode) => void;
  onDeleteNode: (id: string) => void;
  onReorderNode: (id: string, direction: 'up' | 'down') => void;
  onMoveNode: (id: string, direction: 'in' | 'out') => void;
  onLogout: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

interface DropdownTreeItemProps {
  node: BookNode;
  allNodes: BookNode[];
  selectedId: string | null;
  themeColor: string;
  isAdmin: boolean;
  onSelectNode: (id: string | null) => void;
  onAddNode: (parentId: string | null, type: 'folder' | 'lesson') => void;
  onEditNode: (node: BookNode) => void;
  onDeleteNode: (id: string) => void;
  onReorderNode: (id: string, direction: 'up' | 'down') => void;
  onMoveNode: (id: string, direction: 'in' | 'out') => void;
  level: number;
  currentTheme: any;
  expandedNodes: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onCloseDropdown: () => void;
}

const DropdownTreeItem: React.FC<DropdownTreeItemProps> = ({
  node,
  allNodes,
  selectedId,
  themeColor,
  isAdmin,
  onSelectNode,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onReorderNode,
  onMoveNode,
  level,
  currentTheme,
  expandedNodes,
  onToggleExpand,
  onCloseDropdown
}) => {
  const isExpanded = !!expandedNodes[node.id];
  const isSelected = selectedId === node.id;

  const hasSelectedDescendant = useMemo(() => {
    if (!selectedId) return false;
    const check = (folderId: string): boolean => {
      const directChildren = (allNodes || []).filter(n => n.parentId === folderId);
      for (const child of directChildren) {
        if (child.id === selectedId) return true;
        if (child.type === 'folder' && check(child.id)) return true;
      }
      return false;
    };
    return check(node.id);
  }, [allNodes, node.id, selectedId]);

  const children = useMemo(() => {
    return (allNodes || [])
      .filter(n => n.parentId === node.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [allNodes, node.id]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'folder') {
      onSelectNode(node.id);
      onToggleExpand(node.id);
    } else {
      onSelectNode(node.id);
      onCloseDropdown();
    }
  };

  let itemClass = 'hover:bg-slate-50 text-slate-600';
  let iconColorClass = 'text-slate-400';
  let folderColorClass = 'text-amber-500';
  let globeColorClass = 'text-sky-500';

  if (isSelected) {
    itemClass = `${currentTheme.bg} text-white shadow-sm font-bold`;
    iconColorClass = 'text-white';
    folderColorClass = 'text-white';
    globeColorClass = 'text-white';
  } else if (hasSelectedDescendant) {
    itemClass = `${currentTheme.hoverBg} ${currentTheme.text} font-bold border-l-2 border-current bg-slate-50/50`;
    iconColorClass = currentTheme.text;
    folderColorClass = currentTheme.text;
    globeColorClass = currentTheme.text;
  }

  return (
    <div className="select-none py-0.5">
      <div 
        onClick={handleToggle}
        className={`group relative flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${itemClass}`}
        style={{ paddingLeft: `${Math.max(8, level * 16)}px` }}
      >
        <div className="flex items-center min-w-0 flex-1 gap-1.5">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {node.type === 'folder' ? (
              <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                <ChevronRight size={12} className={iconColorClass} />
              </span>
            ) : (
              <Globe size={11} className={globeColorClass} />
            )}
          </div>

          {node.type === 'folder' && (
            <div className="shrink-0">
              {isExpanded ? (
                <FolderOpen size={12} className={folderColorClass} />
              ) : (
                <Folder size={12} className={folderColorClass} />
              )}
            </div>
          )}

          <span className="text-[11px] leading-tight truncate font-medium">
            {node.title}
          </span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 scale-90 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onReorderNode(node.id, 'up'); }}
              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Lên"
            >
              <ArrowUp size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReorderNode(node.id, 'down'); }}
              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Xuống"
            >
              <ArrowDown size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveNode(node.id, 'in'); }}
              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Chuyển vào trong"
            >
              <ArrowRight size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveNode(node.id, 'out'); }}
              className="p-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
              title="Chuyển ra ngoài"
            >
              <ArrowLeft size={10} />
            </button>
            {node.type === 'folder' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNode(node.id, 'lesson');
                }}
                className={`p-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors`}
                title="Thêm bài học"
              >
                <Plus size={10} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditNode(node);
              }}
              className="p-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
              title="Sửa"
            >
              <Settings size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(node.id);
              }}
              className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              title="Xóa"
            >
              <Trash2 size={10} />
            </button>
          </div>
        )}
      </div>

      {node.type === 'folder' && isExpanded && (
        <div className="mt-0.5 border-l border-slate-100 ml-[14px]">
          {children.length === 0 ? (
            <p className="text-[9px] text-slate-300 italic py-1 pl-4">Trống</p>
          ) : (
            children.map(child => (
              <DropdownTreeItem
                key={child.id}
                node={child}
                allNodes={allNodes}
                selectedId={selectedId}
                themeColor={themeColor}
                isAdmin={isAdmin}
                onSelectNode={onSelectNode}
                onAddNode={onAddNode}
                onEditNode={onEditNode}
                onDeleteNode={onDeleteNode}
                onReorderNode={onReorderNode}
                onMoveNode={onMoveNode}
                level={level + 1}
                currentTheme={currentTheme}
                expandedNodes={expandedNodes}
                onToggleExpand={onToggleExpand}
                onCloseDropdown={onCloseDropdown}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const TopHorizontalNavbar: React.FC<TopHorizontalNavbarProps> = ({
  nodes,
  selectedId,
  themeColor,
  isAdmin,
  student,
  currentSubject,
  visitorCount,
  onSelectNode,
  onShowSettings,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onReorderNode,
  onMoveNode,
  onLogout,
  searchTerm,
  setSearchTerm
}) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Auto-expand ancestors when selectedId changes
  useEffect(() => {
    if (selectedId) {
      const ancestors: Record<string, boolean> = {};
      let current = (nodes || []).find(n => n.id === selectedId);
      while (current && current.parentId) {
        ancestors[current.parentId] = true;
        current = (nodes || []).find(n => n.id === current.parentId);
      }
      setExpandedNodes(prev => ({ ...prev, ...ancestors }));
    }
  }, [selectedId, nodes]);

  // Close dropdowns if click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownId(null);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get top-level elements (parentId is null)
  const topLevelNodes = useMemo(() => {
    return (nodes || [])
      .filter(n => n.parentId === null)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [nodes]);

  // Find all lessons or sub-items matching search
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return (nodes || []).filter(
      n => n.type === 'lesson' && n.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  // Handle selecting an item
  const handleItemClick = (id: string | null) => {
    onSelectNode(id);
    setActiveDropdownId(null);
    setShowSearchDropdown(false);
  };

  // Get nested content for a specific chapter
  const getChapterContent = (chapterId: string) => {
    const directChildren = (nodes || [])
      .filter(n => n.parentId === chapterId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Group lessons and sub-folders
    const items: {
      type: 'sub_folder' | 'lesson';
      node: BookNode;
      subLessons?: BookNode[];
    }[] = [];

    directChildren.forEach(child => {
      if (child.type === 'lesson') {
        items.push({ type: 'lesson', node: child });
      } else {
        // It's a folder (sub-folder)
        const subLessons = (nodes || [])
          .filter(n => n.parentId === child.id && n.type === 'lesson')
          .sort((a, b) => (a.order || 0) - (b.order || 0));
        items.push({ type: 'sub_folder', node: child, subLessons });
      }
    });

    return items;
  };

  const themeClasses = {
    indigo: {
      bg: 'bg-indigo-600',
      text: 'text-indigo-600',
      hoverBg: 'hover:bg-indigo-50',
      hoverBgActive: 'hover:bg-indigo-600',
      border: 'border-indigo-100',
      focusBorder: 'focus:border-indigo-400',
      accent: 'indigo'
    },
    emerald: {
      bg: 'bg-emerald-600',
      text: 'text-emerald-600',
      hoverBg: 'hover:bg-emerald-50',
      hoverBgActive: 'hover:bg-emerald-600',
      border: 'border-emerald-100',
      focusBorder: 'focus:border-emerald-400',
      accent: 'emerald'
    },
    rose: {
      bg: 'bg-rose-600',
      text: 'text-rose-600',
      hoverBg: 'hover:bg-rose-50',
      hoverBgActive: 'hover:bg-rose-600',
      border: 'border-rose-100',
      focusBorder: 'focus:border-rose-400',
      accent: 'rose'
    },
    violet: {
      bg: 'bg-violet-600',
      text: 'text-violet-600',
      hoverBg: 'hover:bg-violet-50',
      hoverBgActive: 'hover:bg-violet-600',
      border: 'border-violet-100',
      focusBorder: 'focus:border-violet-400',
      accent: 'violet'
    },
    amber: {
      bg: 'bg-amber-600',
      text: 'text-amber-600',
      hoverBg: 'hover:bg-amber-50',
      hoverBgActive: 'hover:bg-amber-600',
      border: 'border-amber-100',
      focusBorder: 'focus:border-amber-400',
      accent: 'amber'
    },
    sky: {
      bg: 'bg-sky-600',
      text: 'text-sky-600',
      hoverBg: 'hover:bg-sky-50',
      hoverBgActive: 'hover:bg-sky-600',
      border: 'border-sky-100',
      focusBorder: 'focus:border-sky-400',
      accent: 'sky'
    }
  };

  const currentTheme = themeClasses[themeColor as keyof typeof themeClasses] || themeClasses['indigo'];

  const checkIsActive = (chapterId: string) => {
    if (selectedId === chapterId) return true;
    if (!selectedId) return false;
    let current = nodes.find(n => n.id === selectedId);
    while (current) {
      if (current.parentId === chapterId) return true;
      current = nodes.find(n => n.id === current.parentId);
    }
    return false;
  };

  return (
    <header className="w-full bg-white border-b border-slate-100 shadow-sm z-[200] shrink-0 relative">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* BRAND & LOGO */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => handleItemClick(null)}
            className={`p-2 rounded-xl text-white shadow-md ${currentTheme.bg} flex items-center justify-center hover:opacity-90 active:scale-95 transition-all`}
            title="Về trang chủ"
          >
            <Home size={16} />
          </button>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black text-slate-900 uppercase tracking-wider truncate max-w-[150px] md:max-w-[200px]">
              {currentSubject?.label || 'MÔN HỌC'}
            </h1>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block -mt-0.5">Học tập đa phương thức</span>
          </div>
        </div>

        {/* HORIZONTAL CHAPTERS LIST */}
        <nav className="flex-1 flex items-center gap-1 overflow-visible px-2 h-full" ref={dropdownRef}>
          {topLevelNodes.length === 0 ? (
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest px-4">Giáo trình trống</span>
          ) : (
            topLevelNodes.map(chapter => {
              const isOpen = activeDropdownId === chapter.id;
              const isActive = checkIsActive(chapter.id);

              return (
                <div key={chapter.id} className="relative h-full flex items-center">
                  <button
                    onClick={() => {
                      setActiveDropdownId(isOpen ? null : chapter.id);
                      onSelectNode(chapter.id);
                    }}
                    className={`h-10 px-3.5 rounded-xl flex items-center gap-2 transition-all text-[11px] font-black uppercase tracking-wider relative shrink-0 ${
                      isActive 
                        ? `${currentTheme.text} bg-slate-50 border border-slate-200/50` 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Folder size={12} className={isActive ? currentTheme.text : 'text-slate-400'} />
                    <span>{chapter.title}</span>
                    <ChevronDown size={10} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* DOUBLE LEVEL DROP DOWN PORTAL */}
                  {isOpen && (
                    <div className="absolute top-[52px] left-0 min-w-[280px] max-w-[360px] bg-white border border-slate-100 rounded-2xl shadow-xl p-4 overflow-y-auto max-h-[420px] custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 z-[250]">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-50">
                        <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase">Danh mục học tập</span>
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0 scale-90">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onReorderNode(chapter.id, 'up');
                              }}
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                              title="Di chuyển sang trái"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onReorderNode(chapter.id, 'down');
                              }}
                              className="p-1 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                              title="Di chuyển sang phải"
                            >
                              <ArrowRight size={12} />
                            </button>
                            <button
                              onClick={() => {
                                onAddNode(chapter.id, 'folder');
                                setActiveDropdownId(null);
                              }}
                              className={`p-1 ${currentTheme.text} ${currentTheme.hoverBg} rounded-md`}
                              title="Tạo chương học mới"
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              onClick={() => {
                                onEditNode(chapter);
                                setActiveDropdownId(null);
                              }}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded-md"
                              title="Sửa tên chương học"
                            >
                              <Settings size={12} />
                            </button>
                            <button
                              onClick={() => {
                                onDeleteNode(chapter.id);
                                setActiveDropdownId(null);
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-md"
                              title="Xóa chương học"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      {nodes.filter(n => n.parentId === chapter.id).length === 0 ? (
                        <p className="text-[10px] text-slate-300 italic py-2 text-center">Chương chưa có nội dung</p>
                      ) : (
                        <div className="space-y-1">
                          {nodes
                            .filter(n => n.parentId === chapter.id)
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map(child => (
                              <DropdownTreeItem
                                key={child.id}
                                node={child}
                                allNodes={nodes}
                                selectedId={selectedId}
                                themeColor={themeColor}
                                isAdmin={isAdmin}
                                onSelectNode={onSelectNode}
                                onAddNode={onAddNode}
                                onEditNode={onEditNode}
                                onDeleteNode={onDeleteNode}
                                onReorderNode={onReorderNode}
                                onMoveNode={onMoveNode}
                                level={0}
                                currentTheme={currentTheme}
                                expandedNodes={expandedNodes}
                                onToggleExpand={toggleExpand}
                                onCloseDropdown={() => {
                                  setActiveDropdownId(null);
                                }}
                              />
                            ))
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* SEARCH AND USER TOOL PANEL */}
        <div className="flex items-center gap-3 shrink-0">
          {/* SEARCH BAR (POP-UP INPUT) */}
          <div className="relative" ref={searchContainerRef}>
            <div className={`flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:border-${currentTheme.accent}-400 transition-all w-[120px] md:w-[180px]`}>
              <Search size={12} className="text-slate-400 shrink-0" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Tìm bài học..." 
                className="bg-transparent border-none outline-none text-[10px] font-medium w-full ml-1.5"
              />
            </div>

            {/* FLOATING SEARCH RESULTS */}
            {showSearchDropdown && searchTerm.trim() && (
              <div className="absolute right-0 top-11 w-[240px] bg-white border border-slate-100 rounded-xl shadow-xl p-3 z-[250] max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Tìm thấy ({searchResults.length})</span>
                {searchResults.length === 0 ? (
                  <p className="text-[10px] text-slate-300 italic text-center py-4">Không tìm thấy bài học tương thích</p>
                ) : (
                  <div className="space-y-1">
                    {searchResults.map(res => (
                      <button
                        key={res.id}
                        onClick={() => handleItemClick(res.id)}
                        className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 truncate block transition-all"
                      >
                        {res.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ADMIN AND STATS CONTROLS */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
                <button 
                  onClick={onShowSettings} 
                  className={`p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl border border-amber-100/50 transition-colors flex items-center justify-center`}
                  title="Cài đặt môn học sỹ số"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => onAddNode(null, 'folder')}
                  className={`p-2 bg-${currentTheme.accent}-50 hover:bg-${currentTheme.accent}-100 text-white rounded-xl ${currentTheme.bg} transition-all flex items-center justify-center`}
                  title="Thêm chương học mới (Root Folder)"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            {/* STUDENT BADGE */}
            {student ? (
              <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200/50 rounded-xl max-w-[120px] md:max-w-[150px] truncate">
                <div className={`w-6 h-6 shrink-0 rounded-lg text-white flex items-center justify-center text-[9px] font-black ${currentTheme.bg}`}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left min-w-0 pr-1.5">
                  <p className="text-[9px] font-black text-slate-700 truncate leading-tight uppercase">{student.full_name || student.name}</p>
                </div>
              </div>
            ) : null}

            {/* EXIT LOGOUT */}
            <button
              onClick={onLogout}
              className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-100/50 hover:border-red-200 transition-colors"
              title="Đổi môn / Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};

export default TopHorizontalNavbar;
