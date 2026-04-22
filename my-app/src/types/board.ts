export type CardType = 'decision' | 'todo' | 'question' | 'note' | 'doc' | 'meeting' | 'prd' | 'bug' | 'bookmark';
export type CardStatus = 'synced' | 'new' | 'updated' | 'syncing' | 'sync_failed';
export type ContentCategory = 'decided' | 'note' | 'todo' | 'open_question' | 'meeting' | 'prd' | 'bug' | 'bookmark';

export interface Card {
  id: string;
  type: CardType;
  category: ContentCategory;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  status: CardStatus;
  sourceMessageId?: string;
  answer?: string; // 用于待解决问题卡片的解决方案
  metadata?: {
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
    aiGenerated?: boolean;
    items?: string[]; // 用于TODO子项
    checkedItems?: boolean[]; // 用于TODO复选框状态
    isAboutFlowd?: boolean;
    // 会议记录
    participants?: string[];
    agenda?: string;
    minutes?: string;
    actionItems?: string[];
    // PRD需求文档
    background?: string;
    objectives?: string;
    acceptanceCriteria?: string;
    prdLink?: string;
    // Bug问题记录
    severity?: 'critical' | 'high' | 'medium' | 'low';
    stepsToReproduce?: string;
    assignee?: string;
    // 链接收藏
    url?: string;
    urlTitle?: string;
    summary?: string;
    // 附件 (如图片)
    attachment?: {
      name: string;
      type: string;
      size: number;
      url?: string;
    };
    // 飞书同步文档链接
    feishuDocUrl?: string;
    // 飞书同步错误信息
    syncError?: string;
  };
}

export interface BoardSection {
  id: string;
  title: string;
  subtitle?: string;
  cards: Card[];
}

export interface Board {
  id: string;
  sections: BoardSection[];
  createdAt: number;
  updatedAt: number;
}

export interface AIRecognitionResult {
  category: ContentCategory;
  title: string;
  content: string;
  confidence: number;
  suggestedTags?: string[];
}

export interface AISuggestion {
  type: 'summary' | 'creative' | 'action';
  content: string;
  priority?: 'high' | 'medium' | 'low';
  relatedCards?: string[];
}

// 严格按图1配色系统
export const CARD_TYPE_CONFIG: Record<CardType | ContentCategory, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
}> = {
  decision: {
    label: '已决策',
    color: '#10b981',
    bgColor: '#3d3d3d', // 深灰
    borderColor: '#4d4d4d',
    textColor: '#ffffff',
    icon: '✓',
  },
  decided: {
    label: '已决策',
    color: '#10b981',
    bgColor: '#3d3d3d', // 深灰
    borderColor: '#4d4d4d',
    textColor: '#ffffff',
    icon: '✓',
  },
  todo: {
    label: '待办',
    color: '#5eead4',
    bgColor: '#2d4a4a', // 深青
    borderColor: '#3d5a5a',
    textColor: '#ffffff',
    icon: '○',
  },
  question: {
    label: '待解决问题',
    color: '#854d0e',
    bgColor: '#e8e4d4', // 淡黄绿
    borderColor: '#d4d0c0',
    textColor: '#854d0e',
    icon: '?',
  },
  open_question: {
    label: '待解决问题',
    color: '#854d0e',
    bgColor: '#e8e4d4', // 淡黄绿
    borderColor: '#d4d0c0',
    textColor: '#854d0e',
    icon: '?',
  },
  note: {
    label: '笔记',
    color: '#6b7280',
    bgColor: '#f5f3f0', // 浅米白
    borderColor: '#e5e3e0',
    textColor: '#374151',
    icon: '◆',
  },
  doc: {
    label: '文档',
    color: '#374151',
    bgColor: '#ffffff', // 白
    borderColor: '#e5e7eb',
    textColor: '#374151',
    icon: '📄',
  },
  meeting: {
    label: '会议记录',
    color: '#8b5cf6',
    bgColor: '#f3e8ff', // 浅紫
    borderColor: '#d8b4fe',
    textColor: '#6b21a8',
    icon: '👥',
  },
  prd: {
    label: 'PRD文档',
    color: '#2563eb',
    bgColor: '#dbeafe', // 浅蓝
    borderColor: '#93c5fd',
    textColor: '#1e40af',
    icon: '📋',
  },
  bug: {
    label: '问题记录',
    color: '#dc2626',
    bgColor: '#fee2e2', // 浅红
    borderColor: '#fca5a5',
    textColor: '#991b1b',
    icon: '🐛',
  },
  bookmark: {
    label: '链接收藏',
    color: '#059669',
    bgColor: '#d1fae5', // 浅绿
    borderColor: '#6ee7b7',
    textColor: '#065f46',
    icon: '🔗',
  },
};
