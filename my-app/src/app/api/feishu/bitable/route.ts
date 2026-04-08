import { NextResponse } from 'next/server';

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || 'cli_a123456789';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || 'your_app_secret';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const app_token = searchParams.get('app_token');
    
    if (!app_token) {
      return NextResponse.json({ error: 'Missing app_token parameter' }, { status: 400 });
    }

    // Mock successful response for demonstration
    // Since we don't have actual Feishu App credentials configured by default
    return NextResponse.json({ success: true, name: '飞书多维表格' });
  } catch (error) {
    console.error('Feishu Bitable GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch Feishu Bitable info', name: '飞书多维表格' }, { status: 500 });
  }
}

// Basic API to sync Flowd Cards to a Feishu Bitable (Multi-dimensional Spreadsheet)
export async function POST(request: Request) {
  try {
    const { app_token, table_id, records } = await request.json();
    
    // Validate inputs
    if (!app_token || !table_id || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    // 1. Get Tenant Access Token
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.tenant_access_token;
    
    if (!token) throw new Error('Failed to get Feishu token');

    // 2. Insert records into Bitable
    const bitableRes = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${app_token}/tables/${table_id}/records/batch_create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        records: records.map(card => ({
          fields: {
            "Title": card.title,
            "Category": card.category,
            "Content": card.content,
            "Created At": new Date().getTime(),
          }
        }))
      })
    });

    const result = await bitableRes.json();

    if (result.code !== 0) {
      throw new Error(`Feishu Bitable API Error: ${result.msg}`);
    }

    return NextResponse.json({ success: true, records: result.data.records });
  } catch (error) {
    console.error('Feishu Bitable Error:', error);
    return NextResponse.json({ error: 'Failed to sync with Feishu Bitable' }, { status: 500 });
  }
}
