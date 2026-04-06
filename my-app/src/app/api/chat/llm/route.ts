import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, Message } from '@/types/chat';
import { getLLMClient } from '@/lib/llm-client';
import { sessionManager } from '@/lib/session-manager';
import { getContextualPrompt } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, model, stream = true, sessionId } = body;

    let session = sessionId ? sessionManager.getSession(sessionId) : null;
    
    // If it's a one-off request (no sessionId provided), we can just use the provided messages directly
    // and skip session management to allow custom system prompts
    let allMessages: Message[] = [];
    
    if (sessionId) {
      if (!session) {
        session = sessionManager.createSession({
          workspaceName: 'Flowd 工作空间',
          cardCount: 0,
          openQuestions: 0,
        });
      }

      const userMessage = messages[messages.length - 1];
      if (userMessage && userMessage.role === 'user') {
        sessionManager.addMessage(session.id, {
          ...userMessage,
          id: `msg_${Date.now()}_user`,
          timestamp: Date.now(),
        });
      }

      const sessionMessages = sessionManager.getMessages(session.id);
      const contextualSystemPrompt = getContextualPrompt({
        workspaceName: session.metadata?.workspaceName,
        cardCount: session.metadata?.cardCount,
        openQuestions: session.metadata?.openQuestions,
      });

      allMessages = [
        {
          id: 'system',
          role: 'system',
          content: contextualSystemPrompt,
          timestamp: Date.now(),
        },
        ...sessionMessages.filter(m => m.role !== 'system'),
      ];
    } else {
      // One-off request without session tracking
      allMessages = messages;
    }

    const llmClient = getLLMClient(model ? { model } : undefined);

    if (stream) {
      const encoder = new TextEncoder();
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            let fullContent = '';
            const messageId = `msg_${Date.now()}_assistant`;
            const sid = session?.id || 'temp-session';
            
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'start', sessionId: sid, messageId })}\n\n`
              )
            );

            for await (const chunk of llmClient.streamChat(allMessages)) {
              fullContent += chunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`
                )
              );
            }

            if (session) {
              sessionManager.addMessage(session.id, {
                id: messageId,
                role: 'assistant',
                content: fullContent,
                timestamp: Date.now(),
              });
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'done', sessionId: sid })}\n\n`
              )
            );
            controller.close();
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'error', 
                  error: error instanceof Error ? error.message : 'Unknown error' 
                })}\n\n`
              )
            );
            controller.close();
          }
        },
      });

      return new NextResponse(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const content = await llmClient.chat(allMessages);
      const messageId = `msg_${Date.now()}_assistant`;

      if (session) {
        sessionManager.addMessage(session.id, {
          id: messageId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
        });
      }

      return NextResponse.json({
        message: {
          id: messageId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
        },
        sessionId: session?.id || 'temp-session',
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    messages: session.messages,
    metadata: session.metadata,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  const deleted = sessionManager.clearSession(sessionId);
  
  if (!deleted) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
