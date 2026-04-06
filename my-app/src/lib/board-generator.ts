import { CardType, ContentCategory } from '@/types/board';
import { ExtractedCard, BoardGenerationResponse, BOARD_GENERATION_PROMPT } from './board-prompts';
import { boardStore } from './board-store';

const typeToCategory: Record<CardType, ContentCategory> = {
  'decision': 'decided',
  'todo': 'todo',
  'question': 'open_question',
  'note': 'note',
  'doc': 'note',
  'meeting': 'meeting',
  'prd': 'prd',
  'bug': 'bug',
  'bookmark': 'bookmark'
};

export async function generateCardsFromMessage(
  message: string,
  apiKey: string
): Promise<ExtractedCard[]> {
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
        max_tokens: 4096,
        system: BOARD_GENERATION_PROMPT,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON found in response:', content);
      return [];
    }

    const parsed: BoardGenerationResponse = JSON.parse(jsonMatch[0]);
    return parsed.cards || [];
  } catch (error) {
    console.error('Failed to generate cards:', error);
    return [];
  }
}

export function addCardsToBoard(cards: ExtractedCard[], sourceMessageId?: string) {
  const addedCards = [];

  for (const card of cards) {
    const category = typeToCategory[card.type] || 'note';
    const newCard = boardStore.addCard(category, {
      title: card.title,
      content: card.content,
      sourceMessageId,
      metadata: card.metadata,
    });
    if (newCard) {
      addedCards.push(newCard);
    }
  }

  return addedCards;
}

export async function processMessageAndGenerateCards(
  message: string,
  apiKey: string,
  sourceMessageId?: string
) {
  const extractedCards = await generateCardsFromMessage(message, apiKey);
  const addedCards = addCardsToBoard(extractedCards, sourceMessageId);
  
  return {
    extracted: extractedCards,
    added: addedCards,
  };
}
