import { NextResponse } from 'next/server';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a123456789';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'your_app_secret';

// Helper function to get tenant access token
async function getTenantAccessToken() {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    })
  });
  const data = await response.json();
  return data.tenant_access_token;
}

export async function POST(request: Request) {
  try {
    const { receive_id, content, msg_type } = await request.json();
    // receive_id is the user's open_id or chat_id in Feishu
    
    if (!receive_id || !content) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const token = await getTenantAccessToken();
    if (!token) throw new Error('Failed to get Feishu token');

    // Feishu Send Message API (v1)
    const sendResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receive_id, // For user DMs, we use open_id. For groups, chat_id.
        msg_type: msg_type || 'text', // Can be 'text', 'interactive' (cards), 'post', etc.
        content: JSON.stringify(content) // content must be JSON stringified for Feishu
      })
    });

    const result = await sendResponse.json();
    
    if (result.code !== 0) {
      throw new Error(`Feishu API Error: ${result.msg}`);
    }

    return NextResponse.json({ success: true, message_id: result.data.message_id });
  } catch (error) {
    console.error('Feishu Send Message Error:', error);
    return NextResponse.json({ error: 'Failed to send message to Feishu' }, { status: 500 });
  }
}
