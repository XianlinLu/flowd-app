import { NextResponse } from 'next/server';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a123456789'; // Default placeholder

export async function GET(request: Request) {
  // 如果没有配置真实的飞书应用ID（使用的是默认占位符），为了防止页面报错（20028 app_id 请求不合法），
  // 我们在本地开发环境中直接模拟一次成功的飞书重定向跳转。
  if (FEISHU_APP_ID === 'cli_a123456789') {
    const mockCallbackUrl = new URL('/api/feishu/callback', request.url);
    mockCallbackUrl.searchParams.append('code', 'mock_dev_code');
    mockCallbackUrl.searchParams.append('state', 'flowd_login');
    return NextResponse.redirect(mockCallbackUrl.toString());
  }

  // 动态获取当前的请求域名作为回调地址
  const redirectUrl = new URL('/api/feishu/callback', request.url);
  const REDIRECT_URI = redirectUrl.toString();

  const feishuAuthUrl = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  
  feishuAuthUrl.searchParams.append('app_id', FEISHU_APP_ID);
  feishuAuthUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  feishuAuthUrl.searchParams.append('state', 'flowd_login');
  // 根据飞书官方文档，在 URL 中附加所需权限的 scope
  // 这里我们需要读写多维表格、文档、云空间，以及获取用户身份信息
  // 如果还需要其他权限，可以继续在这里追加，多个 scope 之间用空格分隔
  const scopes = 'bitable:app docx:document drive:drive auth:user.id:read';
  feishuAuthUrl.searchParams.append('scope', scopes);

  return NextResponse.redirect(feishuAuthUrl.toString());
}
