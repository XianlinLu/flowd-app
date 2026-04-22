'use client';

import { useState } from 'react';
import { Card, ContentCategory, CARD_TYPE_CONFIG } from '@/types/board';

interface CardDropActionProps {
  card: Card;
  onCancel: () => void;
  onAction: (action: string, question: string) => void;
}

const ACTION_BUTTONS: Record<ContentCategory, Array<{ id: string; label: string; question: string }>> = {
  note: [
    { id: 'expand', label: '延展讨论', question: '帮我深入探讨这个想法，挖掘更多细节和可能性' },
    { id: 'connect', label: '关联想法', question: '这个想法和其他哪些内容有关联？' },
    { id: 'summarize', label: '提炼核心', question: '把这个想法提炼成一句话或者核心要点' }
  ],
  decided: [
    { id: 'review', label: '重新审视', question: '我们之前的这个决定现在来看还有效吗？需要调整吗？' },
    { id: 'next_step', label: '下一步', question: '基于这个决定，我们下一步应该做什么？' }
  ],
  open_question: [
    { id: 'brainstorm', label: '头脑风暴', question: '针对这个问题，我们能想出哪些解决方案？' },
    { id: 'breakdown', label: '拆解问题', question: '这个问题太大了，帮我拆解成几个小问题来解决' },
    { id: 'prioritize', label: '优先级', question: '这个问题在当前阶段的重要程度如何？' }
  ],
  todo: [
    { id: 'subtasks', label: '细化任务', question: '帮我把这个待办事项拆解成更具体的子任务' },
    { id: 'blockers', label: '潜在风险', question: '完成这个任务可能会遇到哪些阻碍？' }
  ],
  meeting: [
    { id: 'summarize', label: '提取行动项', question: '帮我从这个会议记录中提取所有待办的行动项' }
  ],
  prd: [
    { id: 'review', label: '需求评审', question: '请帮我评审这个需求，指出可能存在的逻辑漏洞' }
  ],
  bug: [
    { id: 'root_cause', label: '排查思路', question: '基于这个Bug的复现步骤，帮我提供一些排查思路' }
  ],
  bookmark: [
    { id: 'summary', label: '提取摘要', question: '帮我总结一下这个链接的核心内容' }
  ]
};

export function CardDropAction({ card, onCancel, onAction }: CardDropActionProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const config = CARD_TYPE_CONFIG[card.category];
  const buttons = ACTION_BUTTONS[card.category] || ACTION_BUTTONS.note;

  const handleActionClick = (button: { id: string; label: string; question: string }) => {
    setSelectedAction(button.id);
    onAction(button.id, button.question);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 mb-4 animate-fade-in">
      {/* 卡片标签 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: card.category === 'decided' || card.category === 'todo'
                ? 'rgba(40,50,60,0.9)'
                : config.bgColor,
              color: card.category === 'decided' || card.category === 'todo'
                ? 'white'
                : config.color,
            }}
          >
            {config.label}
          </span>
          <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]">
            {card.title}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          title="取消讨论，卡片回到左侧"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 快捷操作按钮 */}
      <div className="flex flex-wrap gap-2">
        {buttons.map((button) => (
          <button
            key={button.id}
            onClick={() => handleActionClick(button)}
            disabled={selectedAction !== null}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-full border transition-all
              ${selectedAction === button.id
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }
              ${selectedAction !== null && selectedAction !== button.id ? 'opacity-50' : ''}
            `}
          >
            {button.label}
          </button>
        ))}
      </div>

      {/* 提示文字 */}
      <p className="text-[10px] text-gray-400 mt-2">
        点击按钮向 AI 提问，或点击 ✕ 取消讨论
      </p>
    </div>
  );
}
