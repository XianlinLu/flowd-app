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

// Stack component for groups
const CardStack = ({ 
  title, 
  subtitle, 
  cardsGroup, 
  colorClass,
  onGroupClick
}: { 
  title: string, 
  subtitle: string, 
  cardsGroup: Card[], 
  colorClass: string,
  onGroupClick: () => void
}) => {
  if (cardsGroup.length === 0) return null;
  
  return (
    <div 
      className={`relative w-full min-h-[280px] rounded-3xl p-6 ${colorClass} transition-transform hover:scale-[1.02] cursor-pointer group`}
      onClick={onGroupClick}
    >
      <div className="absolute top-6 left-6 z-20">
        <h3 className="text-xl font-semibold text-gray-500/80 group-hover:text-gray-700 transition-colors">{title}</h3>
        <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      </div>
      <div className="absolute bottom-6 left-6 z-20 text-xs text-gray-400 max-w-[200px]">
        {cardsGroup[0]?.title || '暂无内容'}
      </div>
      
      {/* Render stacked cards (up to 3) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[240px] h-[240px] perspective-1000">
        {cardsGroup.slice(0, 3).map((card, idx) => {
          // Base transformations (tightly packed, inside the container)
          const baseTranslateX = idx * 6;
          const baseTranslateY = idx * 6;
          const baseRotate = idx * 2;
          const baseScale = 1 - idx * 0.05;
          
          // Hover transformations (fanned out, slightly moved up)
          const hoverTranslateX = idx * 16;
          const hoverTranslateY = -2 + (idx * 4); // Overall -2px up, plus a slight offset per card
          const hoverRotate = idx * 5;
          
          return (
            <div 
              key={card.id}
              className="absolute inset-0 w-full h-full transition-all duration-300 ease-out origin-bottom-right"
              style={{
                zIndex: 10 - idx,
                transform: `translate3d(${baseTranslateX}px, ${baseTranslateY}px, 0) rotate(${baseRotate}deg) scale(${baseScale})`,
                opacity: 1 - idx * 0.1
              }}
            >
              {/* This inner div receives the group-hover effects via Tailwind arbitrary values */}
              <div 
                className="w-full h-full pointer-events-none rounded-[16px] shadow-lg transition-transform duration-300 ease-out group-hover:[transform:translate3d(var(--hover-tx),var(--hover-ty),0)_rotate(var(--hover-rot))] [&>div]:w-full [&>div]:h-full [&>div]:m-0"
                style={{
                  '--hover-tx': `${hoverTranslateX - baseTranslateX}px`,
                  '--hover-ty': `${hoverTranslateY - baseTranslateY}px`,
                  '--hover-rot': `${hoverRotate - baseRotate}deg`,
                } as React.CSSProperties}
              >
                <FlowdCard 
                  card={card}
                  isModal={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

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

  const getCardGroups = (cardsToGroup: Card[]) => {
    // 1. 项目总结 (Standalone)
    const summaryCards = cardsToGroup.filter(c => c.title.includes('项目总结'));
    
    // Remaining cards to categorize
    const rest = cardsToGroup.filter(c => !summaryCards.includes(c));

    // 2. 已完成 (Completed Todo)
    const completedTodos = rest.filter(c => c.category === 'todo' && c.metadata?.items?.length && c.metadata?.checkedItems?.every((v: boolean) => v === true));
    
    // 3. 待办未完成 (Incomplete Todo)
    const incompleteTodos = rest.filter(c => c.category === 'todo' && !completedTodos.includes(c));

    // 4. 想法灵感 (Note)
    const notes = rest.filter(c => c.category === 'note');

    // 5. 待讨论 (Open Question)
    const openQuestions = rest.filter(c => c.category === 'open_question');

    // 6. 辅助办公 (PRD, Meeting, Bug, Bookmark)
    const office = rest.filter(c => ['prd', 'meeting', 'bug', 'bookmark'].includes(c.category));

    // 7. 已做决定 (Decided)
    const decided = rest.filter(c => c.category === 'decided');

    return { summaryCards, completedTodos, incompleteTodos, notes, openQuestions, office, decided };
  };

  const todayGroups = getCardGroups(todayCards);
  const pastGroups = getCardGroups(pastCards);

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
                className="w-full h-[280px] transition-transform hover:scale-[1.02] cursor-pointer [&>div]:!h-full [&>div]:!m-0 [&>div]:!max-h-none" 
                onClick={() => onCardClick?.(aboutCard)}
              >
                <FlowdCard 
                  card={aboutCard}
                  isModal={false}
                />
              </div>
            )}
            
            {/* Project Summary Standalone */}
            {todayGroups.summaryCards.map(card => (
              <div 
                key={card.id}
                className="w-full h-[280px] transition-transform hover:scale-[1.02] cursor-pointer [&>div]:!h-full [&>div]:!m-0 [&>div]:!max-h-none" 
                onClick={() => onCardClick?.(card)}
              >
                <FlowdCard 
                  card={card}
                  isModal={false}
                />
              </div>
            ))}

            <CardStack 
              title="待办未完成" 
              subtitle="今天" 
              cardsGroup={todayGroups.incompleteTodos} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "待办未完成", cards: todayGroups.incompleteTodos })}
            />
            <CardStack 
              title="想法灵感" 
              subtitle="今天" 
              cardsGroup={todayGroups.notes} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "想法灵感", cards: todayGroups.notes })}
            />
            <CardStack 
              title="待讨论" 
              subtitle="今天" 
              cardsGroup={todayGroups.openQuestions} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "待讨论", cards: todayGroups.openQuestions })}
            />
            <CardStack 
              title="辅助办公" 
              subtitle="今天" 
              cardsGroup={todayGroups.office} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "辅助办公", cards: todayGroups.office })}
            />
            <CardStack 
              title="已做决定" 
              subtitle="今天" 
              cardsGroup={todayGroups.decided} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "已做决定", cards: todayGroups.decided })}
            />
            <CardStack 
              title="已完成" 
              subtitle="今天" 
              cardsGroup={todayGroups.completedTodos} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "已完成", cards: todayGroups.completedTodos })}
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
            {/* Project Summary Standalone - Past */}
            {pastGroups.summaryCards.map(card => (
              <div 
                key={card.id}
                className="w-full h-[280px] transition-transform hover:scale-[1.02] cursor-pointer [&>div]:!h-full [&>div]:!m-0 [&>div]:!max-h-none" 
                onClick={() => onCardClick?.(card)}
              >
                <FlowdCard 
                  card={card}
                  isModal={false}
                />
              </div>
            ))}

            <CardStack 
              title="待办未完成" 
              subtitle="更早" 
              cardsGroup={pastGroups.incompleteTodos} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "待办未完成", cards: pastGroups.incompleteTodos })}
            />
            <CardStack 
              title="想法灵感" 
              subtitle="更早" 
              cardsGroup={pastGroups.notes} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "想法灵感", cards: pastGroups.notes })}
            />
            <CardStack 
              title="待讨论" 
              subtitle="更早" 
              cardsGroup={pastGroups.openQuestions} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "待讨论", cards: pastGroups.openQuestions })}
            />
            <CardStack 
              title="辅助办公" 
              subtitle="更早" 
              cardsGroup={pastGroups.office} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "辅助办公", cards: pastGroups.office })}
            />
            <CardStack 
              title="已做决定" 
              subtitle="更早" 
              cardsGroup={pastGroups.decided} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "已做决定", cards: pastGroups.decided })}
            />
            <CardStack 
              title="已完成" 
              subtitle="更早" 
              cardsGroup={pastGroups.completedTodos} 
              colorClass="bg-[#E2E6E8] border border-white/40 shadow-sm"
              onGroupClick={() => setActiveGroup({ title: "已完成", cards: pastGroups.completedTodos })}
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
                className="w-[320px] h-auto shrink-0 animate-slide-up hover:scale-105 transition-transform cursor-pointer shadow-xl rounded-[16px]"
                style={{ animationDelay: `${idx * 50}ms` }}
                onClick={() => {
                  setActiveGroup(null);
                  onCardClick?.(card);
                }}
              >
                <div className="w-full h-auto rounded-[16px] [&>div]:w-full [&>div]:m-0">
                  <FlowdCard 
                    card={card}
                    isModal={false}
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
