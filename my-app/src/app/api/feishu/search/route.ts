import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, project, feishuConfig } = body;
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    if (!feishuConfig || !feishuConfig.appToken || !feishuConfig.tableId) {
      return NextResponse.json({ error: 'Project Feishu config is missing' }, { status: 400 });
    }

    const client = getFeishuClient({ userAccessToken });

    // Try to extract intent from query (e.g. round number, keywords)
    let targetRound = null;
    const roundMatch = query.match(/第(\d+)轮/);
    if (roundMatch) {
      targetRound = parseInt(roundMatch[1], 10);
    }

    // Build filter string
    let filterStr = `CurrentValue.[项目ID]="${project.id}"`;
    if (targetRound) {
      filterStr = `AND(${filterStr}, CurrentValue.[轮次 (Round)]=${targetRound})`;
    }

    const records = await client.listBitableRecords(feishuConfig.appToken, feishuConfig.tableId, {
      filter: filterStr,
      pageSize: 10 // limits recall
    });

    const formattedResults = records.map(r => ({
      title: r.fields['卡片标题'],
      category: r.fields['卡片类型'],
      summary: r.fields['内容摘要'],
      round: r.fields['轮次 (Round)'],
      tags: r.fields['检索关键词']?.split(',').map((t:string) => t.trim()).filter(Boolean) || [],
      docLink: r.fields['飞书文档链接']?.link || null
    }));

    return NextResponse.json({
      success: true,
      results: formattedResults
    });

  } catch (error) {
    console.error('Feishu search error:', error);
    return NextResponse.json(
      { error: 'Failed to search Feishu data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
