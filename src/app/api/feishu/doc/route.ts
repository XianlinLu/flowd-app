import { NextResponse, NextRequest } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id');

  if (!documentId) {
    return NextResponse.json({ error: 'Missing document_id' }, { status: 400 });
  }

  try {
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    const feishuClient = getFeishuClient({
      userAccessToken
    });
    
    // Get doc info
    const data = await feishuClient.getDocument(documentId);
    
    if (!data || !data.document) {
      throw new Error('Failed to get document info');
    }

    return NextResponse.json({ 
      name: data.document.title,
      documentId: data.document.document_id 
    });
  } catch (error) {
    console.error('Feishu doc API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch doc info' },
      { status: 500 }
    );
  }
}
