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
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState('1');

  const [isPetVisible, setIsPetVisible] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setProjects([
      { id: '1', name: '新项目', sessions: 0, artifacts: 0, createdAt: Date.now() },
    ]);
  }, []);

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
    // Clear global board state
    boardStore.clear();
    
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
    // In a real app, this would fetch and hydrate the project's data into boardStore.
    // For now, we simulate switching projects by clearing the board and remounting.
    boardStore.clear();
    setCurrentProjectId(id);
  }, []);

  const handleRenameProject = useCallback((id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  }, []);

  const handleBindFeishu = useCallback((id: string, feishuConfig: any) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, feishuConfig } : p));
    if (id === currentProjectId) {
      (window as any).__currentProjectFeishuConfig = feishuConfig;
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
    <div className="h-screen w-screen flex overflow-hidden bg-[#FAFAFA]">
      {/* Project Sidebar (Collapsible) */}
      <ProjectSidebar 
        isOpen={isSidebarOpen}
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

      {/* Left Side - Board Panel (较小比例) */}
      <div className="w-[380px] flex-shrink-0 bg-[#C1C9CC] overflow-hidden border-l border-gray-300/30">
        <LeftPanel 
          key={`left-${currentProjectId}`}
          projectName={currentProject?.name || '新项目'}
          onCardCountChange={setCardCount}
          onCardUpdate={handleCardUpdate}
          onCardDelete={handleCardDelete}
          onCardChat={handleCardChat}
          onNewProject={handleNewProject}
        />
      </div>

      {/* Right Side - Chat Panel (占大部分) */}
      <div className="flex-1 bg-[#C1C9CC] p-4 pl-0">
        <div className="h-full w-full bg-[#E6E9EB] rounded-3xl overflow-hidden shadow-sm border border-white/40">
          <ChatPanel 
          key={`chat-${currentProjectId}`}
          projectName={currentProject?.name || '新项目'}
          onCardsGenerated={handleCardsGenerated}
          chatCard={chatCard}
          onChatComplete={handleChatComplete}
          onProjectRename={(newName) => handleRenameProject(currentProjectId, newName)}
          isPetVisible={isPetVisible}
          onSetPetVisible={setIsPetVisible}
        />
        </div>
      </div>

      {/* Notification Toast */}
      {generatedCount > 0 && (
        <div className="fixed bottom-6 left-6 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          ✓ AI 已同步 {generatedCount} 张卡片
        </div>
      )}
    </div>
  );
}
