import { Card, BoardSection, ContentCategory, CardType, CardStatus } from '@/types/board';

class BoardStore {
  private sections: BoardSection[] = [
    { 
      id: 'onboarding', 
      title: '前期构思与调研', 
      subtitle: '项目初期的想法、探索与决定',
      cards: [] 
    },
    { 
      id: 'workspace', 
      title: '落地执行与设计', 
      subtitle: '核心工作区结构与布局',
      cards: [] 
    },
  ];
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  getSections(): BoardSection[] {
    return this.sections;
  }

  addCard(
    category: ContentCategory,
    card: Omit<Card, 'id' | 'category' | 'createdAt' | 'updatedAt' | 'status' | 'type'>,
    targetSectionId?: string
  ): Card {
    const type = this.categoryToType(category);
    const sectionId = targetSectionId || this.getSectionForCategory(category);
    const section = this.sections.find(s => s.id === sectionId) || this.sections[0];
    
    const newCard: Card = {
      ...card,
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category,
      status: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (section) {
      section.cards.unshift(newCard);
      this.notify();
    }
    
    return newCard;
  }

  private categoryToType(category: ContentCategory): CardType {
    const mapping: Record<ContentCategory, CardType> = {
      'decided': 'decision',
      'note': 'note',
      'todo': 'todo',
      'open_question': 'question',
      'meeting': 'meeting',
      'prd': 'prd',
      'bug': 'bug',
      'bookmark': 'bookmark'
    };
    return mapping[category];
  }

  private getSectionForCategory(category: ContentCategory): string {
    // Simple logic: onboarding-related cards go to onboarding section
    // This can be enhanced with AI analysis
    return 'onboarding';
  }

  updateCard(cardId: string, updates: Partial<Card>) {
    for (const section of this.sections) {
      const cardIndex = section.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        section.cards[cardIndex] = {
          ...section.cards[cardIndex],
          ...updates,
          updatedAt: Date.now(),
        };
        this.notify();
        return section.cards[cardIndex];
      }
    }
    return null;
  }

  deleteCard(cardId: string) {
    for (const section of this.sections) {
      const cardIndex = section.cards.findIndex(c => c.id === cardId);
      if (cardIndex !== -1) {
        section.cards.splice(cardIndex, 1);
        this.notify();
        return true;
      }
    }
    return false;
  }

  getAllCards(): Card[] {
    return this.sections.flatMap(section => section.cards);
  }

  getCardsByCategory(category: ContentCategory): Card[] {
    return this.getAllCards().filter(c => c.category === category);
  }

  getStats() {
    const allCards = this.getAllCards();
    return {
      total: allCards.length,
      decided: allCards.filter(c => c.category === 'decided').length,
      notes: allCards.filter(c => c.category === 'note').length,
      todos: allCards.filter(c => c.category === 'todo').length,
      openQuestions: allCards.filter(c => c.category === 'open_question').length,
      synced: allCards.filter(c => c.status === 'synced').length,
    };
  }

  clear() {
    this.sections.forEach(section => {
      section.cards = [];
    });
    this.notify();
  }
}

export const boardStore = new BoardStore();
