'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BoardSection, Card, ContentCategory } from '@/types/board';
import { boardStore } from '@/lib/board-store';
import { DraggableCard } from './DraggableCard';
import { FlowdCard } from './FlowdCard';
import { ExpandedBoard } from './ExpandedBoard';

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
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
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
  "summary": "包含以下六个段落的文本（使用换行符分隔，不要使用markdown加粗）：\\n项目如何开始：...\\n项目如何演变：...\\n探索过及放弃的内容：...\\n已决定的内容：...\\n产出成果：...\\n目前进展：...",
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
            <div className="relative w-full max-w-[340px] animate-scale-in flex flex-col">
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
              <div className="w-full max-h-[85vh] overflow-y-auto rounded-[28px] drop-shadow-2xl flex flex-col bg-transparent [&>div]:!m-0 [&>div]:!shadow-none">
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
              <span className="text-base w-4 text-center">👥</span>
              创建会议记录
            </button>
            <button onClick={handleCreatePRD} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <span className="text-base w-4 text-center">📋</span>
              创建PRD文档
            </button>
            <button onClick={handleCreateBug} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <span className="text-base w-4 text-center">🐛</span>
              创建Bug记录
            </button>
            <button onClick={handleCreateBookmark} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
              <span className="text-base w-4 text-center">🔗</span>
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
              <span className="text-base w-4 text-center">🖥️</span>
              全屏聚焦模式
            </button>
            
            <div className="h-px bg-gray-200/50 my-1"></div>
            
            <button 
              onClick={() => {
                if (contextMenu.cardId) {
                  const card = boardStore.getAllCards().find(c => c.id === contextMenu.cardId);
                  if (card) {
                    boardStore.updateCard(card.id, { status: 'synced' });
                    alert(`已将卡片同步至飞书项目专属目录。\n类型: ${card.category}\n标题: ${card.title}`);
                  }
                }
                setContextMenu(null);
              }}
              disabled={!contextMenu.cardId}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
            >
              <span className="w-4 text-center">🔄</span>
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
                  alert('已发起同步请求...');
                  // Simulate sync and close
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <span className="text-base">🔄</span> 同步至飞书
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
          <div className="columns-2 gap-3">
            <div className="break-inside-avoid">
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
        </div>
      ))}

      {/* Sections */}
      {sections.filter(s => s.id !== 'about').map((section) => {
        const displayCards = section.cards.filter(card => !card.metadata?.isAboutFlowd);
        
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
                <div className="columns-2 gap-3">
                  {displayCards.map((card) => (
                    <div key={card.id} className="break-inside-avoid">
                      <DraggableCard
                        card={card}
                        onUpdate={handleUpdateCard}
                        onDelete={handleDeleteCard}
                        onChat={handleChatCard}
                        onClick={(card) => setSelectedCardId(card.id)}
                        onContextMenu={handleContextMenu}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty State Hint */}
      {sections.every(s => s.cards.length === 0) && (
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
          <div className="relative w-full max-w-2xl max-h-[85vh] animate-scale-in flex flex-col">
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
            
            <div className="w-full max-h-[85vh] overflow-y-auto rounded-[28px] drop-shadow-2xl flex flex-col bg-transparent [&>div]:!m-0 [&>div]:!shadow-none">
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
            <span className="text-base w-4 text-center">👥</span>
            创建会议记录
          </button>
          <button onClick={handleCreatePRD} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <span className="text-base w-4 text-center">📋</span>
            创建PRD文档
          </button>
          <button onClick={handleCreateBug} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <span className="text-base w-4 text-center">🐛</span>
            创建Bug记录
          </button>
          <button onClick={handleCreateBookmark} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2">
            <span className="text-base w-4 text-center">🔗</span>
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
            <span className="text-base w-4 text-center">🖥️</span>
            全屏聚焦模式
          </button>
          
          <div className="h-px bg-gray-200/50 my-1"></div>
          
          <button 
            onClick={() => {
              if (contextMenu.cardId) {
                const card = boardStore.getAllCards().find(c => c.id === contextMenu.cardId);
                if (card) {
                  boardStore.updateCard(card.id, { status: 'synced' });
                  alert(`已将卡片同步至飞书项目专属目录。\n类型: ${card.category}\n标题: ${card.title}`);
                }
              }
              setContextMenu(null);
            }}
            disabled={!contextMenu.cardId}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${contextMenu.cardId ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <span className="w-4 text-center">🔄</span>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-scale-in max-h-[90vh] flex flex-col">
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{projectName} 工作流回顾...</h3>
            <p className="text-gray-500 mb-6">正在总结当前项目的核心内容</p>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
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
                <div className="text-sm text-gray-600 leading-relaxed border-l-2 border-[#1B1D1F] pl-4 bg-gray-50/50 py-3 rounded-r-lg whitespace-pre-wrap">
                  <p className="font-semibold text-gray-900 mb-2">项目总结报告</p>
                  {wrapUpData.summary || '暂无总结内容。'}
                </div>
              )}
              
              <div className="mt-8">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  待解决事项
                </h4>
                {isWrapUpLoading ? (
                  <div className="bg-[#1B1D1F] rounded-xl p-4 text-white animate-pulse">
                    <div className="h-4 bg-white/20 rounded w-1/4 mb-4"></div>
                    <div className="space-y-3">
                      <div className="h-4 bg-white/20 rounded w-3/4"></div>
                      <div className="h-4 bg-white/20 rounded w-1/2"></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#1B1D1F] rounded-xl p-4 text-white">
                    <div className="font-medium mb-3">遗留任务</div>
                    <div className="space-y-2">
                      {wrapUpData.todos.map((todo, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded border-2 border-white/30"></div>
                          <span>{todo}</span>
                        </div>
                      ))}
                      {wrapUpData.todos.length === 0 && (
                        <div className="text-white/50 text-sm">暂无遗留任务</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-3 cursor-pointer group mb-6">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" defaultChecked />
                  <div className="w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#1B1D1F] peer-checked:border-[#1B1D1F] transition-colors"></div>
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm text-gray-600 select-none">我了解这些项将在关闭的文档中作为未解决项携带。</span>
              </label>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsWrapUpModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    boardStore.addCard('note', {
                      title: '项目总结报告',
                      content: wrapUpData.summary,
                      metadata: {
                        aiGenerated: true,
                        tags: ['总结']
                      }
                    }, 'workspace');
                    
                    if (wrapUpData.todos.length > 0) {
                      boardStore.addCard('todo', {
                        title: '待解决事项',
                        content: '遗留任务',
                        metadata: {
                          aiGenerated: true,
                          tags: ['待办'],
                          items: wrapUpData.todos,
                          checkedItems: new Array(wrapUpData.todos.length).fill(false)
                        }
                      }, 'workspace');
                    }
                    setIsWrapUpModalOpen(false);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-white rounded-xl transition-colors shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: '#1B1D1F' }}
                  disabled={isWrapUpLoading}
                >
                  确认收尾
                </button>
              </div>
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
                  alert('已发起同步请求...');
                  // Simulate sync and close
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
              >
                <span className="text-base">🔄</span> 同步至飞书
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
    </div>
  );
}
