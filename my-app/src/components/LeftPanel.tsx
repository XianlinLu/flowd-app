'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BoardSection, Card, ContentCategory } from '@/types/board';
import { boardStore } from '@/lib/board-store';
import { toast } from '@/lib/toast';
import { DraggableCard } from './DraggableCard';
import { FlowdCard } from './FlowdCard';
import { ExpandedBoard } from './ExpandedBoard';
import { FeishuFolderSelectModal } from './FeishuFolderSelectModal';

interface LeftPanelProps {
  projectName?: string;
  onCardCountChange?: (count: number) => void;
  onCardUpdate?: (id: string, updates: Partial<Card>) => void;
  onCardDelete?: (id: string) => void;
  onCardChat?: (card: Card) => void;
  onNewProject?: () => void;
  feishuTableName?: string;
  isFeishuSynced?: boolean;
  isExpanded?: boolean;
  onToggleFullScreen?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  cardId?: string;
}

export function LeftPanel({ projectName = '新项目', onCardCountChange, onCardUpdate, onCardDelete, onCardChat, onNewProject, feishuTableName, isFeishuSynced, isExpanded = false, onToggleFullScreen }: LeftPanelProps) {
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCard = selectedCardId ? sections.flatMap(s => s.cards).find(c => c.id === selectedCardId) : null;
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isTodoModalOpen, setIsTodoModalOpen] = useState(false);
  const [isWrapUpModalOpen, setIsWrapUpModalOpen] = useState(false);
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState<{ type: 'card' | 'creation', cardId?: string, formData?: any, category?: string } | null>(null);
  
  // Todo Modal State
  const [todoTitle, setTodoTitle] = useState('');
  const [todoItems, setTodoItems] = useState<string[]>(['']);

  // Wrap Up State
  const [isWrapUpLoading, setIsWrapUpLoading] = useState(false);
  const [wrapUpData, setWrapUpData] = useState({
    summary: '',
    todos: [] as string[]
  });

  // Creation Modal State
  const [creationModalType, setCreationModalType] = useState<'meeting' | 'prd' | 'bug' | 'bookmark' | null>(null);
  const [creationFormData, setCreationFormData] = useState<any>({});

  useEffect(() => {
    setMounted(true);
    setSections(boardStore.getSections());
    
    const unsubscribe = boardStore.subscribe(() => {
      const newSections = boardStore.getSections();
      setSections([...newSections]);
      const totalCards = newSections.reduce((sum, s) => sum + s.cards.length, 0);
      onCardCountChange?.(totalCards);
    });

    return () => { unsubscribe(); };
  }, [onCardCountChange]);

  const handleDeleteCard = useCallback((id: string) => {
    onCardDelete?.(id);
  }, [onCardDelete]);

  const handleUpdateCard = useCallback((id: string, updates: Partial<Card>) => {
    onCardUpdate?.(id, updates);
  }, [onCardUpdate]);

  const handleChatCard = useCallback((card: Card) => {
    onCardChat?.(card);
  }, [onCardChat]);

  const handleContextMenu = useCallback((e: React.MouseEvent, cardId?: string) => {
    e.preventDefault();
    
    // Estimate menu dimensions
    const MENU_WIDTH = 192; // w-48 is 12rem = 192px
    const MENU_HEIGHT = 450; // Approximate height for 11 items + paddings
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Check horizontal boundaries
    if (x + MENU_WIDTH > window.innerWidth) {
      x = window.innerWidth - MENU_WIDTH - 16;
    }
    
    // Check vertical boundaries - if not enough space below, open upwards
    if (y + MENU_HEIGHT > window.innerHeight) {
      y = Math.max(16, y - MENU_HEIGHT);
    }

    setContextMenu({
      x,
      y,
      cardId,
    });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCreateTodo = () => {
    setTodoTitle('');
    setTodoItems(['']);
    setIsTodoModalOpen(true);
    setContextMenu(null);
  };

  const handleCreateMeeting = () => {
    setCreationModalType('meeting');
    setCreationFormData({
      title: '新建会议记录',
      content: '请填写会议详情',
      participants: '',
      agenda: '',
      minutes: ''
    });
    setContextMenu(null);
  };

  const handleCreatePRD = () => {
    setCreationModalType('prd');
    setCreationFormData({
      title: '新建PRD需求文档',
      content: '请填写需求详情',
      background: '',
      objectives: '',
      acceptanceCriteria: '',
      prdLink: ''
    });
    setContextMenu(null);
  };

  const handleCreateBug = () => {
    setCreationModalType('bug');
    setCreationFormData({
      title: '新建Bug问题记录',
      content: '请填写问题详情',
      severity: 'medium',
      stepsToReproduce: '',
      assignee: ''
    });
    setContextMenu(null);
  };

  const handleCreateBookmark = () => {
    setCreationModalType('bookmark');
    setCreationFormData({
      title: '新建链接收藏',
      content: '请填写链接详情',
      url: '',
      summary: ''
    });
    setContextMenu(null);
  };

  const handleCreateAboutFlowd = () => {
    boardStore.addCard('note', {
      title: '关于Flowd',
      content: `Flowd 是一个思考空间，每个项目围绕一段连续对话展开。用户在对话中表达想法、做出决策、提出问题、同步进展、分享发现、标记完成事项，AI 助手则全程倾听、协同思考，并将所有内容实时整理成动态项目看板。看板会自动生成，用户无需手动管理。

它并非附带看板功能的聊天软件，也不是带有聊天面板的看板工具，而是一款一体化产品：以对话为输入，以看板为输出，二者同步并行、浑然一体。

最贴切的体验感受是：就像在 iMessage 里与一位极其聪明的协作伙伴交流，对方熟知所有内容、牢记所有细节，在你沟通的同时，默默帮你把项目打理得井井有条。`,
      metadata: {
        aiGenerated: false,
        tags: ['关于'],
        isAboutFlowd: true // Special flag for styling
      },
    }, 'about');
    setContextMenu(null);
  };

  const handleWrapUpProject = async () => {
    setIsWrapUpModalOpen(true);
    setContextMenu(null);
    setIsWrapUpLoading(true);
    
    try {
      const cards = boardStore.getAllCards();
      const cardsContext = cards.map(c => `[${c.category}] ${c.title}\n${c.content}`).join('\n\n');
      
      const systemPrompt = `你是一个项目总结助手。请根据当前项目的所有卡片内容，生成结构化的项目总结和待解决事项。
请严格返回 JSON 格式，包含以下两个字段：
{
  "summary": "包含以下六个段落的文本，必须严格使用 markdown 格式分段，段落标题必须用加粗的星号包围，不要使用特殊字符前缀，不要有多余换行：\\n**项目如何开始**\\n这里写内容...\\n\\n**项目如何演变**\\n这里写内容...\\n\\n**探索过及放弃的内容**\\n这里写内容...\\n\\n**已决定的内容**\\n这里写内容...\\n\\n**产出成果**\\n这里写内容...\\n\\n**目前进展**\\n这里写内容...",
  "todos": ["待办事项1", "待办事项2"]
}
绝对不要输出除 JSON 之外的任何内容。如果看板为空，请生成一个默认的空总结。`;

      const response = await fetch('/api/chat/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { id: 'system', role: 'system', content: systemPrompt, timestamp: Date.now() },
            { id: 'user', role: 'user', content: `当前看板内容如下：\n\n${cardsContext}`, timestamp: Date.now() }
          ],
          model: 'deepseek-chat',
          stream: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate summary');
      
      const data = await response.json();
      const content = data.message?.content || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setWrapUpData({
            summary: parsed.summary || '',
            todos: parsed.todos || []
          });
        }
      } catch (e) {
        console.error('Failed to parse wrap up JSON', e);
      }
    } catch (e) {
      console.error('Wrap up failed', e);
    } finally {
      setIsWrapUpLoading(false);
    }
  };

  const handleArchive = () => {
    if (contextMenu?.cardId) {
      // Just delete for now, or update status to 'archived'
      handleDeleteCard(contextMenu.cardId);
    }
    setContextMenu(null);
  };

  const handleDeleteClick = () => {
    if (contextMenu?.cardId) {
      setDeleteConfirmCardId(contextMenu.cardId);
    }
    setContextMenu(null);
  };

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  const handleConfirmSync = async (folderToken: string) => {
    setSyncModalOpen(false);
    if (!syncTarget) return;

    if (syncTarget.type === 'card' && syncTarget.cardId) {
      const card = boardStore.getAllCards().find(c => c.id === syncTarget.cardId);
      if (card) {
        try {
          boardStore.updateCard(card.id, { status: 'syncing' });
          const response = await fetch('/api/feishu/sync-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: card.title,
              content: card.content,
              category: card.category,
              folderToken
            })
          });
          
          const data = await response.json();
          if (data.success) {
            boardStore.updateCard(card.id, { 
              status: 'synced',
              metadata: {
                ...card.metadata,
                feishuDocUrl: data.url
              }
            });
            toast.success('同步成功！已将卡片同步至飞书');
          } else {
            const errorMsg = data.details || data.error || '未知错误';
            boardStore.updateCard(card.id, { 
              status: 'sync_failed',
              metadata: { ...card.metadata, syncError: errorMsg }
            });
            toast.error(`同步失败: ${errorMsg}`);
          }
        } catch (err: any) {
          const errorMsg = err.message || '网络或服务器错误';
          boardStore.updateCard(card.id, { 
            status: 'sync_failed',
            metadata: { ...card.metadata, syncError: errorMsg }
          });
          toast.error(`同步请求失败: ${errorMsg}`);
        }
      }
    } else if (syncTarget.type === 'creation' && syncTarget.formData) {
      try {
        toast.info('正在同步至飞书...');
        const response = await fetch('/api/feishu/sync-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: syncTarget.formData.title,
            content: JSON.stringify(syncTarget.formData, null, 2),
            category: syncTarget.category,
            folderToken
          })
        });
        const data = await response.json();
        if (data.success) {
          toast.success('同步成功！已将内容同步至飞书');
        } else {
          toast.error(`同步失败: ${data.error || '未知错误'}`);
        }
      } catch (err) {
        toast.error('同步请求失败，请检查网络或控制台日志。');
      }
      setCreationModalType(null);
    }
  };

  if (isExpanded) {
    return (
      <div 
        className="h-full overflow-y-auto relative"
        onContextMenu={(e) => handleContextMenu(e)}
      >
        <ExpandedBoard 
          cards={sections.flatMap(s => s.cards)}
          onCardUpdate={handleUpdateCard}
          onCardDelete={handleDeleteCard}
          onCardChat={handleChatCard}
          onCardClick={(card) => setSelectedCardId(card.id)}
        />

        {/* Reusing existing Modals */}
        {selectedCard && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedCardId(null)}
            />
            <div className="relative w-full max-w-[340px] max-h-[70vh] animate-scale-in flex flex-col">
              <div className="absolute -top-14 right-0 z-50">
                <button
                  onClick={() => setSelectedCardId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors backdrop-blur-md shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="w-full max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-[16px] drop-shadow-2xl flex flex-col bg-transparent [&>div]:!m-0 [&>div]:!shadow-none">
                <FlowdCard 
                  card={selectedCard}
                  isModal={true}
                  onUpdate={handleUpdateCard}
                  onDelete={(id) => { handleDeleteCard(id); setSelectedCardId(null); }}
                  onChat={(card) => { handleChatCard(card); setSelectedCardId(null); }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div 
            className="fixed z-[100] w-48 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 py-2 overflow-hidden animate-fade-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Same Context Menu Items as regular view */}
            <button onClick={handleCreateTodo} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              创建待办
            </button>
            <button onClick={handleCreateMeeting} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              创建会议记录
            </button>
            <button onClick={handleCreatePRD} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              创建PRD文档
            </button>
            <button onClick={handleCreateBug} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              创建Bug记录
            </button>
            <button onClick={handleCreateBookmark} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              创建链接收藏
            </button>
            <button onClick={handleCreateAboutFlowd} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              关于Flowd
            </button>
            <button onClick={handleWrapUpProject} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              收拢并总结项目
            </button>
            <button onClick={() => { onToggleFullScreen?.(); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              全屏聚焦模式
            </button>
            
            <div className="h-px bg-gray-200/50 my-1"></div>
            
            <button 
              onClick={() => {
                if (contextMenu.cardId) {
                  setSyncTarget({ type: 'card', cardId: contextMenu.cardId });
                  setSyncModalOpen(true);
                }
                setContextMenu(null);
              }}
              disabled={!contextMenu.cardId}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              同步至飞书
            </button>

            <button 
              onClick={handleArchive} 
              disabled={!contextMenu.cardId}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              归档
            </button>
            <button 
              onClick={handleDeleteClick}
              disabled={!contextMenu.cardId}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              删除
            </button>
          </div>
        )}
        
        {/* Delete Confirmation Modal */}
        {deleteConfirmCardId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">删除卡片</h3>
              <p className="text-sm text-gray-500 mb-6">这张卡片删除后会永久移除在看板中。</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirmCardId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    handleDeleteCard(deleteConfirmCardId);
                    setDeleteConfirmCardId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
      {deleteConfirmCardId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-500 text-sm mb-6">你确定要删除这张卡片吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmCardId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  handleDeleteCard(deleteConfirmCardId);
                  setDeleteConfirmCardId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {creationModalType && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">{creationFormData.title}</h3>
              <button onClick={() => setCreationModalType(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {creationModalType === 'meeting' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参与者</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 张三, 李四"
                      value={creationFormData.participants}
                      onChange={e => setCreationFormData({...creationFormData, participants: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">议程</label>
                    <textarea 
                      placeholder="会议议程..."
                      value={creationFormData.agenda}
                      onChange={e => setCreationFormData({...creationFormData, agenda: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">纪要</label>
                    <textarea 
                      placeholder="会议纪要..."
                      value={creationFormData.minutes}
                      onChange={e => setCreationFormData({...creationFormData, minutes: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                </>
              )}
              
              {creationModalType === 'prd' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景</label>
                    <textarea 
                      placeholder="需求背景..."
                      value={creationFormData.background}
                      onChange={e => setCreationFormData({...creationFormData, background: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目标</label>
                    <textarea 
                      placeholder="业务目标..."
                      value={creationFormData.objectives}
                      onChange={e => setCreationFormData({...creationFormData, objectives: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">飞书文档链接</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={creationFormData.prdLink}
                      onChange={e => setCreationFormData({...creationFormData, prdLink: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {creationModalType === 'bug' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
                    <select
                      value={creationFormData.severity}
                      onChange={e => setCreationFormData({...creationFormData, severity: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="critical">致命</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">复现步骤</label>
                    <textarea 
                      placeholder="1. ...&#10;2. ..."
                      value={creationFormData.stepsToReproduce}
                      onChange={e => setCreationFormData({...creationFormData, stepsToReproduce: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 张三"
                      value={creationFormData.assignee}
                      onChange={e => setCreationFormData({...creationFormData, assignee: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {creationModalType === 'bookmark' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">链接 URL</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={creationFormData.url}
                      onChange={e => setCreationFormData({...creationFormData, url: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">摘要说明</label>
                    <textarea 
                      placeholder="这个链接是关于..."
                      value={creationFormData.summary}
                      onChange={e => setCreationFormData({...creationFormData, summary: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-100">
              <button 
                onClick={() => {
                  setSyncTarget({
                    type: 'creation',
                    formData: creationFormData,
                    category: creationModalType
                  });
                  setSyncModalOpen(true);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> 同步至飞书
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setCreationModalType(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    const metadata: any = { aiGenerated: false };
                    if (creationModalType === 'meeting') {
                      metadata.participants = creationFormData.participants.split(',').map((p: string) => p.trim()).filter(Boolean);
                      metadata.agenda = creationFormData.agenda;
                      metadata.minutes = creationFormData.minutes;
                      metadata.actionItems = [];
                    } else if (creationModalType === 'prd') {
                      metadata.background = creationFormData.background;
                      metadata.objectives = creationFormData.objectives;
                      metadata.acceptanceCriteria = creationFormData.acceptanceCriteria;
                      metadata.prdLink = creationFormData.prdLink;
                    } else if (creationModalType === 'bug') {
                      metadata.severity = creationFormData.severity;
                      metadata.stepsToReproduce = creationFormData.stepsToReproduce;
                      metadata.assignee = creationFormData.assignee;
                    } else if (creationModalType === 'bookmark') {
                      metadata.url = creationFormData.url;
                      metadata.summary = creationFormData.summary;
                    }

                    boardStore.addCard(creationModalType as ContentCategory, {
                      title: creationFormData.title,
                      content: '已创建',
                      metadata
                    }, 'office_efficiency');
                    
                    setCreationModalType(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal */}
        {isTodoModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#134e4a] rounded-3xl shadow-2xl w-full max-w-md p-6 text-white animate-scale-in">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-white">新建待办</h3>
                <button onClick={() => setIsTodoModalOpen(false)} className="text-white/60 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <input 
                    type="text" 
                    placeholder="待办事项标题..." 
                    value={todoTitle}
                    onChange={(e) => setTodoTitle(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                  />
                </div>
                
                <div className="space-y-2">
                  {todoItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded flex-shrink-0 border-2 border-white/30"></div>
                      <input 
                        type="text"
                        placeholder={`事项 ${index + 1}...`}
                        value={item}
                        onChange={(e) => {
                          const newItems = [...todoItems];
                          newItems[index] = e.target.value;
                          setTodoItems(newItems);
                        }}
                        className="flex-1 bg-transparent border-b border-white/10 px-2 py-1 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                      />
                      {todoItems.length > 1 && (
                        <button onClick={() => setTodoItems(todoItems.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => setTodoItems([...todoItems, ''])}
                  className="text-sm text-white/60 hover:text-white flex items-center gap-1 mt-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  添加事项
                </button>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <button 
                  onClick={() => setIsTodoModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (todoTitle.trim()) {
                      const validItems = todoItems.filter(i => i.trim() !== '');
                      boardStore.addCard('todo', {
                        title: todoTitle,
                        content: '用户创建的待办事项',
                        metadata: {
                          aiGenerated: false,
                          tags: ['待办'],
                          items: validItems,
                          checkedItems: new Array(validItems.length).fill(false)
                        }
                      });
                      setIsTodoModalOpen(false);
                    }
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-[#134e4a] bg-white hover:bg-white/90 rounded-xl transition-colors shadow-lg"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}

        <FeishuFolderSelectModal 
          isOpen={syncModalOpen}
          onClose={() => setSyncModalOpen(false)}
          onConfirm={handleConfirmSync}
        />
      </div>
    );
  }

  return (
    <div 
      className="h-full overflow-y-auto p-6 space-y-6 relative bg-[#C1C9CC]"
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* Logo and New Project Button */}
      <div className="mb-10 flex flex-col items-start gap-5">
        <h1 className="text-[56px] font-medium text-[#9EA8B0] leading-none tracking-tight">Flowd</h1>
        <div className="flex items-center gap-3">
          <div className="relative group ml-1">
            <button
              onClick={onNewProject}
              className="w-11 h-11 rounded-full bg-[#EAECEE] shadow-sm flex items-center justify-center hover:bg-[#DFE2E4] transition-colors"
            >
              <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
              </svg>
            </button>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none transform group-hover:translate-x-1">
              <div className="bg-[#2a3036] text-white/90 text-[14px] px-5 py-2 rounded-full shadow-lg whitespace-nowrap flex items-center justify-center border border-white/10 font-medium">
                添加新项目
              </div>
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-[#2a3036]"></div>
            </div>
          </div>
          
          {isFeishuSynced && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-full text-xs font-medium text-blue-600 ml-2 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              {feishuTableName || '已同步飞书多维表格'}
            </div>
          )}
        </div>
      </div>

      {/* About Section Standalone Cards */}
      {sections.flatMap(s => s.cards).filter(card => card.metadata?.isAboutFlowd).map((card) => (
        <div key={card.id} className="animate-slide-in mb-6">
          <div className="grid grid-cols-2 gap-3">
            <DraggableCard
              card={card}
              onUpdate={handleUpdateCard}
              onDelete={handleDeleteCard}
              onChat={handleChatCard}
              onClick={(card) => setSelectedCardId(card.id)}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>
      ))}

      {/* Sections */}
      {mounted && sections.filter(s => s.id !== 'about').map((section) => {
        const displayCards = section.cards.filter(card => !card.metadata?.isAboutFlowd);
        
        if (displayCards.length === 0) {
          return null; // Do not render section if it has no cards
        }
        
        return (
          <div key={section.id} className="animate-slide-in bg-[#D5DCDE] rounded-3xl p-5 shadow-sm border border-white/30">
            {/* Section Header */}
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                {section.title === 'Onboarding State' ? '引导状态' : 
                 section.title === 'Workspace Model' ? '工作区模型' : section.title}
              </h2>
              {section.subtitle && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {section.subtitle === 'User onboarding experience decisions' ? '用户引导体验决策' :
                   section.subtitle === 'Core workspace structure and layout' ? '核心工作区结构与布局' : section.subtitle}
                </p>
              )}
            </div>

            {/* Cards */}
            <div>
              {displayCards.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs border-2 border-dashed border-gray-200 rounded-xl">
                  <p>暂无卡片</p>
                  <p className="mt-1">在右侧输入想法，AI 会自动归类</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {displayCards.map((card) => (
                    <DraggableCard
                      key={card.id}
                      card={card}
                      onUpdate={handleUpdateCard}
                      onDelete={handleDeleteCard}
                      onChat={handleChatCard}
                      onClick={(card) => setSelectedCardId(card.id)}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty State Hint */}
      {mounted && sections.every(s => s.cards.length === 0) && (
        <div className="mt-12 p-6 bg-white/50 rounded-xl border border-white/60">
          <p className="text-sm text-gray-500 leading-relaxed">
            开始输入你的想法，AI 助手会自动识别并归类到对应板块。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] px-2 py-1 bg-gray-800 text-white rounded">已决策</span>
            <span className="text-[10px] px-2 py-1 bg-white border border-gray-200 text-gray-600 rounded">笔记</span>
            <span className="text-[10px] px-2 py-1 bg-teal-800 text-white rounded">待办</span>
            <span className="text-[10px] px-2 py-1 bg-yellow-100 text-yellow-700 rounded">待解决问题</span>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCardId(null)}
          />
          <div className="relative w-full max-w-[340px] max-h-[70vh] animate-scale-in flex flex-col">
            <div className="absolute -top-14 right-0 z-50">
              <button
                onClick={() => setSelectedCardId(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors backdrop-blur-md shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="w-full max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-[16px] drop-shadow-2xl flex flex-col bg-transparent [&>div]:!m-0 [&>div]:!shadow-none">
              <FlowdCard 
                card={selectedCard}
                isModal={true}
                onUpdate={handleUpdateCard}
                onDelete={(id) => { handleDeleteCard(id); setSelectedCardId(null); }}
                onChat={(card) => { handleChatCard(card); setSelectedCardId(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] w-48 bg-white/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 py-2 overflow-hidden animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleCreateTodo} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            创建待办
          </button>
          <button onClick={handleCreateMeeting} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            创建会议记录
          </button>
          <button onClick={handleCreatePRD} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            创建PRD文档
          </button>
          <button onClick={handleCreateBug} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            创建Bug记录
          </button>
          <button onClick={handleCreateBookmark} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            创建链接收藏
          </button>
          <button onClick={handleCreateAboutFlowd} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            关于Flowd
          </button>
          <button onClick={handleWrapUpProject} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            收拢并总结项目
          </button>
          <button onClick={() => { onToggleFullScreen?.(); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            全屏聚焦模式
          </button>
          
          <div className="h-px bg-gray-200/50 my-1"></div>
          
          <button 
              onClick={() => {
                if (contextMenu.cardId) {
                  setSyncTarget({ type: 'card', cardId: contextMenu.cardId });
                  setSyncModalOpen(true);
                }
                setContextMenu(null);
              }}
              disabled={!contextMenu.cardId}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              同步至飞书
            </button>

          <button 
            onClick={handleArchive} 
            disabled={!contextMenu.cardId}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            归档
          </button>
          <button 
            onClick={handleDeleteClick}
            disabled={!contextMenu.cardId}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            删除
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCardId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">删除卡片</h3>
            <p className="text-sm text-gray-500 mb-6">这张卡片删除后会永久移除在看板中。</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteConfirmCardId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  handleDeleteCard(deleteConfirmCardId);
                  setDeleteConfirmCardId(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todo Modal */}
      {isTodoModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#134e4a] rounded-3xl shadow-2xl w-full max-w-md p-6 text-white animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">新建待办</h3>
              <button onClick={() => setIsTodoModalOpen(false)} className="text-white/60 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <input 
                  type="text" 
                  placeholder="待办事项标题..." 
                  value={todoTitle}
                  onChange={(e) => setTodoTitle(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                />
              </div>
              
              <div className="space-y-2">
                {todoItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded flex-shrink-0 border-2 border-white/30"></div>
                    <input 
                      type="text"
                      placeholder={`事项 ${index + 1}...`}
                      value={item}
                      onChange={(e) => {
                        const newItems = [...todoItems];
                        newItems[index] = e.target.value;
                        setTodoItems(newItems);
                      }}
                      className="flex-1 bg-transparent border-b border-white/10 px-2 py-1 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    {todoItems.length > 1 && (
                      <button onClick={() => setTodoItems(todoItems.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <button 
                onClick={() => setTodoItems([...todoItems, ''])}
                className="text-sm text-white/60 hover:text-white flex items-center gap-1 mt-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                添加事项
              </button>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setIsTodoModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (todoTitle.trim()) {
                    const validItems = todoItems.filter(i => i.trim() !== '');
                    boardStore.addCard('todo', {
                      title: todoTitle,
                      content: '用户创建的待办事项',
                      metadata: {
                        aiGenerated: false,
                        tags: ['待办'],
                        items: validItems,
                        checkedItems: new Array(validItems.length).fill(false)
                      }
                    });
                    setIsTodoModalOpen(false);
                  }
                }}
                className="px-5 py-2.5 text-sm font-medium text-[#134e4a] bg-white hover:bg-white/90 rounded-xl transition-colors shadow-lg"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wrap-up Modal */}
      {isWrapUpModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#f0efea] rounded-2xl shadow-2xl w-full max-w-[640px] p-10 animate-scale-in max-h-[90vh] flex flex-col relative border border-white/50">
            
            <button 
              onClick={() => setIsWrapUpModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-[28px] font-bold text-[#8c8e8c] mb-8 tracking-tight">项目总结：<span className="text-[#111]">{projectName}</span></h3>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6">
              {isWrapUpLoading ? (
                <div className="space-y-4">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[15px] text-[#333] leading-relaxed py-4 pr-4 whitespace-pre-wrap font-[400] tracking-wide space-y-6">
                  <div dangerouslySetInnerHTML={{ 
                    __html: wrapUpData.summary
                      .replace(/\*\*(.*?)\*\*/g, '<h3 class="text-[20px] font-bold text-[#111] mb-2 mt-6 tracking-tight">$1</h3>')
                      || '暂无总结内容。' 
                  }} />
                </div>
              )}
              
              <div className="mt-8 pt-6 border-t border-gray-300/50">
                {isWrapUpLoading ? (
                  <div className="bg-white rounded-xl p-6 text-gray-800 animate-pulse border border-gray-200">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-6 text-gray-800 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">遗留待办事项</span>
                    </div>
                    
                    {wrapUpData.todos.length > 0 && (
                      <div className="space-y-3 mb-6">
                        {wrapUpData.todos.map((todo, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <input 
                              type="checkbox" 
                              className="mt-1 w-4 h-4 rounded-sm border-gray-300 text-gray-600 focus:ring-gray-500" 
                            />
                            <span className="text-[14px] text-gray-600 leading-relaxed">{todo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {wrapUpData.todos.length === 0 && (
                      <p className="text-[14px] text-gray-500 italic mb-6">没有发现遗留事项。</p>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative flex items-center justify-center mt-0.5">
                          <input type="checkbox" className="peer sr-only" defaultChecked />
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-sm bg-white peer-checked:bg-[#1D1D1D] peer-checked:border-[#1D1D1D] transition-colors"></div>
                          <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-[14px] text-gray-500">我了解这些事项将在归档文档中作为未解决项保留。</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsWrapUpModalOpen(false)}
                className="px-6 py-2.5 rounded-full text-sm font-semibold text-gray-500 hover:bg-gray-200 transition-colors bg-white border border-gray-200 uppercase tracking-wider"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (wrapUpData.summary) {
                    const added = boardStore.addCard('note', {
                      title: '项目总结报告',
                      content: wrapUpData.summary,
                      metadata: { tags: ['总结', '归档'] }
                    });
                    
                    if (wrapUpData.todos.length > 0) {
                      boardStore.addCard('todo', {
                        title: '遗留待办事项',
                        content: '项目归档时遗留的待处理事项',
                        metadata: { 
                          tags: ['遗留任务'],
                          items: wrapUpData.todos,
                          checkedItems: new Array(wrapUpData.todos.length).fill(false)
                        }
                      });
                    }
                    
                    if (added) {
                      setIsWrapUpModalOpen(false);
                    }
                  }
                }}
                className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-colors hover:bg-black/80 shadow-sm uppercase tracking-wider"
                style={{ backgroundColor: '#1D1D1D' }}
                disabled={isWrapUpLoading}
              >
                确认归档
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Creation Modal */}
      {creationModalType && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">{creationFormData.title}</h3>
              <button onClick={() => setCreationModalType(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {creationModalType === 'meeting' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参与者</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 张三, 李四"
                      value={creationFormData.participants}
                      onChange={e => setCreationFormData({...creationFormData, participants: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">议程</label>
                    <textarea 
                      placeholder="会议议程..."
                      value={creationFormData.agenda}
                      onChange={e => setCreationFormData({...creationFormData, agenda: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">纪要</label>
                    <textarea 
                      placeholder="会议纪要..."
                      value={creationFormData.minutes}
                      onChange={e => setCreationFormData({...creationFormData, minutes: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                </>
              )}
              
              {creationModalType === 'prd' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景</label>
                    <textarea 
                      placeholder="需求背景..."
                      value={creationFormData.background}
                      onChange={e => setCreationFormData({...creationFormData, background: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目标</label>
                    <textarea 
                      placeholder="业务目标..."
                      value={creationFormData.objectives}
                      onChange={e => setCreationFormData({...creationFormData, objectives: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-20 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">飞书文档链接</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={creationFormData.prdLink}
                      onChange={e => setCreationFormData({...creationFormData, prdLink: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {creationModalType === 'bug' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">严重程度</label>
                    <select
                      value={creationFormData.severity}
                      onChange={e => setCreationFormData({...creationFormData, severity: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="critical">致命</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">复现步骤</label>
                    <textarea 
                      placeholder="1. ...&#10;2. ..."
                      value={creationFormData.stepsToReproduce}
                      onChange={e => setCreationFormData({...creationFormData, stepsToReproduce: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 张三"
                      value={creationFormData.assignee}
                      onChange={e => setCreationFormData({...creationFormData, assignee: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {creationModalType === 'bookmark' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">链接 URL</label>
                    <input 
                      type="text" 
                      placeholder="https://..."
                      value={creationFormData.url}
                      onChange={e => setCreationFormData({...creationFormData, url: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">摘要说明</label>
                    <textarea 
                      placeholder="这个链接是关于..."
                      value={creationFormData.summary}
                      onChange={e => setCreationFormData({...creationFormData, summary: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-100">
              <button 
                onClick={() => {
                  setSyncTarget({
                    type: 'creation',
                    formData: creationFormData,
                    category: creationModalType
                  });
                  setSyncModalOpen(true);
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> 同步至飞书
              </button>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setCreationModalType(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    const metadata: any = { aiGenerated: false };
                    if (creationModalType === 'meeting') {
                      metadata.participants = creationFormData.participants.split(',').map((p: string) => p.trim()).filter(Boolean);
                      metadata.agenda = creationFormData.agenda;
                      metadata.minutes = creationFormData.minutes;
                      metadata.actionItems = [];
                    } else if (creationModalType === 'prd') {
                      metadata.background = creationFormData.background;
                      metadata.objectives = creationFormData.objectives;
                      metadata.acceptanceCriteria = creationFormData.acceptanceCriteria;
                      metadata.prdLink = creationFormData.prdLink;
                    } else if (creationModalType === 'bug') {
                      metadata.severity = creationFormData.severity;
                      metadata.stepsToReproduce = creationFormData.stepsToReproduce;
                      metadata.assignee = creationFormData.assignee;
                    } else if (creationModalType === 'bookmark') {
                      metadata.url = creationFormData.url;
                      metadata.summary = creationFormData.summary;
                    }

                    boardStore.addCard(creationModalType as ContentCategory, {
                      title: creationFormData.title,
                      content: '已创建',
                      metadata
                    }, 'office_efficiency');
                    
                    setCreationModalType(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-lg transition-colors shadow-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <FeishuFolderSelectModal 
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onConfirm={handleConfirmSync}
      />
    </div>
  );
}
