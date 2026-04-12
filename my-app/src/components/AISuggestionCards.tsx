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
          bg: '#1a3a3a', // Darker teal matching design
          text: '#ffffff',
          label: 'TODO',
        };
      case 'open_question':
        return {
          bg: '#e0fa9d', // Lime green matching design
          text: '#1a3a3a', // Dark teal text
          label: 'OPEN QUESTION',
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
    <div className="flex flex-nowrap overflow-x-auto gap-4 py-2 pb-4 snap-x">
      {suggestions.map((card) => {
        const style = getCardStyle(card.category);
        const isAdded = addedCards.has(card.id);
        
        return (
          <div
            key={card.id}
            className="flex-shrink-0 w-[280px] rounded-[16px] p-6 shadow-sm hover:shadow-md transition-shadow snap-start relative overflow-hidden"
            style={{ backgroundColor: style.bg }}
          >
            {/* Background watermark for OPEN QUESTION */}
            {card.category === 'open_question' && (
              <div className="absolute top-2 right-4 text-8xl font-bold opacity-10 pointer-events-none select-none" style={{ color: style.text }}>
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
              className="font-bold text-xl mb-4 leading-snug tracking-tight"
              style={{ color: style.text }}
            >
              {card.title}
            </h4>

            {/* Items List (for TODO) */}
            {card.items && card.items.length > 0 && (
              <ul className="space-y-3 mb-6">
                {card.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3"
                  >
                    <div className="mt-1 w-3.5 h-3.5 border rounded-sm flex-shrink-0" style={{ borderColor: style.text, opacity: 0.7 }} />
                    <span 
                      className="text-[15px] font-medium tracking-tight leading-snug"
                      style={{ color: style.text, opacity: 0.95 }}
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
                className="text-[15px] font-medium tracking-tight mb-6 leading-relaxed"
                style={{ color: style.text, opacity: 0.9 }}
              >
                {card.content}
              </p>
            )}

            {/* Add to Board Button */}
            <button
              onClick={() => handleAddToBoard(card)}
              disabled={isAdded}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full transition-colors disabled:opacity-50"
              style={{
                backgroundColor: card.category === 'todo' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                color: style.text,
                border: `1px solid ${card.category === 'todo' ? 'rgba(255,255,255,0.2)' : 'transparent'}`
              }}
            >
              <span>{isAdded ? '✓ Added' : '+ Add to board'}</span>
              {!isAdded && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
