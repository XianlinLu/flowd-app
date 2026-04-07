import { NextResponse } from 'next/server';

export const runtime = 'edge'; // Force Edge Runtime for instant cold start
export const dynamic = 'force-dynamic'; // Prevent static generation

export async function POST(request: Request) {
  try {
    const text = await request.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ code: 0, msg: 'success' });
    }

    // 1. Feishu Event Verification Challenge
    if (body && body.type === 'url_verification') {
      return NextResponse.json({
        challenge: body.challenge
      });
    }

    // 2. Handle actual events
    return NextResponse.json({ code: 0, msg: 'success' });
    
  } catch (error) {
    return NextResponse.json({ code: 500, msg: 'Internal Server Error' }, { status: 500 });
  }
}
