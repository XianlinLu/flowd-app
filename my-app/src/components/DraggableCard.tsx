'use client';

import { Card } from '@/types/board';
import { useState, useRef } from 'react';
import { useDrag } from '@/lib/drag-context';
import { FlowdCard } from './FlowdCard';

interface DraggableCardProps {
  card: Card;
  onUpdate?: (id: string, updates: Partial<Card>) => void;
  onDelete?: (id: string) => void;
  onChat?: (card: Card) => void;
  onClick?: (card: Card) => void;
  onContextMenu?: (e: React.MouseEvent, cardId: string) => void;
}

export function DraggableCard({ card, onUpdate, onDelete, onChat, onClick, onContextMenu }: DraggableCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { setDraggedItem } = useDrag();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    setDraggedItem({ card, type: 'card' });
    
    // Set drag image
    if (cardRef.current) {
      e.dataTransfer.setDragImage(cardRef.current, 20, 20);
    }
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ cardId: card.id }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedItem(null);
  };

  const getDragHint = () => {
    switch (card.category) {
      case 'note':
        return '拖入聊天区延展讨论';
      case 'decided':
        return '拖入聊天区质疑决策';
      case 'open_question':
        return '拖入聊天区重提问题';
      case 'todo':
        return '拖入聊天区深入讨论';
      default:
        return '拖入聊天区讨论';
    }
  };

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`relative transition-opacity duration-200 group ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      {/* 拖拽提示 Pill */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:-translate-y-1">
        <div className="bg-[#2a3036] text-white/90 text-[14px] px-5 py-2 rounded-full shadow-lg whitespace-nowrap flex items-center gap-2 border border-white/10 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          拖拽讨论
        </div>
        {/* 小三角形指示器 */}
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#2a3036]"></div>
      </div>

      {/* 左侧 6个点 拖拽把手 */}
      <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity duration-200 flex flex-col gap-[3px] p-1 cursor-grab active:cursor-grabbing text-gray-500">
        <div className="flex gap-[3px]">
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
        </div>
        <div className="flex gap-[3px]">
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
        </div>
        <div className="flex gap-[3px]">
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
          <div className="w-[4px] h-[4px] rounded-full bg-current"></div>
        </div>
      </div>
      
      <div className="relative group/card cursor-grab active:cursor-grabbing" onContextMenu={(e) => {
        if (onContextMenu) {
          e.stopPropagation();
          onContextMenu(e, card.id);
        }
      }}>
        <FlowdCard
          card={card}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onChat={onChat}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
