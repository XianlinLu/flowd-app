import { NextResponse } from 'next/server';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a123456789'; // Default placeholder
const REDIRECT_URI = process.env.NEXT_PUBLIC_URL 
  ? `${process.env.NEXT_PUBLIC_URL}/api/feishu/callback` 
  : 'http://localhost:3000/api/feishu/callback';

export async function GET(request: Request) {
  // 如果没有配置真实的飞书应用ID（使用的是默认占位符），为了防止页面报错（20028 app_id 请求不合法），
  // 我们在本地开发环境中直接模拟一次成功的飞书重定向跳转。
  if (FEISHU_APP_ID === 'cli_a123456789') {
    const mockCallbackUrl = new URL('/api/feishu/callback', request.url);
    mockCallbackUrl.searchParams.append('code', 'mock_dev_code');
    mockCallbackUrl.searchParams.append('state', 'flowd_login');
    return NextResponse.redirect(mockCallbackUrl.toString());
  }

  const feishuAuthUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/user_auth_page_beta');
  
  feishuAuthUrl.searchParams.append('app_id', FEISHU_APP_ID);
  feishuAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  feishuAuthUrl.searchParams.append('state', 'flowd_login');

  return NextResponse.redirect(feishuAuthUrl.toString());
}
