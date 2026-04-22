import { NextResponse } from 'next/server';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a123456789';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'your_app_secret';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // If no code, or there was an error in auth
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url));
  }

  // 本地无飞书配置时的 Mock 登录流程
  if (code === 'mock_dev_code' && FEISHU_APP_ID === 'cli_a123456789') {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.set('feishu_token', 'mock_token_for_dev', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    response.cookies.set('feishu_user', JSON.stringify({
        name: 'Flowd 体验用户',
        avatar_url: '',
        open_id: 'ou_mock_12345'
      }), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      });
      return response;
  }

  try {
    // 1. Get Tenant Access Token (app_access_token)
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    });
    const tokenData = await tokenResponse.json();
    const tenantAccessToken = tokenData.tenant_access_token;

    if (!tenantAccessToken) {
      throw new Error('Failed to get tenant_access_token');
    }

    // 2. Exchange authorization code for user access token
    const userTokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${tenantAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code
      })
    });
    
    const userTokenData = await userTokenResponse.json();

    if (userTokenData.code !== 0) {
      throw new Error(`Feishu API Error: ${userTokenData.msg}`);
    }

    const { access_token } = userTokenData.data;

    // 3. Fetch User Info using the user access token
    const userInfoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userInfoData = await userInfoResponse.json();

    if (userInfoData.code !== 0) {
      throw new Error(`Feishu User Info Error: ${userInfoData.msg}`);
    }

    const { name, avatar_url, open_id } = userInfoData.data;

    // 4. Set up the user session
    // For a real app, you'd create a JWT. Here we'll store a simple session object in cookies for demonstration
    const sessionData = JSON.stringify({
      access_token,
      name,
      avatar_url,
      open_id
    });

    const response = NextResponse.redirect(new URL('/', request.url));
    
    // Set a secure, HTTP-only cookie with the user session
    response.cookies.set('feishu_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // We can also store user info in a separate non-httpOnly cookie to access from the client
    response.cookies.set('feishu_user', sessionData, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error) {
    console.error('Feishu OAuth Error:', error);
    // In dev mode without real keys, just simulate a successful login
    if (process.env.NODE_ENV === 'development' && FEISHU_APP_ID === 'cli_a123456789') {
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('feishu_token', 'mock_token_for_dev', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      });
      response.cookies.set('feishu_user', encodeURIComponent(JSON.stringify({
        name: 'Feishu User',
        avatar_url: '',
        open_id: 'ou_12345'
      })), {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 7
      });
      return response;
    }

    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }
}
