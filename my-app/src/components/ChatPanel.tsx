'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Message } from '@/types/chat';
import { AISuggestion, ContentCategory, Card } from '@/types/board';
import { boardStore } from '@/lib/board-store';
import { toast } from '@/lib/toast';
import { FLOWD_SYSTEM_PROMPT } from '@/lib/prompts';
import { DragContext, extractNewCardsFromResponse } from '@/lib/drag-context';
import { DropZone } from './DropZone';
import { CardDropAction } from './CardDropAction';
import { AISuggestionCards } from './AISuggestionCards';

interface ChatPanelProps {
  projectId?: string;
  projectName?: string;
  userId?: string;
  feishuConfig?: {
    bindType?: 'bitable' | 'doc';
    appToken?: string;
    tableId?: string;
    folderToken?: string;
    documentId?: string;
  };
  onCardsGenerated?: (count: number) => void;
  chatCard?: Card | null;
  onChatComplete?: () => void;
  onProjectRename?: (newName: string) => void;
  isPetVisible?: boolean;
  onSetPetVisible?: (visible: boolean) => void;
  onClose?: () => void;
  bindSuccessMessage?: { tableName: string; timestamp: number } | null;
  onClearBindSuccessMessage?: () => void;
}

const SMART_BUTTONS = [
  { id: 'refresh', label: '刷新总结' },
  { id: 'thoughts', label: '思考建议' },
  { id: 'prioritize', label: '优先级排序' },
  { id: 'sync_feishu', label: '同步飞书数据' },
  { id: 'summarize', label: '汇总' },
];

// Helper function to call chat API
async function* streamChat(messages: Message[], systemPrompt?: string): AsyncGenerator<string, void, unknown> {
  const response = await fetch('/api/chat/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: systemPrompt 
        ? [{ id: 'system', role: 'system', content: systemPrompt, timestamp: Date.now() }, ...messages]
        : messages,
      model: 'deepseek-chat',
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'Failed to get response');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'chunk' && parsed.content) {
            yield parsed.content;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

export function ChatPanel({ 
  projectId = 'default',
  projectName = 'Flowd',
  userId = '',
  feishuConfig,
  onCardsGenerated, 
  chatCard, 
  onChatComplete, 
  onProjectRename, 
  isPetVisible = false, 
  onSetPetVisible, 
  onClose,
  bindSuccessMessage,
  onClearBindSuccessMessage
}: ChatPanelProps) {
  const getChatStorageKey = () => userId ? `flowd_chat_${userId}_${projectId}` : `flowd_chat_${projectId}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(getChatStorageKey());
        if (stored) {
          let parsedMessages: Message[] = JSON.parse(stored);
          
          // Cleanup legacy permanent "已保存" messages generated before the fix
          // and ensure any existing notify messages are checked against the board state
          const allCards = boardStore.getAllCards();
          const activeSourceIds = new Set<string>();
          allCards.forEach(c => {
            if (c.sourceMessageId) {
              activeSourceIds.add(c.sourceMessageId);
            }
          });

          parsedMessages = parsedMessages.filter(msg => {
            if (msg.role === 'assistant' && (msg.content.startsWith('✅ 已保存至左侧看板') || msg.content.startsWith('✨ 已根据讨论生成'))) {
              // Legacy format: `msg_${Date.now()}_notify`, New format: `notify_${sourceMessageId}`
              if (msg.id.startsWith('notify_')) {
                const sourceId = msg.id.replace('notify_', '');
                return activeSourceIds.has(sourceId);
              } else {
                // If it's a legacy message without a clear link, just remove it to clean up the bug.
                // It won't hurt because the green checkmark below the AI message still shows if it's saved.
                return false; 
              }
            }
            return true;
          });

          return parsedMessages;
        }
      } catch (e) {
        console.error('Failed to load messages from localStorage', e);
      }
    }

    const stats = boardStore.getStats();
    return [
      {
        id: `msg_init`,
        role: 'assistant',
        content: `已加载上下文：${projectName} - ${stats.total} 张卡片，${stats.openQuestions} 个开放式问题。你可以询问有关此项目的任何问题，或分享你的想法。`,
        timestamp: Date.now(),
      }
    ];
  });

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(getChatStorageKey(), JSON.stringify(messages));
      } catch (e) {
        console.error('Failed to save messages to localStorage', e);
      }
    }
  }, [messages, projectId, userId]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [draggedItem, setDraggedItem] = useState<{ card: Card; type: 'card' } | null>(null);
  const [droppedCard, setDroppedCard] = useState<Card | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync savedMessageIds with boardStore
  useEffect(() => {
    const syncSavedMessages = () => {
      // Prevent syncing old project cards when ChatPanel mounts before boardStore updates
      if (boardStore.getCurrentProjectId() !== projectId) {
        return;
      }

      const allCards = boardStore.getAllCards();
      const ids = new Set<string>();
      
      // Keep track of card info for deletion notification
      const cardInfoMap = new Map<string, { title: string; categoryName: string }>();
      
      const categoryNames: Record<ContentCategory, string> = {
        'decided': '已决策',
        'todo': '待办',
        'open_question': '待解决问题',
        'note': '笔记',
        'meeting': '会议记录',
        'prd': 'PRD需求文档',
        'bug': '问题记录',
        'bookmark': '链接收藏'
      };

      allCards.forEach(c => {
        if (c.sourceMessageId) {
          ids.add(c.sourceMessageId);
          cardInfoMap.set(c.sourceMessageId, {
            title: c.title,
            categoryName: categoryNames[c.category] || '卡片'
          });
        }
      });
      
      setSavedMessageIds(prev => {
        // Find ids that were removed
        const removedIds = [...prev].filter(id => !ids.has(id));
        
        if (removedIds.length > 0) {
          // Remove their corresponding notify messages
          setMessages(msgs => {
            let nextMsgs = msgs.filter(m => !removedIds.some(id => m.id === `notify_${id}`));
            
            // Add temporary archive message for each removed card
              removedIds.forEach(id => {
                const tempMsgId = `temp_archive_${id}_${Date.now()}`;
                const cardInfo = cardInfoMap.get(id);
                const categoryName = cardInfo ? cardInfo.categoryName : '卡片';
                
                nextMsgs = [...nextMsgs, {
                  id: tempMsgId,
                  role: 'assistant',
                  content: `归档提示：${categoryName}已从左侧看板中归档`,
                  timestamp: Date.now(),
                  isTemporary: true
                }];
                
                // Remove the temporary message after 3 seconds
                setTimeout(() => {
                  setMessages(currentMsgs => currentMsgs.filter(m => m.id !== tempMsgId));
                }, 3000);
              });
            
            return nextMsgs;
          });
        }
        
        return ids;
      });
    };
    
    syncSavedMessages();
    const unsubscribe = boardStore.subscribe(syncSavedMessages);
    return () => { unsubscribe(); };
  }, []);

  // State for Pet Emotion
  const [petState, setPetState] = useState<'normal' | 'thinking' | 'smile' | 'happy' | 'see'>('normal');
  const [isPetProfileOpen, setIsPetProfileOpen] = useState(false);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过 5MB ❌');
      e.target.value = '';
      return;
    }
    
    setSelectedFile(file);
    e.target.value = '';
  };

  const getPetStatusText = (state: string) => {
    switch(state) {
      case 'thinking': return '脑暴中🤔';
      case 'smile': return '治愈中😊';
      case 'happy': return '蹦跶中🥳';
      case 'see': return '观察中👀';
      default: return '摸鱼中🐟';
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Update initial message when projectName changes
  useEffect(() => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === 'msg_init') {
        const stats = boardStore.getStats();
        return {
          ...msg,
          content: `已加载上下文：${projectName} - ${stats.total} 张卡片，${stats.openQuestions} 个开放式问题。你可以询问有关此项目的任何问题，或分享你的想法。`
        };
      }
      return msg;
    }));
  }, [projectName]);

  // Handle chatCard from open_question card
  useEffect(() => {
    if (chatCard) {
      // Add system message about the question
      const systemMessage: Message = {
        id: `msg_${Date.now()}_system`,
        role: 'assistant',
        content: `正在讨论问题：「${chatCard.title}」\n\n${chatCard.content}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, systemMessage]);
      
      // Auto start discussion
      handleDiscussQuestion(chatCard);
    }
  }, [chatCard]);

  // Handle bind success message
  useEffect(() => {
    if (bindSuccessMessage) {
      const msgId = `msg_${bindSuccessMessage.timestamp}_bind`;
      // Check if we already added it
      setMessages(prev => {
        if (prev.some(m => m.id === msgId)) return prev;
        return [...prev, {
          id: msgId,
          role: 'assistant',
          content: `目前已经接入${bindSuccessMessage.tableName}，数据已同步，接下来需要做什么？`,
          timestamp: Date.now(),
        }];
      });
      onClearBindSuccessMessage?.();
    }
  }, [bindSuccessMessage, onClearBindSuccessMessage]);

  // Discuss open question
  const handleDiscussQuestion = async (card: Card) => {
    setIsLoading(true);
    setPetState('thinking');
    
    // Check if the input might be an image/file viewing request (heuristic)
    if (input.toLowerCase().includes('图片') || input.toLowerCase().includes('文章') || input.toLowerCase().includes('看看')) {
      setPetState('see');
    }
    
    try {
      const systemPrompt = `你是 Flowd AI，一个嵌入在项目中的思考伙伴。

用户正在讨论一个待解决问题。你的任务是：
1. 深入理解问题的本质
2. 提供具体的解决方案或建议
3. 帮助用户形成明确的结论

当讨论有了明确答案时，请总结解决方案。`;

      const contextMessage: Message = {
        id: `msg_${Date.now()}_context`,
        role: 'user',
        content: `问题：${card.title}\n\n详细描述：${card.content}\n\n请帮我分析这个问题并提供解决方案。`,
        timestamp: Date.now(),
      };

      let fullContent = '';
      for await (const chunk of streamChat([contextMessage], systemPrompt)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const agentMessage: Message = {
        id: `msg_${Date.now()}_agent`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, agentMessage]);
      setStreamingContent('');

      // Update the card with answer
      boardStore.updateCard(card.id, { answer: fullContent });
      
      onChatComplete?.();
    } catch (error) {
      console.error('Discuss question error:', error);
    } finally {
      setIsLoading(false);
      setPetState('normal');
      // Briefly show happy or smile after finishing
      if (Math.random() > 0.5) {
        setPetState('happy');
      } else {
        setPetState('smile');
      }
      setTimeout(() => setPetState('normal'), 3000);
    }
  };

  // Save AI message to board as a card
  const handleSaveToBoard = useCallback((message: Message) => {
    if (message.role !== 'assistant') return;

    // Check if the message contains a JSON array of cards
    const cards = extractNewCardsFromResponse(message.content);
    if (cards && cards.length > 0) {
      cards.forEach(cardData => {
        boardStore.addCard(cardData.category, {
          title: cardData.title,
          content: cardData.content,
          sourceMessageId: message.id,
          metadata: {
            items: cardData.items,
            aiGenerated: true,
          },
        });
      });
      
      onCardsGenerated?.(cards.length);
      
      const notifyMessage: Message = {
        id: `notify_${message.id}`,
        role: 'assistant',
        content: `✅ 已保存至左侧看板 - 包含 ${cards.length} 张卡片`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, notifyMessage]);
      return;
    }

    // Determine card category based on content
    let category: ContentCategory = 'note';
    const content = message.content.toLowerCase();
    
    if (content.includes('决策') || content.includes('决定') || content.includes('已确定')) {
      category = 'decided';
    } else if (content.includes('待办') || content.includes('todo') || content.includes('任务')) {
      category = 'todo';
    } else if (content.includes('问题') || content.includes('疑问') || content.includes('?')) {
      category = 'open_question';
    }

    // Extract title from first line or first sentence
    let title = message.content.split('\n')[0].substring(0, 50);
    if (title.length === 50) title += '...';
    
    const newCard = boardStore.addCard(category, {
      title: title || 'AI 建议',
      content: message.content,
      sourceMessageId: message.id,
      metadata: {
        aiGenerated: true,
      },
    });

    if (newCard) {
      onCardsGenerated?.(1);
      
      // Add notification message
      const categoryNames: Record<ContentCategory, string> = {
        'decided': '已决策',
        'todo': '待办',
        'open_question': '待解决问题',
        'note': '笔记',
        'meeting': '会议记录',
        'prd': 'PRD需求文档',
        'bug': '问题记录',
        'bookmark': '链接收藏'
      };
      const notifyMessage: Message = {
        id: `notify_${message.id}`,
        role: 'assistant',
        content: `✅ 已保存至左侧看板 - ${categoryNames[category]}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, notifyMessage]);
    }
  }, [onCardsGenerated]);

  // Handle card drop from left panel
  const handleCardDrop = useCallback((card: Card) => {
    setDroppedCard(card);
  }, []);

  // Handle cancel drop - card goes back to left panel
  const handleCancelDrop = useCallback(() => {
    setDroppedCard(null);
    setDraggedItem(null);
  }, [setDraggedItem]);

  // Handle action selection from dropped card
  const handleCardAction = useCallback(async (action: string, question: string) => {
    if (!droppedCard) return;

    const card = droppedCard;
    setDroppedCard(null);
    setDraggedItem(null);

    // Add user message with the question
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: `关于「${card.title}」：${question}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Generate AI response using API
    setIsLoading(true);
    try {
      const systemPrompt = `你是 Flowd AI，一个嵌入在项目中的思考伙伴。\n\n你的工作是帮助用户深入讨论他们拖入的卡片内容。根据卡片类型采取不同的讨论方式：\n\n- 笔记 (NOTE): 延展讨论，深入探索想法，挖掘更多细节和可能性\n- 已决策 (DECIDED): 质疑讨论，审视前提假设，考虑其他选择，评估风险\n- 待解决问题 (OPEN QUESTION): 重提讨论，回顾现状，探索新思路，推动解决\n- 待办 (TODO): 深入讨论，细化执行步骤，识别依赖和障碍\n\n保持直接、具体、诚实的风格。短句，没有废话。`;
      
      const contextMessage: Message = {
        id: `msg_${Date.now()}_context`,
        role: 'user',
        content: `关于「${card.title}」：${question}\n\n原始内容：${card.content}`,
        timestamp: Date.now(),
      };

      // Stream the response
      let fullContent = '';
      for await (const chunk of streamChat([contextMessage], systemPrompt)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const agentMessage: Message = {
        id: `msg_${Date.now()}_agent`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, agentMessage]);
      setStreamingContent('');
    } catch (error) {
      console.error('Drag discussion error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [droppedCard, onCardsGenerated, setDraggedItem]);

  // Check if input is asking for tasks or progress
  const isAskingForTasks = (text: string): boolean => {
    const taskPatterns = [
      /待办清单|待办|待处理|待完成|待执行|待跟进|待安排|待着手|待启动|待开展|待落实|待办理|待解决|待做|待弄|待办事项|待处理事项|待办任务|待办工作|待处理事务|待跟进事项|待落实事项|待办条目|待处理记录|待审|待批|待核|待确认|待审核|待审批|待核对|待复核|待受理|待办结|待处置|待批复|待审议|待规划|待筹备|待准备|待筹划|待定|待议|待商榷|待讨论|待研究|未办|未处理|未完成|未执行|未着手|未尽事宜|遗留事项|未完事项|悬而未决|有待处理|有待完成|有待解决|待办列表|任务清单|待做清单|待处理列表|代办清单/i,
      /给我列一个(?:待办|代办)/i,
      /接下来要做什么/i,
      /还有什么是待解决的/i,
      /还需(?:要)?做什么/i,
      /目前项目.*进度/i,
      /当前.*进度/i,
      /下一步计划/i,
    ];
    return taskPatterns.some(pattern => pattern.test(text));
  };

  // Check if input is an idea/creative thought or decision
  const isIdeaOrDecision = (text: string): { isMatch: boolean; isDecision: boolean } => {
    const decisionPatterns = [
      /我决定/i,
      /决定做/i,
      /决定用/i,
      /最终我还是想做/i,
      /就这么定/i,
      /确认用/i,
      /确定用/i,
      /敲定/i,
    ];
    
    const ideaPatterns = [
      /我想做[一个种样件]/i,
      /帮我做[一个种样件]/i,
      /我要做[一个种样件]/i,
      /我打算[做搞弄]/i,
      /计划[做搞弄]/i,
      /准备[做搞弄]/i,
      /构思[一个种样件]/i,
      /设计[一个种样件]/i,
      /开发[一个种样件]/i,
      /创建[一个种样件]/i,
      /实现[一个种样件]/i,
      /做[一个种样件].*?(?:应用|产品|功能|系统|平台|工具)/i,
      /我想要/i,
      /要做/i,
      /想做/i,
      /我打算/i,
      /我计划/i,
      /我准备/i,
      /作为灵感/i,
      /灵感来源/i,
      /参考/i,
      /存入左侧/i,
      /存入看板/i,
      /保存到左侧/i,
      /记录下来/i,
      /记下来/i,
    ];

    if (decisionPatterns.some(pattern => pattern.test(text))) {
      return { isMatch: true, isDecision: true };
    }
    
    if (ideaPatterns.some(pattern => pattern.test(text))) {
      return { isMatch: true, isDecision: false };
    }

    return { isMatch: false, isDecision: false };
  };

  // Auto save user idea to board (Temporarily disabled per user request: "左边卡片看板中的卡片不能和右边agent对话聊天的卡片内容重复")
  const autoSaveIdeaToBoard = async (content: string, file: File | null): Promise<boolean> => {
    return false;
  };

  const handleSend = async () => {
    if (!input.trim() && !droppedCard && !selectedFile) return;

    const userInput = input.trim();
    
    // Check for Pet Slash Commands
    const command = userInput.toLowerCase();
    let isCommandHandled = false;
    let commandResponse = '';

    if (command === '/pet' || command === '/buddy') {
      onSetPetVisible?.(true);
      commandResponse = '🐶 召唤成功！Buddy 出来陪你了。';
      isCommandHandled = true;
    } else if (command === '/pet sleep' || command === '/buddy sleep') {
      onSetPetVisible?.(false);
      commandResponse = '💤 Buddy 乖乖回去睡觉了...';
      isCommandHandled = true;
    } else if (command === '/pet feed' || command === '/buddy feed') {
      if (!isPetVisible) onSetPetVisible?.(true);
      setPetState('smile');
      setTimeout(() => setPetState('normal'), 3000);
      commandResponse = '🍖 喂食成功！Buddy 看起来非常高兴！';
      isCommandHandled = true;
    } else if (command === '/pet hide' || command === '/buddy hide') {
      if (!isPetVisible) onSetPetVisible?.(true);
      setPetState('smile');
      commandResponse = '👻 Buddy 高兴地准备去藏起来了！你能找到它吗？';
      isCommandHandled = true;
      setTimeout(() => {
        onSetPetVisible?.(false);
        setPetState('normal');
      }, 2000);
    }

    if (isCommandHandled) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userInput,
        timestamp: Date.now()
      };
      const sysMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: commandResponse,
        timestamp: Date.now() + 1
      };
      setMessages(prev => [...prev, userMsg, sysMsg]);
      setInput('');
      setTimeout(scrollToBottom, 100);
      return;
    }

    setIsLoading(true);
    setPetState('thinking');
    
    // Heuristic for viewing files/images
    if (userInput.toLowerCase().includes('图片') || userInput.toLowerCase().includes('文章') || userInput.toLowerCase().includes('看看')) {
      setPetState('see');
    }

    // Auto rename project if it's the default name
    if (projectName === '新项目' && onProjectRename) {
      (async () => {
        try {
          const systemPrompt = '你是一个项目命名助手。请根据用户的输入，提取出一个极简的项目名称（不超过6个中文字符）。只返回名称本身，绝对不要包含任何标点符号、引号、前缀或解释。';
          const msg: Message[] = [{ id: 'tmp', role: 'user', content: userInput, timestamp: Date.now() }];
          let newName = '';
          for await (const chunk of streamChat(msg, systemPrompt)) {
            newName += chunk;
          }
          newName = newName.replace(/["'「」【】]/g, '').trim();
          if (newName) {
            onProjectRename(newName.substring(0, 10));
          }
        } catch (e) {
          console.error('Auto rename failed', e);
        }
      })();
    }

    // Auto save idea to board before sending
    const wasSaved = await autoSaveIdeaToBoard(userInput, selectedFile);

    let fileUrl = '';
    if (selectedFile) {
      fileUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve(URL.createObjectURL(selectedFile));
        reader.readAsDataURL(selectedFile);
      });
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      ...(selectedFile ? {
        attachment: {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
          url: fileUrl
        }
      } : {})
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null); // Clear selected file after sending
    setIsLoading(true);
    setStreamingContent('');

    // Add notification if idea was auto-saved
    if (wasSaved) {
      const notifyMessage: Message = {
        id: `msg_${Date.now()}_autosave`,
        role: 'assistant',
        content: `💡 已自动保存至左侧看板`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, notifyMessage]);
    }

    try {
      // 检查是否是检索意图
      const isSearchIntent = userInput.includes('调出') || userInput.includes('查找') || userInput.includes('检索') || userInput.includes('历史');
      if (isSearchIntent) {
        setPetState('thinking');
        const searchMsg: Message = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: `正在检索飞书归档数据...`,
          timestamp: Date.now() + 1
        };
        setMessages(prev => [...prev, searchMsg]);
        
        // 调用后端搜索接口获取真实数据
        try {
          const res = await fetch('/api/feishu/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: projectId, // 使用真实项目ID
                query: userInput,
                currentRound: 1, // Mock round
                isSemantic: true, // 开启轻量化 RAG 语义检索
                feishuConfig: feishuConfig || {
                appToken: 'F49FbA8Yha2eX6ssqYecx1tknEd', // Example fallback
                tableId: 'tblXXX'
              }
            })
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          const results = data.results || [];
          
          if (results.length === 0) {
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = {
                ...newMsgs[newMsgs.length - 1],
                content: `未找到符合条件的归档数据。`
              };
              return newMsgs;
            });
          } else {
            const formattedMsg = `为您找到以下历史归档内容：\n\n` + results.map((r: any) => 
              `- **[${r.category}] ${r.title}** (轮次: ${r.round || 1}) ${r.docLink ? `- [查看飞书文档](${r.docLink})` : ''}\n  摘要: ${r.summary}`
            ).join('\n\n') + `\n\n*已将检索结果同步至看板。*`;

            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1] = {
                ...newMsgs[newMsgs.length - 1],
                content: formattedMsg
              };
              return newMsgs;
            });
            
            // Sync to board
            import('@/lib/board-store').then(({ boardStore }) => {
              results.forEach((r: any) => {
                boardStore.addCard(r.category || 'note', {
                  title: r.title,
                  content: r.summary,
                  metadata: {
                    aiGenerated: true,
                    tags: r.tags || [],
                    isAboutFlowd: false,
                    ...(r.docLink ? { url: r.docLink, urlTitle: '飞书文档' } : {})
                  }
                });
              });
            });
          }
        } catch (e) {
          console.error(e);
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = {
              ...newMsgs[newMsgs.length - 1],
              content: `检索失败，请确保项目已绑定飞书且配置正确。`
            };
            return newMsgs;
          });
        }
        
        setIsLoading(false);
        setPetState('normal');
        setTimeout(scrollToBottom, 100);
        return;
      }

      const isTaskQuery = isAskingForTasks(userInput);
      
      // 1. 如果用户的问题比较长，或者主动提问，我们在发给 LLM 之前先查一下本地/飞书上下文 (RAG 注入)
      let injectedContext = '';
      if (!isTaskQuery && userInput.length > 5) {
        try {
          const res = await fetch('/api/feishu/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId, // 使用真实项目ID
              query: userInput,
              currentRound: 1,
              isSemantic: true,
              feishuConfig: feishuConfig || {
                appToken: 'F49FbA8Yha2eX6ssqYecx1tknEd',
                tableId: 'tblXXX'
              }
            })
          });
          const data = await res.json();
          if (data.success && data.results?.length > 0) {
            injectedContext = `\n\n[来自轻量化 RAG 的历史思考资产]:\n${data.results.map((r:any) => `- 轮次 ${r.round || 1} 的 ${r.category}: ${r.title}。内容摘要: ${r.summary}`).join('\n')}\n(提示: 你可以引用这些历史内容并标注“来自 Round X”以强化跨轮次记忆)`;
          }
        } catch (e) {
          console.error('RAG context injection failed', e);
        }
      }

      let systemPrompt = FLOWD_SYSTEM_PROMPT;
      
      if (injectedContext) {
        systemPrompt += injectedContext;
      }

      if (isTaskQuery) {
        systemPrompt = `你是 Flowd AI，一个嵌入在项目中的思考伙伴。
用户正在询问项目进度或下一步的待办事项。
请先用简短的自然语言回应用户的需求（比如梳理一下思路或总结进度），然后在回复的最后，必须使用 JSON 格式输出推荐的卡片（包含待办卡片、开放性问题等）。
【注意】：如果待办事项包含多个阶段或非常多，请不要一次性把所有任务全部塞进一张卡片。每次只生成“当前最近一个阶段”需要完成的事项，保持卡片轻量且聚焦。
请务必将 JSON 放在 \`\`\`json 和 \`\`\` 之间。JSON 格式如下：
\`\`\`json
[
  {
    "title": "当前阶段核心任务",
    "content": "根据进度，我们先专注完成以下第一步工作",
    "category": "todo",
    "tags": ["任务"],
    "items": ["完成基础框架搭建", "测试核心功能"]
  },
  {
    "title": "当前遗留问题",
    "content": "有哪些风险或问题需要马上确认？",
    "category": "open_question",
    "tags": ["风险"]
  }
]
\`\`\`
`;
      }
        
      const apiMessages: Message[] = [
        ...messages.filter(m => m.role !== 'system'),
        userMessage,
      ];

      let fullContent = '';
      for await (const chunk of streamChat(apiMessages, systemPrompt)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const agentMessage: Message = {
        id: `msg_${Date.now()}_agent`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, agentMessage]);
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: '抱歉，连接 AI 服务时出现问题。请检查 API 配置或稍后重试。',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setPetState('normal');
      if (Math.random() > 0.5) {
        setPetState('happy');
      } else {
        setPetState('smile');
      }
      setTimeout(() => setPetState('normal'), 3000);
    }
  };

  const handleSmartButton = async (buttonId: string) => {
    if (buttonId === 'sync_feishu') {
      if (!feishuConfig) {
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: '请先在左侧面板绑定飞书多维表格或云文档。',
          timestamp: Date.now()
        }]);
        setTimeout(scrollToBottom, 100);
        return;
      }
      
      setIsLoading(true);
      setPetState('thinking');
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_sync_start`,
        role: 'assistant',
        content: `开始同步绑定的飞书数据...`,
        timestamp: Date.now()
      }]);
      
      try {
        const res = await fetch('/api/feishu/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feishuConfig, direction: 'import' })
        });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.error);

        if (data.type === 'doc') {
          // Request LLM to parse the raw text
          const docText = data.content.substring(0, 3000); // limit context
          const prompt = `你是一个智能项目助手。下面是从飞书文档同步回来的最新内容，请你提取里面的关键信息，并且**直接**以JSON数组的格式输出，不要有任何多余的解释。JSON格式如下：
\`\`\`json
[
  {
    "title": "卡片标题",
    "content": "卡片详细描述",
    "category": "note",
    "tags": ["同步", "文档"]
  }
]
\`\`\`
可用的category包含: note(笔记), decided(决策), todo(待办), open_question(问题), prd(需求)。
这是最新文档内容：
${docText}
`;
          let fullContent = '';
          for await (const chunk of streamChat([{ id: 'tmp', role: 'user', content: prompt, timestamp: Date.now() }], FLOWD_SYSTEM_PROMPT)) {
            fullContent += chunk;
            setStreamingContent(fullContent);
          }

          const newCards = extractNewCardsFromResponse(fullContent);
          let createdCount = 0;
          if (newCards.length > 0) {
            newCards.forEach((cardData) => {
              const newCard = boardStore.addCard(cardData.category, {
                title: cardData.title,
                content: cardData.content,
                metadata: { tags: cardData.tags, aiGenerated: true },
              });
              if (newCard) createdCount++;
            });
          }
          
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              content: createdCount > 0 
                ? `✅ 已成功同步并从文档提取了 ${createdCount} 张卡片更新至看板。`
                : `✅ 已同步文档，但未提取到新的结构化卡片。`
            };
            return msgs;
          });
          if (createdCount > 0) onCardsGenerated?.(createdCount);
        } else if (data.type === 'bitable') {
          const cards = data.cards || [];
          let imported = 0;
          cards.forEach((card: any) => {
            const added = boardStore.addCard(card.category || 'note', {
              title: card.title,
              content: card.content,
              metadata: card.metadata,
            });
            if (added) imported++;
          });
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              content: `✅ 成功从飞书多维表格同步了 ${imported} 张卡片。`
            };
            return msgs;
          });
          if (imported > 0) onCardsGenerated?.(imported);
        }
      } catch (e) {
        console.error('Sync failed', e);
        setMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            content: `❌ 同步失败，请检查绑定配置或权限。`
          };
          return msgs;
        });
      } finally {
        setIsLoading(false);
        setStreamingContent('');
        setPetState('normal');
      }
      return;
    }

    setIsLoading(true);
    
    try {
      const cards = boardStore.getAllCards();
      const systemPrompt = `你是 Flowd AI，一个嵌入在项目中的思考伙伴。\n\n基于当前看板内容，生成智能建议。直接、具体、没有废话。`;
      
      const contextMessage: Message = {
        id: `msg_${Date.now()}_context`,
        role: 'user',
        content: `当前看板有 ${cards.length} 张卡片。请根据按钮「${SMART_BUTTONS.find(b => b.id === buttonId)?.label}」给出建议。`,
        timestamp: Date.now(),
      };

      let fullContent = '';
      for await (const chunk of streamChat([contextMessage], systemPrompt)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const agentMessage: Message = {
        id: `msg_${Date.now()}_agent`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMessage]);
      setStreamingContent('');
    } catch (error) {
      console.error('Smart button error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Ensure we don't send if it's just empty spaces (unless we have a dropped card or selected file)
      if (input.trim() || droppedCard || selectedFile) {
        handleSend();
      }
    }
  };

  // Drag and drop handlers for input area
  const [isDragOver, setIsDragOver] = useState(false);

  const handleInputDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleInputDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      // First check for files
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.size > 5 * 1024 * 1024) {
        toast.error('文件大小不能超过 5MB ❌');
        return;
      }
        setSelectedFile(file);
        return; // File handled, exit
      }

      // Then check for JSON data (cards)
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const { cardId } = JSON.parse(data);
        // Find card from board store
        const allCards = boardStore.getAllCards();
        const card = allCards.find(c => c.id === cardId);
        if (card) {
          handleCardDrop(card);
        }
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }, [handleCardDrop]);

  // Handle smart button click with dropped card context
  const handleSmartButtonWithCard = useCallback(async (buttonId: string) => {
    if (!droppedCard) {
      // No card dropped, use regular smart button
      handleSmartButton(buttonId);
      return;
    }

    const buttonLabel = SMART_BUTTONS.find(b => b.id === buttonId)?.label || '';
    
    // First, add user message with card tag and button label (the bubble style)
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: `${buttonLabel}`,
      timestamp: Date.now(),
      cardContext: {
        category: droppedCard.category,
        title: droppedCard.title,
      },
    };
    
    // Add message with card context for display
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      const systemPrompt = `你是 Flowd AI，一个嵌入在项目中的思考伙伴。

用户正在讨论一个卡片内容，并选择了「${buttonLabel}」操作。
请基于卡片内容提供相关的分析和建议。`;

      const contextMessage: Message = {
        id: `msg_${Date.now()}_context`,
        role: 'user',
        content: `关于「${droppedCard.title}」：${buttonLabel}

卡片内容：${droppedCard.content}`,
        timestamp: Date.now(),
      };

      let fullContent = '';
      for await (const chunk of streamChat([contextMessage], systemPrompt)) {
        fullContent += chunk;
        setStreamingContent(fullContent);
      }

      const agentMessage: Message = {
        id: `msg_${Date.now()}_agent`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, agentMessage]);
      setStreamingContent('');
      
      // Clear dropped card after discussion
      setDroppedCard(null);
    } catch (error) {
      console.error('Smart button with card error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [droppedCard, handleSmartButton]);

  return (
    <DragContext.Provider value={{ draggedItem, setDraggedItem }}>
      <div 
        className="h-full flex flex-col relative overflow-hidden bg-[#E6E9EB]"
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
      >
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-all duration-200 focus:outline-none"
            title="关闭聊天框"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Background with noise/texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.35] mix-blend-overlay" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}></div>

        {/* Drag overlay - shown when dragging over the entire panel */}
        {isDragOver && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none bg-blue-50/30 backdrop-blur-[1px]">
            <div className="bg-white rounded-2xl px-8 py-4 shadow-xl border-2 border-blue-400 border-dashed">
              <span className="text-blue-600 font-medium">释放以添加卡片到对话</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-1">开始对话</p>
              <p className="text-xs text-gray-400">分享你的想法，我会帮你整理</p>
              <p className="text-xs text-gray-400 mt-2">或将左侧卡片拖入下方输入区深入讨论</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-white shadow-sm'
                        : 'bg-transparent'
                    }`}
                  >
                    {/* Card context tag for user messages with dropped card */}
                    {message.role === 'user' && message.cardContext && (
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/50">
                        <div className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-2 py-0.5">
                          <span className="text-[9px] font-medium text-gray-500 uppercase tracking-wider">
                            {message.cardContext.category === 'decided' ? 'DECIDED' :
                             message.cardContext.category === 'todo' ? 'TODO' :
                             message.cardContext.category === 'open_question' ? 'OPEN QUESTION' :
                             message.cardContext.category === 'note' ? 'NOTE' : 'DOC'}
                          </span>
                          <span className="text-[10px] text-gray-700 truncate max-w-[150px]">{message.cardContext.title}</span>
                        </div>
                      </div>
                    )}
                    {message.role === 'assistant' ? (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        <div 
                          dangerouslySetInnerHTML={{
                            __html: message.content
                              .replace(/```json\n[\s\S]*?(?:\n```|$)/g, '') // remove json block safely
                              .replace(/\[\s*\{\s*"category"[\s\S]*?(?:\]|$)/g, '') // remove raw json array safely
                              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                              .replace(/→/g, '<span class="text-blue-500">→</span>')
                              .replace(/💡/g, '<span>💡</span>')
                          }}
                        />
                        {extractNewCardsFromResponse(message.content).length > 0 && (
                          <div className="mt-4 w-full">
                        <div className="mb-3 text-gray-500">已为你生成推荐卡片：</div>
                        <AISuggestionCards 
                          suggestions={extractNewCardsFromResponse(message.content).map((card, idx) => ({
                            id: `suggestion_${idx}`,
                            category: card.category,
                            title: card.title,
                            content: card.content,
                            items: card.items
                          }))}
                          onAddToBoard={() => {
                            // Trigger re-render to update 'added' status
                            setMessages([...messages]);
                            onCardsGenerated?.(1);
                          }}
                        />
                      </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        className="text-sm leading-relaxed whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/```json\n[\s\S]*?(?:\n```|$)/g, '') // remove json block safely
                            .replace(/\[\s*\{\s*"category"[\s\S]*?(?:\]|$)/g, '') // remove raw json array safely
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/→/g, '<span class="text-blue-500">→</span>')
                            .replace(/💡/g, '<span>💡</span>')
                        }}
                      />
                    )}
                    {message.attachment && (
                      <div className={`mt-3 flex items-center gap-3 p-3 rounded-xl border ${message.role === 'user' ? 'bg-white/10 border-white/20' : 'bg-gray-50 border-gray-200'}`}>
                        {message.attachment.type.startsWith('image/') ? (
                          <img src={message.attachment.url} alt={message.attachment.name} className="w-12 h-12 object-cover rounded-lg bg-gray-100" />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-lg text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-inherit">{message.attachment.name}</p>
                          <p className="text-xs opacity-70 mt-0.5">{(message.attachment.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                    )}

                    {message.role === 'user' && (
                      <div className="text-[10px] mt-2 text-right text-gray-400">
                        用户
                      </div>
                    )}
                    {/* Save to board button for AI messages */}
                    {message.role === 'assistant' && !savedMessageIds.has(message.id) && !message.content.startsWith('✅') && !message.content.startsWith('✨ 已根据讨论生成') && !message.isTemporary && extractNewCardsFromResponse(message.content).length === 0 && (
                      <button
                        onClick={() => handleSaveToBoard(message)}
                        className="mt-2 flex items-center gap-1.5 text-[14px] text-[#9EA8B0] font-medium px-4 py-1.5 rounded-full border-2 border-dashed border-[#9EA8B0] hover:bg-[#9EA8B0]/10 hover:text-[#7E898E] hover:border-[#7E898E] transition-all"
                      >
                        <span className="text-lg leading-none">+</span>
                        保存至左侧看板
                      </button>
                    )}
                    {message.role === 'assistant' && savedMessageIds.has(message.id) && !message.isTemporary && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-green-600">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        已保存
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && streamingContent && (
                <div className="flex justify-start animate-fade-in">
                  <div className="max-w-[90%] rounded-2xl px-4 py-3 bg-transparent">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      <div 
                        dangerouslySetInnerHTML={{
                          __html: streamingContent
                            .replace(/```json\n[\s\S]*?/g, '') // hide incomplete json blocks
                            .replace(/\[\s*\{\s*"category"[\s\S]*?/g, '') // hide incomplete json array
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/→/g, '<span class="text-blue-500">→</span>')
                            .replace(/💡/g, '<span>💡</span>')
                        }}
                      />
                      <span className="animate-pulse">▊</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Bottom Input Area with Drop Zone */}
        <div className="border-t border-gray-200/50 relative">
          {/* Smart Buttons & Upload Previews */}
          <div className="px-5 pt-3 pb-2 flex flex-col gap-2">
            {/* File Preview Area (Now sits above smart buttons) */}
            {(droppedCard || selectedFile) && (
              <div className="flex flex-wrap gap-2">
                {droppedCard && (
                  <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm border border-gray-200/50">
                    <span className="text-[10px] font-medium text-gray-500 uppercase">
                      {droppedCard.category === 'decided' ? 'DECIDED' :
                       droppedCard.category === 'todo' ? 'TODO' :
                       droppedCard.category === 'open_question' ? 'OPEN QUESTION' :
                       droppedCard.category === 'note' ? 'NOTE' : 'DOC'}
                    </span>
                    <span className="text-[14px] text-gray-700 truncate max-w-[150px]">{droppedCard.title}</span>
                    <button
                      onClick={handleCancelDrop}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {selectedFile && (
                  <div className="inline-flex items-center gap-2 bg-white rounded-full px-3 py-1.5 border border-gray-200 shadow-sm">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="text-[14px] font-medium text-gray-700 truncate max-w-[150px]">
                      {selectedFile.name}
                    </span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-gray-600 ml-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Smart Buttons */}
            <div className="flex flex-wrap gap-2">
              {SMART_BUTTONS.map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => handleSmartButtonWithCard(btn.id)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-[14px] font-medium bg-white/60 hover:bg-white text-gray-600 rounded-full border border-gray-200/50 transition-colors disabled:opacity-50"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area with Drag Drop */}
          <div 
            className="px-5 pb-5 relative"
          >
            {/* Virtual Pet - Positioned strictly above the text area border (gap of 8px) */}
            {isPetVisible && (
              <div className="absolute bottom-full mb-2 right-10 z-50 flex justify-center">
                <button 
                  onClick={() => setIsPetProfileOpen(true)}
                  className={`w-12 h-12 filter drop-shadow-sm transition-transform cursor-pointer hover:scale-110 ${isLoading ? 'animate-pet-bounce' : ''}`}
                >
                  <img 
                    src={`/${petState}.gif`} 
                    alt={`Pet state: ${petState}`} 
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </button>
              </div>
            )}

            <div className="relative w-full mt-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={droppedCard ? `关于「${droppedCard.title}」...` : "聊聊你的想法..."}
                className="w-full resize-none bg-white border border-gray-200/60 rounded-full px-[52px] py-[18px] text-[15px] focus:outline-none focus:border-gray-300 focus:bg-white transition-all min-h-[60px] max-h-[120px] leading-relaxed"
                rows={1}
                disabled={isLoading}
              />
              
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="absolute left-3 top-[31px] -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
              />

              {/* Send Button */}
                <button
                  onClick={isLoading ? () => {} : handleSend}
                  disabled={!input.trim() && !droppedCard && !selectedFile && !isLoading}
                  className={`absolute right-3 top-[31px] -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isLoading 
                      ? 'bg-[#1B1D1F] cursor-wait' 
                      : 'bg-[#1B1D1F] hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-sm'
                  }`}
                >
                  {isLoading ? (
                    <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  )}
                </button>
              </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              {droppedCard ? '输入你的想法，或点击上方快捷按钮' : '按 Enter 发送，Shift + Enter 换行'}
            </p>
          </div>
        </div>
      </div>

      {/* Pet Profile Modal */}
      {isPetProfileOpen && typeof window !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/20 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="bg-[#E6E9EB] p-8 flex justify-center relative">
              <button 
                onClick={() => setIsPetProfileOpen(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <img src={`/${petState}.gif`} alt="Buddy" className="w-24 h-24 object-contain" />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Buddy</h3>
                  <p className="text-sm text-gray-500">Flowd 专属电子宠物</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">当前状态</div>
                  <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {getPetStatusText(petState)}
                  </div>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">生日</span>
                  <span className="text-gray-900 font-medium">2026-04-06</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">爱好</span>
                  <span className="text-gray-900 font-medium">看你思考、吃数据零食</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">互动指令说明</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-3">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-800">/pet</code>
                    <span>召唤 Buddy 出来陪伴</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-800">/pet sleep</code>
                    <span>让 Buddy 回去休息</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-800">/pet feed</code>
                    <span>给它喂点吃的 🍖</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-800">/pet hide</code>
                    <span>和 Buddy 捉迷藏 👻</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DragContext.Provider>
  );
}
