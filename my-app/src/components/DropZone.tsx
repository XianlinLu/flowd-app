'use client';

import { useState, useCallback } from 'react';
import { Card } from '@/types/board';
import { useDrag, getDropAction, generateDragPrompt } from '@/lib/drag-context';

interface DropZoneProps {
  onCardDrop: (card: Card, prompt: string) => void;
}

export function DropZone({ onCardDrop }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);
  const { draggedItem } = useDrag();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);

    if (draggedItem?.card) {
      const action = getDropAction(draggedItem.card.category);
      const prompt = generateDragPrompt(draggedItem.card, action);
      onCardDrop(draggedItem.card, prompt);
    }
  }, [draggedItem, onCardDrop]);

  const getDropHint = () => {
    if (!draggedItem) return '拖入卡片开始讨论';
    
    switch (draggedItem.card.category) {
      case 'note':
        return '释放以延展讨论此笔记';
      case 'decided':
        return '释放以质疑此决策';
      case 'open_question':
        return '释放以重提此问题';
      case 'todo':
        return '释放以深入讨论此待办';
      default:
        return '释放以开始讨论';
    }
  };

  // 只有在有拖拽项时才显示拖放区域
  if (!draggedItem) {
    return null;
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        absolute inset-0 z-50
        flex items-center justify-center
        transition-all duration-300
        ${isOver 
          ? 'bg-blue-500/10 border-2 border-blue-400 border-dashed pointer-events-auto' 
          : 'bg-transparent pointer-events-none'
        }
      `}
    >
      {isOver && (
        <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg animate-fade-in pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{getDropHint()}</p>
              {draggedItem && (
                <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">
                  {draggedItem.card.title}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
