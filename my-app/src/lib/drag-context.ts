import { Card, ContentCategory } from '@/types/board';
import { createContext, useContext } from 'react';

export interface DragItem {
  card: Card;
  type: 'card';
}

export interface DropResult {
  card: Card;
  action: 'expand' | 'challenge' | 'revisit';
}

export const DragContext = createContext<{
  draggedItem: DragItem | null;
  setDraggedItem: (item: DragItem | null) => void;
}>({
  draggedItem: null,
  setDraggedItem: () => {},
});

export const useDrag = () => useContext(DragContext);

// 根据卡片类型确定拖入后的讨论类型
export function getDropAction(category: ContentCategory): 'expand' | 'challenge' | 'revisit' {
  switch (category) {
    case 'note':
      return 'expand'; // 笔记 → 延展讨论
    case 'decided':
      return 'challenge'; // 决策 → 质疑讨论
    case 'open_question':
      return 'revisit'; // 问题 → 重提讨论
    case 'todo':
      return 'expand'; // 待办 → 延展讨论
    default:
      return 'expand';
  }
}

// 生成拖入后的AI提示
export function generateDragPrompt(card: Card, action: 'expand' | 'challenge' | 'revisit'): string {
  const categoryNames: Record<string, string> = {
    'decided': '已决策',
    'note': '笔记',
    'todo': '待办',
    'open_question': '待解决问题',
  };

  switch (action) {
    case 'expand':
      return `用户将「${categoryNames[card.category]}」卡片拖入对话区，想要深入讨论：「${card.title}」

这是延展讨论。帮助用户：
1. 深入探索这个想法/笔记
2. 挖掘更多细节和可能性
3. 连接到其他相关想法
4. 提出延展性的问题

原始内容：${card.content}

讨论结束后，如果产生了新的想法、决策、待办或问题，请用 JSON 格式输出新卡片：
{
  "newCards": [
    {
      "category": "decided|note|todo|open_question",
      "title": "卡片标题",
      "content": "详细内容",
      "tags": ["标签1", "标签2"]
    }
  ]
}`;

    case 'challenge':
      return `用户将「已决策」卡片拖入对话区，想要质疑或重新审视：「${card.title}」

这是质疑讨论。帮助用户：
1. 审视这个决策的前提假设
2. 考虑其他可能的选择
3. 评估决策的风险和后果
4. 如果需要，提出推翻或修改的建议

原始决策：${card.content}

注意：以开放但直接的方式质疑，不要防御性维护原决策。

讨论结束后，如果产生了新的想法、决策、待办或问题，请用 JSON 格式输出新卡片：
{
  "newCards": [
    {
      "category": "decided|note|todo|open_question",
      "title": "卡片标题",
      "content": "详细内容",
      "tags": ["标签1", "标签2"]
    }
  ]
}`;

    case 'revisit':
      return `用户将「待解决问题」卡片拖入对话区，想要重新讨论：「${card.title}」

这是重提讨论。帮助用户：
1. 回顾这个问题的现状
2. 探索新的解决思路
3. 考虑是否有新的信息改变了情况
4. 推动问题向解决前进

原始问题：${card.content}

讨论结束后，如果产生了新的想法、决策、待办或问题，请用 JSON 格式输出新卡片：
{
  "newCards": [
    {
      "category": "decided|note|todo|open_question",
      "title": "卡片标题",
      "content": "详细内容",
      "tags": ["标签1", "标签2"]
    }
  ]
}`;
  }
}

// 从AI响应中提取新卡片
export function extractNewCardsFromResponse(response: string): Array<{
  category: ContentCategory;
  title: string;
  content: string;
  tags: string[];
  items?: string[];
  hasAttachment?: boolean;
}> {
  const cards: Array<{
    category: ContentCategory;
    title: string;
    content: string;
    tags: string[];
    items?: string[];
    hasAttachment?: boolean;
  }> = [];

  // 尝试提取 JSON 格式1（{ "newCards": [...] }）
  const jsonMatch = response.match(/\{[\s\S]*"newCards"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.newCards && Array.isArray(parsed.newCards)) {
        parsed.newCards.forEach((card: any) => {
          if (card.category && card.title) {
            cards.push({
              category: card.category as ContentCategory,
              title: card.title,
              content: card.content || card.title,
              tags: card.tags || [],
              items: card.items,
              hasAttachment: card.hasAttachment,
            });
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse JSON cards:', e);
    }
  }

  // 尝试提取 markdown 代码块中的 JSON
  const codeBlockMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch && cards.length === 0) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      const parsedArray = Array.isArray(parsed) ? parsed : [parsed];
      parsedArray.forEach((card: any) => {
        if ((card.category || card.type) && card.title) {
          cards.push({
            category: (card.category || card.type).toLowerCase() as ContentCategory,
            title: card.title,
            content: card.content || card.title,
            tags: card.tags || [],
            items: card.items,
            hasAttachment: card.hasAttachment,
          });
        }
      });
    } catch (e) {
      console.error('Failed to parse JSON array from markdown codeblock:', e);
    }
  }

  // 尝试提取 JSON 格式2（直接数组 [...]）
  const arrayMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch && cards.length === 0) {
    try {
      const parsedArray = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsedArray)) {
        parsedArray.forEach((card: any) => {
          if ((card.category || card.type) && card.title) {
            cards.push({
              category: (card.category || card.type) as ContentCategory,
              title: card.title,
              content: card.content || card.title,
              tags: card.tags || [],
              items: card.items,
              hasAttachment: card.hasAttachment,
            });
          }
        });
      }
    } catch (e) {
      console.error('Failed to parse array JSON cards:', e);
    }
  }

  // 尝试提取 JSON 格式3（直接单个对象 {...}）
  const objectMatch = response.match(/\{\s*"(?:title|category|type|content)"[\s\S]*\}/);
  if (objectMatch && cards.length === 0) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if ((parsed.category || parsed.type) && parsed.title) {
        cards.push({
          category: (parsed.category || parsed.type).toLowerCase() as ContentCategory,
          title: parsed.title,
          content: parsed.content || parsed.title,
          tags: parsed.tags || [],
          items: parsed.items,
          hasAttachment: parsed.hasAttachment,
        });
      }
    } catch (e) {
      console.error('Failed to parse JSON object:', e);
    }
  }

  return cards;
}
