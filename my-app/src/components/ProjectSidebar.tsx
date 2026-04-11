import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface Project {
  id: string;
  name: string;
  sessions: number;
  artifacts: number;
  isPinned?: boolean;
  createdAt?: number;
  feishuConfig?: {
    bindType?: 'bitable' | 'doc';
    appToken?: string;
    tableId?: string;
    folderToken?: string;
    documentId?: string;
  };
  feishuTableName?: string;
}

interface UserInfo {
  name: string;
  avatar_url: string;
  open_id: string;
}

interface ProjectSidebarProps {
  isOpen: boolean;
  isHidden?: boolean;
  onToggle: () => void;
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;
  onPinProject?: (id: string) => void;
  onBindFeishu?: (id: string, config: any) => Promise<void> | void;
  onTogglePet?: () => void;
  isPetVisible?: boolean;
}

export function ProjectSidebar({ 
  isOpen, 
  onToggle, 
  projects, 
  currentProjectId, 
  onSelectProject, 
  onNewProject,
  onRenameProject,
  onDeleteProject,
  onPinProject,
  onBindFeishu,
  onTogglePet,
  isPetVisible = false,
  isHidden = false
}: ProjectSidebarProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  
  // Modals state
  const [renameModalId, setRenameModalId] = useState<string | null>(null);
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [bindFeishuModalId, setBindFeishuModalId] = useState<string | null>(null);
  const [feishuConfigForm, setFeishuConfigForm] = useState<{ bindType: 'bitable' | 'doc'; appToken: string; tableId: string; folderToken: string; documentId: string }>({ bindType: 'bitable', appToken: '', tableId: '', folderToken: '', documentId: '' });
  const [newProjectName, setNewProjectName] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  
  const [isBinding, setIsBinding] = useState(false);

  // Ref for clicking outside the menu
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userCookie = document.cookie.split('; ').find(row => row.startsWith('feishu_user='));
    if (userCookie) {
      try {
        let userValue = userCookie.substring('feishu_user='.length);
        // Next.js might double-encode the cookie, so we decode until no more '%' or it doesn't change
        while (userValue.includes('%')) {
          const decoded = decodeURIComponent(userValue);
          if (decoded === userValue) break;
          userValue = decoded;
        }
        setUserInfo(JSON.parse(userValue));
      } catch (e) {
        console.error('Failed to parse user cookie', e);
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
      // Assuming you might click outside the user menu, close it
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu-container') && !target.closest('.user-dropdown-menu')) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <>
      {/* Sidebar Panel */}
      <div 
        className={`flex flex-col h-full bg-[#C7CFD1] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shrink-0 overflow-hidden ${
          isHidden ? 'w-0 opacity-0 border-none' : (isOpen ? 'w-[260px] border-r border-gray-200/60' : 'w-[68px] border-r border-gray-200/60')
        }`}
      >
        {isOpen ? (
          <div className="p-6 flex-1 flex flex-col min-w-[260px] opacity-100 transition-opacity duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
              <span className="text-[13px] font-medium tracking-[0.25em] text-gray-700">FLOWD</span>
              <button onClick={onToggle} className="text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Subheader */}
            <div className="text-[10px] font-semibold tracking-[0.2em] text-gray-400 mb-4 ml-1">
              项目名称
            </div>
            
            {/* Projects List */}
            <div className="flex-1 overflow-y-auto space-y-1 -mx-3 no-scrollbar" ref={menuRef}>
              {projects.map(project => (
                <div key={project.id} className="relative group">
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-[20px] transition-colors flex justify-between items-center ${
                      currentProjectId === project.id 
                        ? 'bg-gray-100/80' 
                        : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-[15px] font-semibold text-gray-900 mb-1.5">
                        {project.name}
                      </div>
                      <div className="text-[10px] font-mono tracking-[0.1em] text-gray-400 uppercase">
                        {project.sessions} 会话数 · {project.artifacts} 产出物
                      </div>
                    </div>
                    
                    {/* Three dots button */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === project.id ? null : project.id);
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:bg-gray-200/50 ${
                        activeMenuId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {activeMenuId === project.id && (
                    <div className="absolute right-4 top-12 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-fade-in origin-top-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onPinProject?.(project.id);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        {project.isPinned ? (
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3l18 18M9.5 9.5L5 21V5h3m6 0h5a2 2 0 012 2v6.5M14 14l-3-3m0 0l-3 3" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                        {project.isPinned ? '取消置顶' : '置顶'}
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setBindFeishuModalId(project.id);
                          const conf = project.feishuConfig || {};
                          setFeishuConfigForm({
                            bindType: conf.bindType || 'bitable',
                            appToken: conf.appToken || '',
                            tableId: conf.tableId || '',
                            folderToken: conf.folderToken || '',
                            documentId: conf.documentId || ''
                          });
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <span className="w-4 text-center">🔗</span>
                        绑定飞书
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewProjectName(project.name);
                          setRenameModalId(project.id);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        重命名
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModalId(project.id);
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        删除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Projects list end */}
          </div>
        ) : (
          <div className="py-6 flex-1 flex flex-col items-center w-[68px] opacity-100 transition-opacity duration-300">
            <button onClick={onToggle} className="text-gray-400 hover:text-gray-700 transition-colors mb-6 mt-1 flex justify-center w-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <div className="text-[10px] font-medium tracking-[0.2em] text-[#9EA8B0] mb-8">
              FLOWD
            </div>

            <div className="flex-1 flex flex-col items-center space-y-4 w-full overflow-y-auto no-scrollbar">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`w-10 h-10 rounded-[12px] flex items-center justify-center text-[15px] font-semibold transition-colors ${
                    currentProjectId === project.id
                      ? 'bg-gray-100/80 text-gray-900'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  title={project.name}
                >
                  {project.name.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* User Profile Footer */}
        {userInfo && (
          <div className="relative mt-auto border-t border-gray-100 shrink-0 user-menu-container">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsUserMenuOpen(!isUserMenuOpen);
              }}
              className={`w-full flex items-center transition-all duration-300 hover:bg-gray-50 cursor-pointer ${isOpen ? 'p-6 justify-start gap-4' : 'py-6 flex-col justify-center gap-0'}`}
            >
              <div className="w-[42px] h-[42px] rounded-full bg-[#EBF4FF] flex items-center justify-center shrink-0 overflow-hidden relative">
                {userInfo.avatar_url ? (
                  <img src={userInfo.avatar_url} alt={userInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-[#8BA8CD] relative top-[2px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              {isOpen && (
                <div className="text-[17px] font-medium text-gray-900 truncate tracking-tight">
                  {userInfo.name}
                </div>
              )}
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && typeof window !== 'undefined' && createPortal(
              <div 
                className="absolute w-48 bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 py-1 z-[9999] animate-fade-in origin-bottom-left user-dropdown-menu"
                style={{
                  bottom: '85px',
                  left: isOpen ? '16px' : '8px'
                }}
              >
                <a 
                  href="https://flowd-thinking-os.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Flowd 官网
                </a>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePet?.();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isPetVisible ? '关闭宠物' : '电子宠物'}
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutModalOpen(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  退出登录
                </button>
              </div>,
              document.body
            )}
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-[400px] p-6 animate-scale-in relative">
            <button 
              onClick={() => setIsLogoutModalOpen(false)}
              className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-[#FF9900]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L1 21h22L12 2zm1 16h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
              </svg>
              <h3 className="text-[18px] font-semibold text-gray-900 tracking-tight">确认退出登录？</h3>
            </div>
            <p className="text-[15px] text-gray-600 mb-8 pl-8 leading-relaxed">退出登录不会丢失任何数据，你仍可以登录此账号。</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-6 py-2 text-[15px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded-[10px] transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => window.location.href = '/api/feishu/logout'}
                className="px-6 py-2 text-[15px] font-medium text-white bg-[#FF4D4F] hover:bg-[#FF7875] rounded-[10px] transition-colors shadow-sm"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bind Feishu Modal */}
      {bindFeishuModalId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">绑定飞书归档</h3>
            
            {/* Type Selector */}
            <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
              <button
                onClick={() => setFeishuConfigForm(prev => ({ ...prev, bindType: 'bitable' }))}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${feishuConfigForm.bindType === 'bitable' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                多维表格
              </button>
              <button
                onClick={() => setFeishuConfigForm(prev => ({ ...prev, bindType: 'doc' }))}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${feishuConfigForm.bindType === 'doc' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                云文档
              </button>
            </div>

            <div className="space-y-4">
              {feishuConfigForm.bindType === 'bitable' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">多维表格 App Token</label>
                    <input
                      type="text"
                      value={feishuConfigForm.appToken}
                      onChange={(e) => setFeishuConfigForm(prev => ({ ...prev, appToken: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g. bascn..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">多维表格 Table ID</label>
                    <input
                      type="text"
                      value={feishuConfigForm.tableId}
                      onChange={(e) => setFeishuConfigForm(prev => ({ ...prev, tableId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g. tbl..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">长文本归档文件夹 Token (可选)</label>
                    <input
                      type="text"
                      value={feishuConfigForm.folderToken}
                      onChange={(e) => setFeishuConfigForm(prev => ({ ...prev, folderToken: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="e.g. fld..."
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">飞书文档 ID</label>
                  <input
                    type="text"
                    value={feishuConfigForm.documentId}
                    onChange={(e) => setFeishuConfigForm(prev => ({ ...prev, documentId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    placeholder="e.g. docxcn..."
                  />
                  <p className="text-xs text-gray-500 mt-2">系统将读取该文档内容进行上下文同步和内容记录。</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setBindFeishuModalId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setIsBinding(true);
                  try {
                    await onBindFeishu?.(bindFeishuModalId, feishuConfigForm);
                    setBindFeishuModalId(null);
                  } catch (e) {
                    console.error('Binding failed', e);
                  } finally {
                    setIsBinding(false);
                  }
                }}
                disabled={isBinding}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isBinding ? '保存中...' : '保存绑定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModalId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in relative">
            <button 
              onClick={() => setRenameModalId(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">编辑项目名称</h3>
            <input 
              type="text" 
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="输入名称"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-900 mb-6 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRenameModalId(null)}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (newProjectName.trim()) {
                    onRenameProject?.(renameModalId, newProjectName.trim());
                  }
                  setRenameModalId(null);
                }}
                className="px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-colors"
                style={{ backgroundColor: '#1B1D1F' }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in relative">
            <button 
              onClick={() => setDeleteModalId(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">确定删除项目？</h3>
            </div>
            <p className="text-gray-600 mb-6 pl-11">删除后，项目记录将不可恢复。</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteModalId(null)}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  onDeleteProject?.(deleteModalId);
                  setDeleteModalId(null);
                }}
                className="px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-colors"
                style={{ backgroundColor: '#1B1D1F' }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
