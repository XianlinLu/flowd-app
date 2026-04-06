import { AIRecognitionResult, AISuggestion, ContentCategory, Card } from '@/types/board';
import { buildSystemPrompt, FLOWD_SOUL_PROMPT } from './ai-soul';

export const AI_RECOGNITION_PROMPT = `${FLOWD_SOUL_PROMPT}

## 当前任务

分析用户的输入并识别：
1. 内容类别（已决策、笔记、待办、待解决问题）
2. 一个简洁的标题
3. 详细内容
4. 建议的标签

## 类别定义

- **已决策**：坚定的决定、达成的结论、最终的选择
- **笔记**：想法、观察、参考、灵感、要记住的事情
- **待办**：行动项、要完成的任务、要做的事情
- **待解决问题**：不确定性、要探索的事情、待定的决定

## 回应格式

用 JSON 对象回应：

{
  "recognition": {
    "category": "decided|note|todo|open_question",
    "title": "简洁标题（最多40字）",
    "content": "详细内容",
    "confidence": 0.95,
    "suggestedTags": ["标签1", "标签2"]
  },
  "suggestions": [
    {
      "type": "summary|creative|action",
      "content": "建议内容",
      "priority": "high|medium|low"
    }
  ]
}

## 示例

用户："想给空看板加个默认提示语"
回应：
{
  "recognition": {
    "category": "todo",
    "title": "设计空看板默认提示语",
    "content": "为空白状态的看板添加友好的默认提示文案，引导用户开始创建第一张卡片",
    "confidence": 0.9,
    "suggestedTags": ["引导", "用户体验"]
  },
  "suggestions": [
    {
      "type": "creative",
      "content": "试试设计 2-3 个不同风格的提示文案？比如引导式、启发式",
      "priority": "high"
    }
  ]
}

用户："决定把启动页背景换成极简插画"
回应：
{
  "recognition": {
    "category": "decided",
    "title": "启动页背景：极简插画",
    "content": "已决定将启动页背景更换为极简风格的插画设计",
    "confidence": 0.95,
    "suggestedTags": ["设计", "视觉"]
  },
  "suggestions": [
    {
      "type": "summary",
      "content": "已归类为已决策。极简插画风格应该能很好地传达产品的简洁理念。",
      "priority": "medium"
    }
  ]
}`;

export interface AIAnalysisResult {
  recognition: AIRecognitionResult;
  suggestions: AISuggestion[];
}

export async function analyzeUserInput(
  input: string,
  apiKey: string,
  context?: {
    workstreamName?: string;
    cardCount?: number;
    openQuestions?: number;
  }
): Promise<AIAnalysisResult> {
  try {
    const systemPrompt = buildSystemPrompt(context);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        system: AI_RECOGNITION_PROMPT,
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: simple rule-based recognition
      return fallbackRecognition(input);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      recognition: parsed.recognition,
      suggestions: parsed.suggestions || [],
    };
  } catch (error) {
    console.error('AI recognition failed:', error);
    return fallbackRecognition(input);
  }
}

function fallbackRecognition(input: string): AIAnalysisResult {
  const lowerInput = input.toLowerCase();
  
  // Simple rule-based fallback
  let category: ContentCategory = 'note';
  
  if (lowerInput.includes('决定') || lowerInput.includes('确定') || lowerInput.includes('选定') || lowerInput.includes('换成')) {
    category = 'decided';
  } else if (lowerInput.includes('?') || lowerInput.includes('怎么') || lowerInput.includes('是否') || lowerInput.includes('什么')) {
    category = 'open_question';
  } else if (lowerInput.includes('需要') || lowerInput.includes('添加') || lowerInput.includes('设计') || lowerInput.includes('实现')) {
    category = 'todo';
  }

  return {
    recognition: {
      category,
      title: input.slice(0, 40) + (input.length > 40 ? '...' : ''),
      content: input,
      confidence: 0.6,
      suggestedTags: [],
    },
    suggestions: [
      {
        type: 'summary',
        content: `已识别为 ${category === 'decided' ? '已决策' : category === 'todo' ? '待办' : category === 'open_question' ? '待解决问题' : '笔记'}`,
        priority: 'medium',
      },
    ],
  };
}

export async function generateSmartSuggestions(
  cards: Card[],
  apiKey: string
): Promise<AISuggestion[]> {
  const cardSummary = cards.map(c => `[${c.category === 'decided' ? '已决策' : c.category === 'todo' ? '待办' : c.category === 'open_question' ? '待解决问题' : '笔记'}] ${c.title}`).join('\n');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: `${FLOWD_SOUL_PROMPT}

基于当前看板内容，生成智能建议。

用 JSON 回应：
{
  "suggestions": [
    {
      "type": "action",
      "content": "具体的下一步建议",
      "priority": "high|medium|low"
    }
  ]
}`,
        messages: [
          {
            role: 'user',
            content: `当前看板内容：\n${cardSummary}\n\n生成 2-3 个智能建议。`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.suggestions || [];
    }
  } catch (error) {
    console.error('Smart suggestion generation failed:', error);
  }

  return [];
}

export async function generateReEntryMessage(
  cards: Card[],
  lastSessionTime: number,
  apiKey: string
): Promise<string> {
  const hoursAgo = Math.floor((Date.now() - lastSessionTime) / (1000 * 60 * 60));
  
  const decidedCards = cards.filter(c => c.category === 'decided').slice(-3);
  const openQuestions = cards.filter(c => c.category === 'open_question').slice(-2);
  
  const decidedText = decidedCards.map(c => c.title).join('、');
  const questionsText = openQuestions.map(c => c.title).join('、');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        system: `${FLOWD_SOUL_PROMPT}

生成重新进入消息。少于 80 字。

结构：
1. 一句话关于已解决或转变的内容
2. 仍然开放的内容（1-2 件事）
3. 一个问题重新激活思考`,
        messages: [
          {
            role: 'user',
            content: `用户已离开 ${hoursAgo} 小时。

最近的决策：${decidedText || '无'}
待解决问题：${questionsText || '无'}

生成重新进入消息。`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  } catch (error) {
    // Fallback re-entry message
    if (decidedCards.length > 0) {
      return `自上次以来，我们确定了${decidedCards[0].title}。${openQuestions.length > 0 ? `仍在思考：${openQuestions[0].title}。` : ''}今天想从哪里开始？`;
    }
    return `欢迎回来。${openQuestions.length > 0 ? `我们还在探索：${openQuestions[0].title}。` : ''}今天想聊什么？`;
  }
}
