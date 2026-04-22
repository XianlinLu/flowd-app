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
    const { feishuConfig, direction = 'import' } = body;

    // 从 cookies 中获取用户授权 token
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    if (!feishuConfig) {
      return NextResponse.json(
        { error: 'Feishu config is required' },
        { status: 400 }
      );
    }

    const client = getFeishuClient({ 
      userAccessToken // 传入用户 token，确保以用户身份执行
    });

    if (direction === 'export') {
      // Export cards to Feishu Bitable (Currently not deeply used by UI)
      if (feishuConfig.bindType === 'bitable' && feishuConfig.appToken && feishuConfig.tableId) {
        const cards = boardStore.getAllCards();
        const result = await client.syncCardsToBitable(feishuConfig.appToken, feishuConfig.tableId, cards, {
          batchSize: 100,
          maxRecords: 5000,
        });

        return NextResponse.json({
          success: true,
          direction: 'export',
          ...result,
        });
      }
      return NextResponse.json({ error: 'Export not supported for this config type' }, { status: 400 });
    } else {
      // Import / Pull data from Feishu
      if (feishuConfig.bindType === 'doc' && feishuConfig.documentId) {
        // Fetch document content
        const rawContent = await client.getDocumentContent(feishuConfig.documentId);
        return NextResponse.json({
          success: true,
          direction: 'import',
          type: 'doc',
          content: rawContent
        });
      } else if (feishuConfig.appToken && feishuConfig.tableId) {
        // Fetch from bitable
        const cards = await client.loadCardsFromBitable(feishuConfig.appToken, feishuConfig.tableId);
        return NextResponse.json({
          success: true,
          direction: 'import',
          type: 'bitable',
          cards: cards
        });
      }
      
      return NextResponse.json({ error: 'Invalid feishu config for import' }, { status: 400 });
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
