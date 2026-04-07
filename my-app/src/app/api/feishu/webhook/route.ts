import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Feishu Event Verification Challenge
    if (body.type === 'url_verification') {
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
