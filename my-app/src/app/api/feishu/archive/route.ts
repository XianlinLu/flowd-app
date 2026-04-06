import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';
import { Card } from '@/types/board';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { card, project, feishuConfig } = body;
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    if (!feishuConfig || !feishuConfig.appToken || !feishuConfig.tableId) {
      return NextResponse.json({ error: 'Project Feishu config is missing' }, { status: 400 });
    }

    const client = getFeishuClient({
      userAccessToken // Ensure we use the logged-in user's token
    });

    let documentUrl = '';

    // If it's a long text card or specific type, create a Feishu Doc first
    const isLongText = card.category === 'prd' || card.category === 'meeting' || card.category === 'doc' || card.content.length > 200;
    
    if (isLongText && feishuConfig.folderToken) {
      const docTitle = `Flowd-${project.name}-轮次1-${card.title}`;
      const docResult = await client.createDocument(docTitle, card.content, feishuConfig.folderToken);
      documentUrl = docResult.url;
    }

    // Prepare fields for Bitable
    const fields: any = {
      "项目ID": project.id,
      "轮次 (Round)": 1, // hardcoded for now, could be dynamic
      "卡片标题": card.title,
      "卡片类型": card.category,
      "内容摘要": card.content.substring(0, 100) + (card.content.length > 100 ? '...' : ''),
      "检索关键词": card.metadata?.tags?.join(', ') || '',
      "飞书文档链接": documentUrl ? { link: documentUrl, text: '查看文档' } : null,
      "生成时间": card.createdAt
    };

    // Remove null fields
    if (!fields["飞书文档链接"]) delete fields["飞书文档链接"];

    const recordResult = await client.createBitableRecord(feishuConfig.appToken, feishuConfig.tableId, fields);

    return NextResponse.json({
      success: true,
      documentUrl,
      recordId: recordResult.recordId
    });

  } catch (error) {
    console.error('Feishu archive error:', error);
    return NextResponse.json(
      { error: 'Failed to archive to Feishu', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
