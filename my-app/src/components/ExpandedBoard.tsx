import { Card } from '@/types/board';
import { FlowdCard } from './FlowdCard';
import { useState } from 'react';

interface ExpandedBoardProps {
  cards: Card[];
  onCardUpdate?: (id: string, updates: Partial<Card>) => void;
  onCardDelete?: (id: string) => void;
  onCardChat?: (card: Card) => void;
  onCardClick?: (card: Card) => void;
}

export function ExpandedBoard({ cards, onCardUpdate, onCardDelete, onCardChat, onCardClick }: ExpandedBoardProps) {
  const [activeGroup, setActiveGroup] = useState<{ title: string, cards: Card[] } | null>(null);

  const todayStart = new Date().setHours(0, 0, 0, 0);

  // Separate Today and Past, and sort them by createdAt descending (newest first)
  const sortedCards = [...cards].sort((a, b) => b.createdAt - a.createdAt);
  
  // Extract About Flowd card
  const aboutCard = sortedCards.find(c => c.metadata?.isAboutFlowd);
  
  // Filter out about card for general grouping
  const regularCards = sortedCards.filter(c => !c.metadata?.isAboutFlowd);
  
  const todayCards = regularCards.filter(c => c.createdAt >= todayStart);
  const pastCards = regularCards.filter(c => c.createdAt < todayStart);

  // Group today's cards
  const todayTodoCards = todayCards.filter(c => c.category === 'todo');
  const todayNoteCards = todayCards.filter(c => c.category === 'note' || c.category === 'decided' || c.category === 'open_question');
  const todayOfficeCards = todayCards.filter(c => c.category === 'meeting' || c.category === 'prd' || c.category === 'bug' || c.category === 'bookmark');

  // Group past cards
  const decidedCards = pastCards.filter(c => c.category === 'decided');
  const completedTodoCards = pastCards.filter(c => c.category === 'todo' && c.metadata?.items?.length && c.metadata?.checkedItems?.every((v: boolean) => v === true));
  const answeredQuestionCards = pastCards.filter(c => c.category === 'open_question' && !!c.answer);
  const otherPastCards = pastCards.filter(c => !decidedCards.includes(c) && !completedTodoCards.includes(c) && !answeredQuestionCards.includes(c));

  // Stack component for groups
  const CardStack = ({ title, subtitle, cardsGroup, colorClass }: { title: string, subtitle: string, cardsGroup: Card[], colorClass: string }) => {
    if (cardsGroup.length === 0) return null;
    
    return (
      <div 
        className={`relative w-full h-[220px] rounded-3xl p-6 ${colorClass} transition-transform hover:scale-[1.02] cursor-pointer group`}
        onClick={() => setActiveGroup({ title, cards: cardsGroup })}
      >
        <div className="absolute top-6 left-6 z-20">
          <h3 className="text-xl font-semibold text-gray-500/80 group-hover:text-gray-700 transition-colors">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className="absolute bottom-6 left-6 z-20 text-xs text-gray-400 max-w-[200px]">
          {cardsGroup[0]?.title || '暂无内容'}
        </div>
        
        {/* Render stacked cards (up to 3) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[220px] h-[160px]">
          {cardsGroup.slice(0, 3).map((card, idx) => (
            <div 
              key={card.id}
              className="absolute right-0 top-0 w-full h-full shadow-lg transition-transform duration-300 group-hover:translate-x-[-10px] group-hover:-translate-y-[10px]"
              style={{
                zIndex: 10 - idx,
                transform: `translate(${idx * 15}px, ${idx * 10}px) rotate(${idx * 3}deg) scale(${1 - idx * 0.05})`,
                opacity: 1 - idx * 0.1
              }}
            >
              <div className="w-full h-full pointer-events-none overflow-hidden rounded-[20px] [&>div]:h-full [&>div]:w-full [&>div]:m-0">
                <FlowdCard 
                  card={card}
                  isModal={false}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#C1C9CC] p-12 text-[#6C767B]">
      <h1 className="text-5xl font-medium mb-12">Flowd</h1>
      
      {/* Today Section */}
      <div className="mb-16">
        <h2 className="text-2xl font-medium mb-6 text-[#7E898E]">今天</h2>
        {todayCards.length === 0 && !aboutCard ? (
          <div className="text-sm opacity-60">今天还没有产生卡片。</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 w-full">
            {/* About Flowd Standalone - Always renders if exists, usually counts as 'today' for visibility */}
            {aboutCard && (
              <div 
                className="w-full h-[220px] transition-transform hover:scale-[1.02] cursor-pointer shadow-sm hover:shadow-md rounded-[20px]" 
                onClick={() => onCardClick?.(aboutCard)}
              >
                <div className="w-full h-full overflow-hidden rounded-[20px] [&>div]:h-full [&>div]:w-full [&>div]:m-0">
                  <FlowdCard 
                    card={aboutCard}
                    isModal={false}
                  />
                </div>
              </div>
            )}
            <CardStack 
              title="待办事项" 
              subtitle="今天" 
              cardsGroup={todayTodoCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
            <CardStack 
              title="想法笔记" 
              subtitle="今天" 
              cardsGroup={todayNoteCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
            <CardStack 
              title="辅助办公" 
              subtitle="今天" 
              cardsGroup={todayOfficeCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Last Time Section */}
      <div>
        <h2 className="text-2xl font-medium mb-6 text-[#7E898E]">过去</h2>
        {pastCards.length === 0 ? (
          <div className="text-sm opacity-60">过去还没有产生卡片。</div>
        ) : (
          <div className="grid grid-cols-2 gap-6 w-full">
            <CardStack 
              title="已做决定" 
              subtitle="3天前" 
              cardsGroup={decidedCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
            <CardStack 
              title="已完成" 
              subtitle="昨天" 
              cardsGroup={completedTodoCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
            <CardStack 
              title="已讨论" 
              subtitle="3天前" 
              cardsGroup={answeredQuestionCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
            <CardStack 
              title="辅助办公" 
              subtitle="更早" 
              cardsGroup={otherPastCards} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Group Modal */}
      {activeGroup && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-8 bg-[#879296]/90 backdrop-blur-md animate-fade-in"
          onClick={() => setActiveGroup(null)}
        >
          <div 
            className="flex flex-wrap gap-6 items-center justify-center max-w-[90vw] max-h-[90vh] overflow-y-auto p-8 no-scrollbar"
            onClick={e => e.stopPropagation()}
          >
            {activeGroup.cards.map((card, idx) => (
              <div 
                key={card.id} 
                className="w-[320px] h-[220px] shrink-0 animate-slide-up hover:scale-105 transition-transform cursor-pointer shadow-xl rounded-[20px]"
                style={{ animationDelay: `${idx * 50}ms` }}
                onClick={() => {
                  setActiveGroup(null);
                  onCardClick?.(card);
                }}
              >
                <div className="w-full h-full overflow-hidden rounded-[20px] [&>div]:h-full [&>div]:w-full [&>div]:m-0">
                  <FlowdCard 
                    card={card}
                    isModal={true}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Close button for modal */}
          <button 
            className="absolute top-8 right-8 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-colors"
            onClick={() => setActiveGroup(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
