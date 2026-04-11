'use client';

import { useState, useCallback, useEffect } from 'react';
import { LeftPanel } from '@/components/LeftPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { ProjectSidebar, Project } from '@/components/ProjectSidebar';
import { Card } from '@/types/board';
import { boardStore } from '@/lib/board-store';

const INITIAL_PROJECTS: Project[] = [
  { id: '1', name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() },
];

export default function Home() {
  const [cardCount, setCardCount] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [chatCard, setChatCard] = useState<Card | null>(null);

  // Sidebar and Project State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState('1');

  const [isPetVisible, setIsPetVisible] = useState(true);
  const [bindSuccessMessage, setBindSuccessMessage] = useState<{ tableName: string; timestamp: number } | null>(null);

  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState('');

  // Helper to get namespaced storage keys
  const getProjectsKey = (uid: string) => uid ? `flowd_projects_${uid}` : 'flowd_projects';
  const getCurrentProjectKey = (uid: string) => uid ? `flowd_current_project_id_${uid}` : 'flowd_current_project_id';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreenMode) {
        setIsFullScreenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let currentUserId = '';
      const userCookie = document.cookie.split('; ').find(row => row.startsWith('feishu_user='));
      if (userCookie) {
        try {
          let userValue = userCookie.substring('feishu_user='.length);
          while (userValue.includes('%')) {
            const decoded = decodeURIComponent(userValue);
            if (decoded === userValue) break;
            userValue = decoded;
          }
          const user = JSON.parse(userValue);
          currentUserId = user.open_id || '';
        } catch (e) {
          console.error('Failed to parse user cookie', e);
        }
      }
      setUserId(currentUserId);
      boardStore.setUserId(currentUserId);

      try {
        const storedProjects = localStorage.getItem(getProjectsKey(currentUserId));
        const storedCurrentProjectId = localStorage.getItem(getCurrentProjectKey(currentUserId));
        
        if (storedProjects) {
          const parsedProjects = JSON.parse(storedProjects);
          setProjects(parsedProjects);
          
          if (storedCurrentProjectId && parsedProjects.some((p: Project) => p.id === storedCurrentProjectId)) {
            setCurrentProjectId(storedCurrentProjectId);
            boardStore.setProjectId(storedCurrentProjectId);
          } else if (parsedProjects.length > 0) {
            setCurrentProjectId(parsedProjects[0].id);
            boardStore.setProjectId(parsedProjects[0].id);
          }
        } else {
          setProjects([
            { id: '1', name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() },
          ]);
          boardStore.setProjectId('1');
        }
      } catch (e) {
        console.error('Failed to load projects from localStorage', e);
        setProjects([
          { id: '1', name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() },
        ]);
        boardStore.setProjectId('1');
      }
      setMounted(true);
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        localStorage.setItem(getProjectsKey(userId), JSON.stringify(projects));
      } catch (e) {
        console.error('Failed to save projects to localStorage', e);
      }
    }
  }, [projects, mounted, userId]);

  // Save current project id to localStorage whenever it changes
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        localStorage.setItem(getCurrentProjectKey(userId), currentProjectId);
        boardStore.setProjectId(currentProjectId);
      } catch (e) {
        console.error('Failed to save current project id to localStorage', e);
      }
    }
  }, [currentProjectId, mounted, userId]);

  // Sync artifacts count dynamically based on the current board store stats
  useEffect(() => {
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId ? { ...p, artifacts: cardCount } : p
    ));
  }, [cardCount, currentProjectId]);

  // A simple way to estimate session count based on number of AI generated responses.
  // We can track generated count over time or simply hook into handleCardsGenerated.
  const handleCardsGenerated = useCallback((count: number) => {
    setGeneratedCount(count);
    
    // Every time AI generates cards, we can treat that as part of a session.
    // For a real app, session logic would be tied to message rounds.
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId ? { ...p, sessions: p.sessions + 1 } : p
    ));

    setTimeout(() => setGeneratedCount(0), 3000);
  }, [currentProjectId]);

  // Handle card creation to trigger auto-archive
  const handleCardAdd = useCallback(async (card: Card) => {
    // Attempt auto archive if feishu config exists
    const project = projects.find(p => p.id === currentProjectId);
    if (project?.feishuConfig?.appToken) {
      try {
        const res = await fetch('/api/feishu/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card,
            project,
            feishuConfig: project.feishuConfig
          })
        });
        const data = await res.json();
        if (data.success && data.documentUrl) {
          // If a document was created, we can update the card with the url
          boardStore.updateCard(card.id, {
            status: 'synced',
            metadata: {
              ...card.metadata,
              url: data.documentUrl,
              urlTitle: '查看飞书文档'
            }
          });
        } else if (data.success) {
          boardStore.updateCard(card.id, { status: 'synced' });
        }
      } catch (e) {
        console.error('Auto archive failed:', e);
      }
    }
  }, [currentProjectId, projects]);

  useEffect(() => {
    // Subscribe to board store to detect new cards for auto-archiving
    const unsubscribe = boardStore.subscribe(() => {
      // In a real app, we'd need a more robust way to track newly added cards versus updates
      // This is simplified for demonstration
      const sections = boardStore.getSections();
      const allCards = sections.flatMap(s => s.cards);
      const newCards = allCards.filter(c => c.status === 'new');
      
      newCards.forEach(card => {
        handleCardAdd(card);
        // Mark as processing to avoid duplicate archiving
        boardStore.updateCard(card.id, { status: 'updated' });
      });
    });

    return () => { unsubscribe(); };
  }, [handleCardAdd]);

  // Handle card update (for checkbox states, etc.)
  const handleCardUpdate = useCallback((id: string, updates: Partial<Card>) => {
    boardStore.updateCard(id, updates);
  }, []);

  // Handle card delete
  const handleCardDelete = useCallback((id: string) => {
    boardStore.deleteCard(id);
  }, []);

  // Handle chat button click on open_question cards
  const handleCardChat = useCallback((card: Card) => {
    setChatCard(card);
  }, []);

  // Clear chat card when discussion is done
  const handleChatComplete = useCallback(() => {
    setChatCard(null);
  }, []);

  const handleNewProject = useCallback(() => {
    // Create new project and prepend it to the list
    const newId = Date.now().toString();
    setProjects(prev => [
      { id: newId, name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() },
      ...prev
    ]);
    
    // Switch to the new project ID (this forces components to remount)
    setCurrentProjectId(newId);
    
    // Auto-close sidebar on mobile or smaller screens if desired
    // setIsSidebarOpen(false); 
  }, []);

  const handleSelectProject = useCallback((id: string) => {
    // boardStore.setProjectId handles hydration
    setCurrentProjectId(id);
  }, []);

  const handleRenameProject = useCallback((id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  }, []);

  const handleBindFeishu = useCallback(async (id: string, feishuConfig: any) => {
    let tableName = feishuConfig?.bindType === 'doc' ? '飞书文档' : '飞书多维表格';
    
    if (feishuConfig?.bindType === 'doc' && feishuConfig?.documentId) {
      try {
        const res = await fetch(`/api/feishu/doc?document_id=${feishuConfig.documentId}`);
        const data = await res.json();
        
        if (!res.ok || data.error) {
          console.error('Failed to fetch doc info:', data.error);
          alert(`绑定失败: ${data.error || '获取飞书文档信息失败，请检查文档 ID 是否正确'}`);
          throw new Error(data.error || 'Failed to fetch doc info');
        }
        
        if (data.name) {
          tableName = data.name;
        }

        // Mock importing data from Feishu to Flowd
        boardStore.addCard('note', {
          title: `来自文档 "${tableName}" 的同步配置`,
          content: `成功绑定了云文档：文档 ID (${feishuConfig.documentId})，已与 Flowd 平台建立关联。`
        });
      } catch (e) {
        console.error('Failed to fetch doc info', e);
        throw e;
      }
    } else if (feishuConfig?.appToken) {
      try {
        const res = await fetch(`/api/feishu/bitable?app_token=${feishuConfig.appToken}`);
        const data = await res.json();
        
        if (!res.ok || data.error) {
          console.error('Failed to fetch bitable info:', data.error);
          alert(`绑定失败: ${data.error || '获取多维表格信息失败，请检查 App Token 是否正确'}`);
          throw new Error(data.error || 'Failed to fetch bitable info');
        }
        
        if (data.name) {
          tableName = data.name;
        }

        // Mock importing data from Feishu to Flowd
        boardStore.addCard('note', {
          title: `来自表格 "${tableName}" 的同步配置`,
          content: `成功绑定了多维表格：App Token (${feishuConfig.appToken})，已与 Flowd 平台建立关联。`
        });
      } catch (e) {
        console.error('Failed to fetch bitable info', e);
        throw e;
      }
    }
    
    setProjects(prev => prev.map(p => p.id === id ? { ...p, feishuConfig, feishuTableName: tableName } : p));
    if (id === currentProjectId) {
      (window as any).__currentProjectFeishuConfig = feishuConfig;
      setBindSuccessMessage({ tableName, timestamp: Date.now() });
      setIsChatOpen(true); // Open chat if closed
    }
  }, [currentProjectId]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      // If we delete the current project, switch to the first available one, or create a new one
      if (id === currentProjectId) {
        // Use setTimeout to defer state changes that affect other components
        // until after the current render cycle completes
        setTimeout(() => {
          if (filtered.length > 0) {
            setCurrentProjectId(filtered[0].id);
            boardStore.clear(); // Simulate loading the new active project
          } else {
            // If no projects left, create a default one
            const newId = Date.now().toString();
            setCurrentProjectId(newId);
            boardStore.clear();
            setProjects([{ id: newId, name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() }]);
          }
        }, 0);
        return filtered;
      }
      return filtered;
    });
  }, [currentProjectId]);

  const handlePinProject = useCallback((id: string) => {
    setProjects(prev => prev.map(p => 
      p.id === id ? { ...p, isPinned: !p.isPinned } : p
    ));
  }, []);

  // Compute display projects: pinned projects first, followed by unpinned in their original order
  const displayProjects = [
    ...projects.filter(p => p.isPinned),
    ...projects.filter(p => !p.isPinned)
  ];

  const currentProject = projects.find(p => p.id === currentProjectId);

  if (!mounted) {
    return null;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#C1C9CC]">
      {/* Full Screen Mode Hint */}
      {isFullScreenMode && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-black/60 text-white/90 backdrop-blur-md px-6 py-2 rounded-full text-sm font-medium animate-fade-in flex items-center gap-2 shadow-lg">
          <span className="opacity-70">⌨️</span> 按 <kbd className="px-2 py-0.5 bg-white/20 rounded text-xs ml-1 mr-1 font-mono">ESC</kbd> 退出全屏模式
        </div>
      )}

      {/* Project Sidebar (Collapsible) */}
      <ProjectSidebar 
        isOpen={isSidebarOpen}
        isHidden={isFullScreenMode}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        projects={displayProjects}
        currentProjectId={currentProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={handleDeleteProject}
        onPinProject={handlePinProject}
        onBindFeishu={handleBindFeishu}
        onTogglePet={() => setIsPetVisible(!isPetVisible)}
        isPetVisible={isPetVisible}
      />

      {/* Left Side - Board Panel */}
      <div className={`flex-shrink-0 bg-[#C1C9CC] overflow-hidden border-l border-gray-300/30 transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${isChatOpen ? 'w-[380px]' : 'flex-1 w-full'}`}>
        <LeftPanel 
          key={`left-${userId}-${currentProjectId}`}
          projectName={currentProject?.name || '新项目'}
          isFeishuSynced={!!currentProject?.feishuConfig?.appToken}
          onCardCountChange={setCardCount}
          onCardUpdate={handleCardUpdate}
          onCardDelete={handleCardDelete}
          onCardChat={handleCardChat}
          onNewProject={handleNewProject}
          feishuTableName={currentProject?.feishuTableName}
          isExpanded={!isChatOpen}
          onToggleFullScreen={() => setIsFullScreenMode(true)}
        />
      </div>

      {/* Right Side - Chat Panel (占大部分) */}
      <div 
        className={`transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-[calc(100%-2rem)_calc(100%-2rem)] flex flex-col ${
          isChatOpen 
            ? 'flex-1 p-4 pl-0 opacity-100 scale-100 translate-x-0 translate-y-0 w-auto' 
            : 'w-0 p-0 opacity-0 scale-[0.05] translate-x-12 translate-y-12'
        }`}
      >
        <div className="h-full w-full bg-[#E6E9EB] rounded-3xl overflow-hidden shadow-2xl border border-white/40 min-w-[500px]">
          <ChatPanel 
          key={`chat-${userId}-${currentProjectId}`}
          projectId={currentProjectId}
          projectName={currentProject?.name || '新项目'}
          userId={userId}
          feishuConfig={currentProject?.feishuConfig}
          onCardsGenerated={handleCardsGenerated}
          chatCard={chatCard}
          onChatComplete={handleChatComplete}
          onProjectRename={(newName) => handleRenameProject(currentProjectId, newName)}
          isPetVisible={isPetVisible}
          onSetPetVisible={setIsPetVisible}
          onClose={() => setIsChatOpen(false)}
          bindSuccessMessage={bindSuccessMessage}
          onClearBindSuccessMessage={() => setBindSuccessMessage(null)}
        />
        </div>
      </div>

      {/* Floating Logo to reopen chat */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-8 right-8 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 hover:shadow-xl transition-all duration-300 z-50 overflow-hidden border border-gray-200 animate-scale-in"
        >
          <img src="/logo.png" alt="Open Chat" className="w-10 h-10 object-contain" />
        </button>
      )}

      {/* Notification Toast */}
      {generatedCount > 0 && (
        <div className="fixed bottom-6 left-6 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          ✓ AI 已同步 {generatedCount} 张卡片
        </div>
      )}
    </div>
  );
}
