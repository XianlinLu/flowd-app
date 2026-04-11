import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';
import { Card } from '@/types/board';
import { generateEmbedding } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { card, project, feishuConfig } = body;
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    if (!feishuConfig) {
      return NextResponse.json({ error: 'Project Feishu config is missing' }, { status: 400 });
    }
    
    const isDocBind = feishuConfig.bindType === 'doc' && feishuConfig.documentId;
    const isBitableBind = feishuConfig.appToken && feishuConfig.tableId;

    if (!isDocBind && !isBitableBind) {
      return NextResponse.json({ error: 'Invalid Feishu config' }, { status: 400 });
    }

    const client = getFeishuClient({
      userAccessToken // Ensure we use the logged-in user's token
    });

    let documentUrl = '';

    // If it's a doc bind, we might just append content to the bound doc or do nothing 
    // depending on the product requirement. For now, we support creating new docs if folderToken exists.
    if (isDocBind) {
      // In a real app, you might append the card content to the bound document here.
      // For now, we just return success to not break the flow.
      return NextResponse.json({
        success: true,
        documentUrl: `https://www.feishu.cn/docx/${feishuConfig.documentId}`,
        recordId: 'doc_append'
      });
    }

    // If it's a long text card or specific type, create a Feishu Doc first
    const isLongText = card.category === 'prd' || card.category === 'meeting' || card.category === 'doc' || card.content.length > 200;
    
    if (isLongText && feishuConfig.folderToken) {
      const docTitle = `Flowd-${project.name}-轮次1-${card.title}`;
      const docResult = await client.createDocument(docTitle, card.content, feishuConfig.folderToken);
      documentUrl = docResult.url;
    }

    // Generate Embedding for RAG search
    const vectorString = JSON.stringify(await generateEmbedding(`${card.title}\n${card.content}`));

    // Prepare fields for Bitable
    const fields: any = {
      "项目ID": project.id,
      "轮次 (Round)": 1, // hardcoded for now, could be dynamic
      "卡片标题": card.title,
      "卡片类型": card.category,
      "内容摘要": card.content.substring(0, 100) + (card.content.length > 100 ? '...' : ''),
      "检索关键词": card.metadata?.tags?.join(', ') || '',
      "飞书文档链接": documentUrl ? { link: documentUrl, text: '查看文档' } : null,
      "向量特征": vectorString, // Store vector in Feishu Bitable (needs text field "向量特征")
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
