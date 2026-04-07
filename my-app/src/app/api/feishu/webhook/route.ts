import { NextResponse } from 'next/server';
import { getFeishuClient } from '@/lib/feishu-client';
import { retrieveRelevantContext } from '@/lib/rag/retriever';
import { getLLMClient } from '@/lib/llm-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Feishu Event Verification Challenge
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
      
      const rawContent = message?.content;
      if (!rawContent) return NextResponse.json({ code: 0, msg: 'success' });
      
      // Feishu text message content is JSON stringified: '{"text":"query"}'
      let userQuery = '';
      try {
        const parsed = JSON.parse(rawContent);
        userQuery = parsed.text || '';
        // Clean up @bot mentions
        userQuery = userQuery.replace(/@_user_\d+/g, '').trim();
      } catch (e) {
        userQuery = rawContent;
      }

      console.log(`[Feishu Bot] Received query: "${userQuery}" from ${sender?.sender_id?.open_id}`);

      // Fire and forget async processing so Feishu gets 200 immediately
      processBotMessage(message.message_id, userQuery).catch(e => {
        console.error('[Feishu Bot] Background processing error:', e);
      });
    }

    return NextResponse.json({ code: 0, msg: 'success' });
    
  } catch (error) {
    console.error('Feishu Webhook Error:', error);
    return NextResponse.json({ code: 500, msg: 'Internal Server Error' }, { status: 500 });
  }
}

async function processBotMessage(messageId: string, query: string) {
  const feishuClient = getFeishuClient();
  
  // 1. Trigger RAG retrieval
  let injectedContext = '';
  if (query.length > 2) {
    try {
      const results = await retrieveRelevantContext({
        projectId: 'flowd_mock_project', // Assuming a global default or look up from DB
        query,
        currentRound: 1,
        isSemantic: true,
        feishuConfig: {
          appToken: process.env.FEISHU_DEFAULT_APP_TOKEN || 'F49FbA8Yha2eX6ssqYecx1tknEd',
          tableId: process.env.FEISHU_DEFAULT_TABLE_ID || 'tblXXX'
        }
      });

      if (results && results.length > 0) {
        injectedContext = `\n\n[来自轻量化 RAG 的历史思考资产]:\n${results.map((r:any) => `- 轮次 ${r.round || 1} 的 ${r.category}: ${r.title}。内容摘要: ${r.summary}`).join('\n')}\n(提示: 你可以引用这些历史内容并标注“来自 Round X”以强化跨轮次记忆)`;
      }
    } catch (e) {
      console.error('[Feishu Bot] RAG Retrieval Failed:', e);
    }
  }

  // 2. Build LLM Prompt
  let systemPrompt = `你是 Flowd AI，一个接入在飞书机器人中的思考伙伴。保持直接、具体、诚实的风格。短句，没有废话。`;
  if (injectedContext) {
    systemPrompt += injectedContext;
  }

  const messages: import('@/types/chat').Message[] = [
    { role: 'system', content: systemPrompt, id: 'sys', timestamp: Date.now() },
    { role: 'user', content: query, id: 'user', timestamp: Date.now() }
  ];

  // 3. Call LLM
  const llmClient = getLLMClient();
  const replyContent = await llmClient.chat(messages);

  // 4. Send reply back to Feishu
  await feishuClient.replyMessage(messageId, replyContent);
}
