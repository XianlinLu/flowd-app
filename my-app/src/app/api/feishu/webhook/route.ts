import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Feishu Event Verification Challenge
    // When you register the webhook URL in Feishu Developer Console, 
    // Feishu sends a challenge to verify the endpoint.
    if (body.type === 'url_verification') {
      return NextResponse.json({
        challenge: body.challenge
      });
    }

    // 2. Handle actual events (e.g., im.message.receive_v1)
    const event = body.header?.event_type;
    
    if (event === 'im.message.receive_v1') {
      const message = body.event?.message;
      const sender = body.event?.sender;
      
      console.log(`Received message from Feishu user ${sender?.sender_id?.open_id}:`, message?.content);
      
      // TODO: Map this message to Flowd's boardStore or trigger an AI reply
      // In a real implementation, you would:
      // 1. Find the corresponding project/board
      // 2. Add the message as a card or chat context
      // 3. Potentially trigger the AI to respond via WebSocket or store in DB
    }

    // Return 200 OK so Feishu knows we received it
    return NextResponse.json({ code: 0, msg: 'success' });
    
  } catch (error) {
    console.error('Feishu Webhook Error:', error);
    return NextResponse.json({ code: 500, msg: 'Internal Server Error' }, { status: 500 });
  }
}
