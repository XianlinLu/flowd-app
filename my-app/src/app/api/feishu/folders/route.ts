import { NextRequest, NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';

export async function GET(request: NextRequest) {
  try {
    const userTokenCookie = request.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    const client = getFeishuClient({ 
      userAccessToken 
    });

    const folders = await client.getFolders();

    return NextResponse.json({
      success: true,
      folders
    });

  } catch (error: any) {
    console.error('Failed to get Feishu folders:', error);
    return NextResponse.json(
      { 
        error: '获取飞书文件夹失败',
        details: error.message || '未知错误' 
      },
      { status: 500 }
    );
  }
}
