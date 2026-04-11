'use client';

import { Card, CARD_TYPE_CONFIG, ContentCategory } from '@/types/board';
import { useState } from 'react';

interface FlowdCardProps {
  card: Card;
  onUpdate?: (id: string, updates: Partial<Card>) => void;
  onDelete?: (id: string) => void;
  onAddToBoard?: (suggestion: { title: string; content: string; category: ContentCategory; items?: string[] }) => void;
  onChat?: (card: Card) => void; // 点击 Chat 按钮，将卡片发送到右侧讨论
  onClick?: (card: Card) => void; // 点击卡片整体
  isModal?: boolean; // 是否在弹窗中渲染
}

const CATEGORY_LABELS: Record<string, string> = {
  'decided': '已决策',
  'note': '笔记',
  'todo': '待办',
  'open_question': '待讨论的问题',
};

export function FlowdCard({ card, onUpdate, onDelete, onAddToBoard, onChat, onClick, isModal }: FlowdCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const baseConfig = CARD_TYPE_CONFIG[card.category];
  const config = baseConfig;

  // Handle checkbox toggle for TODO items
  const handleCheckboxToggle = (index: number) => {
    if (!onUpdate) return;
    const newCheckedItems = [...(card.metadata?.checkedItems || [])];
    newCheckedItems[index] = !newCheckedItems[index];
    onUpdate(card.id, {
      metadata: {
        ...card.metadata,
        checkedItems: newCheckedItems,
      },
    });
  };

  if (card.metadata?.isAboutFlowd) {
    return (
      <div
        className={`p-6 mb-3 cursor-pointer transition-all duration-200 animate-fade-in relative flex flex-col bg-[#1D1D1D] text-white rounded-2xl ${!isModal ? 'max-h-[280px] overflow-hidden group hover:shadow-xl hover:bg-[#252525]' : 'h-full overflow-y-auto'}`}
        onClick={() => onClick ? onClick(card) : setIsExpanded(!isExpanded)}
      >
        <h4 className="font-semibold text-[22px] mb-4 leading-snug shrink-0 text-white tracking-wide">
          {card.title}
        </h4>
        <div className={`relative ${!isModal ? 'flex-1 overflow-hidden' : ''}`}>
          <div className={`text-[16px] leading-relaxed text-[#b3b3b3] space-y-4 ${!isModal ? 'line-clamp-4' : ''}`}>
            {card.content.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>
        {!isModal && (
          <div className="mt-4 pt-2 text-sm text-[#888888] flex items-center">
            点击查看详情 →
          </div>
        )}
      </div>
    );
  }

  // Render OPEN QUESTION card
  if (card.category === 'open_question') {
    return (
      <div 
        className={`card-question p-6 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[24px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: '#E3FF96' }}
      >
        {/* Large background question mark */}
        <div className="absolute right-[-10%] top-[-10%] text-[150px] font-bold opacity-10 pointer-events-none select-none leading-none" style={{ color: config.textColor }}>
          ?
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] tracking-widest uppercase" style={{ color: config.textColor, opacity: 0.6 }}>
            {CATEGORY_LABELS[card.category]}
          </span>
          {!isModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Title */}
        <h4 
          className={`font-medium text-[22px] leading-snug mb-4 ${!isModal ? 'line-clamp-6' : ''}`}
          style={{ color: config.textColor }}
        >
          {card.title}
        </h4>

        {/* Answer section (if exists) */}
        {card.answer && (
          <div className="mt-4 p-4 rounded-xl bg-white/50">
            <span className="text-[10px] tracking-widest uppercase block mb-2" style={{ color: config.textColor, opacity: 0.5 }}>
              ANSWER
            </span>
            <p className={`text-[16px] leading-relaxed italic ${!isModal ? 'line-clamp-4' : ''}`} style={{ color: config.textColor }}>
              {card.answer}
            </p>
          </div>
        )}

        {/* Chat button */}
        {!card.answer && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChat?.(card);
            }}
            className="mt-4 w-full py-3 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-all hover:bg-white/30"
            style={{ borderColor: `${config.textColor}40`, color: config.textColor }}
          >
            <span className="text-sm">Chat</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Render TODO card
  if (card.category === 'todo') {
    const items = card.metadata?.items || [];
    const checkedItems = card.metadata?.checkedItems || [];
    
    return (
      <div 
        className={`card-todo p-6 ${!isModal ? 'mb-3' : ''} cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[28px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: '#134e4a' }} // Using the specific dark teal color from the image
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[13px] font-mono tracking-[0.1em]" style={{ color: config.textColor, opacity: 0.7 }}>
            {new Date(card.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-mono tracking-[0.1em] lowercase" style={{ color: config.textColor, opacity: 0.7 }}>
              todo.txt
            </span>
            {!isModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(card.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded absolute top-4 right-4"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h4 
          className={`font-semibold text-[22px] mb-8 leading-snug tracking-tight shrink-0 ${!isModal ? 'line-clamp-3' : ''}`}
          style={{ color: config.textColor }}
        >
          {card.title}
        </h4>

        {/* Checkbox items */}
        {items.length > 0 && (
          <ul className={`space-y-5 mb-2 relative ${!isModal ? 'overflow-y-auto flex-1' : ''}`}>
            {items.map((item, idx) => (
              <li 
                key={idx} 
                className="flex items-start gap-4"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleCheckboxToggle(idx);
                  }}
                  className="mt-[2px] w-[24px] h-[24px] rounded-[6px] border-[2px] flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/10 z-10 relative cursor-pointer"
                  style={{ 
                    borderColor: checkedItems[idx] ? config.textColor : 'rgba(255,255,255,0.9)',
                    backgroundColor: 'transparent',
                  }}
                >
                  {checkedItems[idx] && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span 
                  className={`text-[16px] font-medium tracking-tight leading-snug transition-all ${checkedItems[idx] ? 'line-through decoration-2 decoration-white/40' : ''}`}
                  style={{ 
                    color: config.textColor,
                    opacity: checkedItems[idx] ? 0.4 : 1,
                  }}
                >
                  {item}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Content if no items (Removed per request, TODO cards should only show title and checkbox items) */}

        {/* Add to board button for AI suggestions */}
        {onAddToBoard && card.metadata?.aiGenerated && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToBoard({
                title: card.title,
                content: card.content,
                category: card.category,
                items: card.metadata?.items,
              });
            }}
            className="mt-6 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-colors hover:bg-white/10"
            style={{ color: config.textColor, borderColor: 'rgba(255,255,255,0.3)' }}
          >
            <span>+ Add to board</span>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Render DECIDED card
  if (card.category === 'decided') {
    return (
      <div 
        className={`card-decided p-5 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] tracking-wider" style={{ color: config.textColor, opacity: 0.5 }}>
            {new Date(card.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: config.textColor, opacity: 0.5 }}>
              decision.txt
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/20 rounded absolute top-3 right-3"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content (No separate title, just big text) */}
        <div 
          className={`text-[16px] leading-relaxed mb-6 font-medium relative ${!isModal ? 'flex-1 overflow-hidden' : ''}`}
          style={{ color: config.textColor }}
        >
          <div className={!isModal ? 'line-clamp-10' : ''}>{card.content}</div>
          {!isModal && (
            <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, #3d3d3d)` }} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5" style={{ color: config.textColor, opacity: 0.7 }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[10px] tracking-widest lowercase">
            decided
          </span>
        </div>
      </div>
    );
  }

  // Render MEETING card
  if (card.category === 'meeting') {
    return (
      <div 
        className={`card-meeting p-5 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[20px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: config.bgColor, borderColor: config.borderColor, borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/50" style={{ color: config.textColor }}>
              {config.label}
            </span>
          </div>
          {!isModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h4 className={`font-semibold text-[22px] mb-2 leading-snug shrink-0 ${!isModal ? 'line-clamp-2' : ''}`} style={{ color: config.textColor }}>
          {card.title}
        </h4>
        <div className={`space-y-2 text-[16px] ${!isModal ? 'overflow-hidden flex-1' : ''}`} style={{ color: config.textColor, opacity: 0.9 }}>
          {card.metadata?.participants && (
            <div><span className="font-semibold">参与者:</span> {card.metadata.participants.join(', ')}</div>
          )}
          {card.metadata?.agenda && (
            <div><span className="font-semibold">议程:</span> <span className="line-clamp-2">{card.metadata.agenda}</span></div>
          )}
          {card.metadata?.minutes && (
            <div><span className="font-semibold">纪要:</span> <span className="line-clamp-3">{card.metadata.minutes}</span></div>
          )}
          {card.metadata?.actionItems && (
            <div><span className="font-semibold">行动项:</span> {card.metadata.actionItems.length}项</div>
          )}
        </div>
      </div>
    );
  }

  // Render PRD card
  if (card.category === 'prd') {
    return (
      <div 
        className={`card-prd p-5 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[20px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: config.bgColor, borderColor: config.borderColor, borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/50" style={{ color: config.textColor }}>
              {config.label}
            </span>
          </div>
          {!isModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h4 className={`font-semibold text-[22px] mb-2 leading-snug shrink-0 ${!isModal ? 'line-clamp-2' : ''}`} style={{ color: config.textColor }}>
          {card.title}
        </h4>
        <div className={`space-y-2 text-[16px] ${!isModal ? 'overflow-hidden flex-1' : ''}`} style={{ color: config.textColor, opacity: 0.9 }}>
          {card.metadata?.background && (
            <div><span className="font-semibold">背景:</span> <span className="line-clamp-2">{card.metadata.background}</span></div>
          )}
          {card.metadata?.objectives && (
            <div><span className="font-semibold">目标:</span> <span className="line-clamp-2">{card.metadata.objectives}</span></div>
          )}
          {card.metadata?.prdLink && (
            <a href={card.metadata.prdLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              PRD 链接
            </a>
          )}
        </div>
      </div>
    );
  }

  // Render BUG card
  if (card.category === 'bug') {
    return (
      <div 
        className={`card-bug p-5 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[20px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: config.bgColor, borderColor: config.borderColor, borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/50" style={{ color: config.textColor }}>
              {config.label}
            </span>
            {card.metadata?.severity && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${card.metadata.severity === 'critical' ? 'bg-red-500 text-white' : card.metadata.severity === 'high' ? 'bg-orange-500 text-white' : card.metadata.severity === 'medium' ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}>
                {card.metadata.severity}
              </span>
            )}
          </div>
          {!isModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h4 className={`font-semibold text-[22px] mb-2 leading-snug shrink-0 ${!isModal ? 'line-clamp-2' : ''}`} style={{ color: config.textColor }}>
          {card.title}
        </h4>
        <div className={`space-y-2 text-[16px] ${!isModal ? 'overflow-hidden flex-1' : ''}`} style={{ color: config.textColor, opacity: 0.9 }}>
          {card.metadata?.assignee && (
            <div><span className="font-semibold">责任人:</span> {card.metadata.assignee}</div>
          )}
          {card.metadata?.stepsToReproduce && (
            <div><span className="font-semibold">复现步骤:</span> <span className="line-clamp-3">{card.metadata.stepsToReproduce}</span></div>
          )}
        </div>
      </div>
    );
  }

  // Render BOOKMARK card
  if (card.category === 'bookmark') {
    return (
      <div 
        className={`card-bookmark p-5 mb-3 cursor-default hover:shadow-lg transition-all duration-200 group animate-fade-in relative rounded-[20px] overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
        onClick={() => onClick?.(card)}
        style={{ backgroundColor: config.bgColor, borderColor: config.borderColor, borderWidth: 1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{config.icon}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/50" style={{ color: config.textColor }}>
              {config.label}
            </span>
          </div>
          {!isModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(card.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h4 className={`font-semibold text-[22px] mb-2 leading-snug shrink-0 ${!isModal ? 'line-clamp-2' : ''}`} style={{ color: config.textColor }}>
          {card.title || card.metadata?.urlTitle || '链接收藏'}
        </h4>
        <div className={`space-y-2 text-[16px] ${!isModal ? 'overflow-hidden flex-1' : ''}`} style={{ color: config.textColor, opacity: 0.9 }}>
          {card.metadata?.summary && (
            <p className="line-clamp-3 italic">{card.metadata.summary}</p>
          )}
          {card.metadata?.url && (
            <a href={card.metadata.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 break-all" onClick={e => e.stopPropagation()}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              <span className="line-clamp-1">{card.metadata.url}</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Default card rendering for other types
  return (
    <div
      className={`card-note p-4 mb-3 cursor-pointer hover:shadow-lg transition-all duration-200 group animate-fade-in relative overflow-hidden flex flex-col ${!isModal ? 'max-h-[420px]' : ''}`}
      onClick={() => onClick ? onClick(card) : setIsExpanded(!isExpanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span 
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ 
              backgroundColor: config.bgColor,
              color: config.color 
            }}
          >
            {CATEGORY_LABELS[card.category] || config.label}
          </span>
          {card.status === 'synced' && (
            <span className="text-[10px] text-gray-400 font-medium">
              已同步
            </span>
          )}
        </div>
        {!isModal && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(card.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: config.textColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Title */}
      <h4 
        className={`font-medium text-[22px] mt-2 leading-snug shrink-0 ${!isModal ? 'line-clamp-3' : ''}`}
        style={{ color: config.textColor }}
      >
        {card.title}
      </h4>

      {/* Content */}
      {(isExpanded || card.content.length < 80) && card.content !== card.title && (
        <div className={`relative mt-2 ${!isModal ? 'flex-1 overflow-hidden' : ''}`}>
          <p 
            className={`text-[16px] leading-relaxed opacity-80 ${!isModal ? 'line-clamp-10' : ''}`}
            style={{ color: config.textColor }}
          >
            {card.content}
          </p>
          {!isModal && (
            <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: `linear-gradient(to bottom, transparent, ${config.bgColor})` }} />
          )}
        </div>
      )}

      {/* Tags */}
      {card.metadata?.tags && card.metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {card.metadata.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ 
                backgroundColor: 'rgba(0,0,0,0.05)',
                color: config.textColor,
                opacity: 0.7
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Add to board button for AI suggestions */}
      {onAddToBoard && card.metadata?.aiGenerated && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToBoard({
              title: card.title,
              content: card.content,
              category: card.category,
              items: card.metadata?.items,
            });
          }}
          className="mt-3 flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          style={{ color: config.textColor }}
        >
          <span>+ 添加到看板</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      )}
    </div>
  );
}
