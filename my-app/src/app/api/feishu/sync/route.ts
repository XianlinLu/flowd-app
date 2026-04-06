import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';
import { boardStore } from '@/lib/board-store';
import { ContentCategory, CardType } from '@/types/board';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appSecret, appToken, tableId, direction = 'export' } = body;

    // 从 cookies 中获取用户授权 token
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Feishu credentials required' },
        { status: 400 }
      );
    }

    const client = getFeishuClient({ 
      appId, 
      appSecret,
      userAccessToken // 传入用户 token，确保以用户身份执行
    });

    if (direction === 'export') {
      // Export cards to Feishu Bitable
      const cards = boardStore.getAllCards();
      const result = await client.syncCardsToBitable(appToken, tableId, cards, {
        batchSize: 100,
        maxRecords: 5000,
      });

      return NextResponse.json({
        success: true,
        direction: 'export',
        ...result,
      });
    } else {
      // Import cards from Feishu Bitable
      const cards = await client.loadCardsFromBitable(appToken, tableId);
      
      // Add imported cards to board
      let imported = 0;
      for (const card of cards) {
        const category = typeToCategory[card.type] || 'note';
        const added = boardStore.addCard(category, {
          title: card.title,
          content: card.content,
          metadata: card.metadata,
        });
        if (added) imported++;
      }

      return NextResponse.json({
        success: true,
        direction: 'import',
        imported,
      });
    }
  } catch (error) {
    console.error('Feishu sync error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync with Feishu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
