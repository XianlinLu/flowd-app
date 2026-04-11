import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';

export async function POST(request: NextRequest) {
  try {
    const { title, content, category } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const docTitle = `[${category}] ${title}`;
    
    // 获取用户在前端登录时设置的 cookie (或者我们可以从环境变量拿 tenant token 降级处理)
    // 注意: Vercel 部署上，lark-cli (npx) 是无法运行的，必须走 API。
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    const client = getFeishuClient({ 
      userAccessToken 
    });

    // 调用 FeishuClient 原生的 createDocument 接口
    const result = await client.createDocument(docTitle, content);

    return NextResponse.json({
      success: true,
      url: result.url || '同步成功',
      docId: result.documentId
    });

  } catch (error: any) {
    console.error('Failed to sync card to Feishu:', error);
    // 提取命令执行的错误信息（如果有）
    const errorMessage = error.stderr || error.message || '未知错误';
    
    let friendlyError = errorMessage;
    if (errorMessage.includes('App ID and Secret are required') || errorMessage.includes('Failed to get Feishu access token')) {
      friendlyError = '未配置飞书 App ID/Secret，或未能成功获取飞书授权 Token，请检查后台配置。';
    }

    return NextResponse.json(
      { 
        error: '同步到飞书失败',
        details: friendlyError 
      },
      { status: 500 }
    );
  }
}
