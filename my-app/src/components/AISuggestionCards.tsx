'use client';

import { useState } from 'react';
import { ContentCategory } from '@/types/board';
import { boardStore } from '@/lib/board-store';

interface SuggestionCard {
  id: string;
  category: ContentCategory;
  title: string;
  content: string;
  items?: string[];
}

interface AISuggestionCardsProps {
  suggestions: SuggestionCard[];
  onAddToBoard?: () => void;
}

export function AISuggestionCards({ suggestions, onAddToBoard }: AISuggestionCardsProps) {
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set());

  const handleAddToBoard = (card: SuggestionCard) => {
    const newCard = boardStore.addCard(card.category, {
      title: card.title,
      content: card.content,
      metadata: {
        items: card.items,
        aiGenerated: true,
      },
    });
    
    if (newCard) {
      setAddedCards(prev => new Set(prev).add(card.id));
      onAddToBoard?.();
    }
  };

  const getCardStyle = (category: ContentCategory) => {
    switch (category) {
      case 'todo':
        return {
          bg: '#134e4a', // Darker teal matching design
          text: '#ffffff',
          label: 'TODO',
        };
      case 'open_question':
        return {
          bg: '#E3FF96', // Lime green matching design
          text: '#854d0e', // Dark text
          label: '待讨论的问题',
        };
      default:
        return {
          bg: '#f5f3f0',
          text: '#374151',
          label: 'NOTE',
        };
    }
  };

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-4 py-2 pb-4 snap-x items-start">
      {suggestions.map((card) => {
        const style = getCardStyle(card.category);
        const isAdded = addedCards.has(card.id);
        
        return (
          <div
            key={card.id}
            className="flex-shrink-0 w-[280px] rounded-[16px] p-6 shadow-sm hover:shadow-md transition-shadow snap-start relative overflow-hidden flex flex-col"
            style={{ backgroundColor: style.bg }}
          >
            {/* Background watermark for OPEN QUESTION */}
            {card.category === 'open_question' && (
              <div className="absolute right-[-10%] top-[-10%] text-[150px] font-bold opacity-10 pointer-events-none select-none leading-none" style={{ color: style.text }}>
                ?
              </div>
            )}

            {/* Label */}
            <span
              className="text-[11px] font-mono tracking-widest uppercase mb-4 inline-block"
              style={{
                color: style.text,
                opacity: 0.8
              }}
            >
              {style.label}
            </span>

            {/* Title */}
            <h4
              className="font-semibold text-[18px] mb-8 leading-snug tracking-tight shrink-0"
              style={{ color: style.text }}
            >
              {card.title}
            </h4>

            {/* Items List (for TODO) */}
            {card.items && card.items.length > 0 && (
              <ul className="space-y-5 mb-2 relative flex-1">
                {card.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-4"
                  >
                    <div 
                      className="mt-[2px] w-[24px] h-[24px] rounded-[6px] border-[2px] flex items-center justify-center flex-shrink-0 relative"
                      style={{ borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent' }} 
                    />
                    <span 
                      className="text-[16px] leading-[24px] font-medium tracking-tight"
                      style={{ color: style.text }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Content (if not just items) */}
            {(!card.items || card.items.length === 0) && card.content !== card.title && (
              <p
                className="text-[16px] font-medium tracking-tight mb-6 leading-[24px]"
                style={{ color: style.text, opacity: 0.9 }}
              >
                {card.content}
              </p>
            )}

            {/* Add to Board Button */}
            <button
              onClick={() => handleAddToBoard(card)}
              disabled={isAdded}
              className="mt-auto flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-colors hover:bg-white/10 shrink-0 disabled:opacity-50 self-start"
              style={{
                backgroundColor: 'transparent',
                color: style.text,
                borderColor: card.category === 'todo' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'
              }}
            >
              <span>{isAdded ? '✓ 已保存' : '+ 保存至左侧看板'}</span>
              {!isAdded && (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
