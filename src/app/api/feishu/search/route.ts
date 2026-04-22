import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantContext } from "@/lib/rag/retriever";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, query, currentRound, feishuConfig, isSemantic = true } = body;
    
    // Auth context
    const userTokenCookie = req.cookies.get('feishu_token');
    const userAccessToken = userTokenCookie?.value;

    // Strict validation
    if (!projectId || !query || currentRound === undefined) {
      return NextResponse.json({ error: "缺少必要参数 (projectId, query, currentRound)" }, { status: 400 });
    }

    if (!feishuConfig) {
      return NextResponse.json({ error: "项目未绑定有效的飞书配置" }, { status: 403 });
    }

    if (feishuConfig.bindType === 'doc') {
      return NextResponse.json({
        success: true,
        results: [
          {
            title: '文档搜索暂未支持',
            category: 'note',
            summary: '当前绑定的云文档暂不支持 RAG 检索，后续将引入基于该文档内容的搜索能力。',
            round: 1
          }
        ]
      });
    }

    if (!feishuConfig.appToken || !feishuConfig.tableId) {
      return NextResponse.json({ error: "多维表格配置不完整" }, { status: 403 });
    }

    // Call retriever layer
    const results = await retrieveRelevantContext({
      projectId,
      query,
      currentRound,
      feishuConfig,
      userAccessToken,
      isSemantic,
      limit: 5,
    });

    return NextResponse.json({ success: true, results });

  } catch (err) {
    console.error("[RAG Retrieve Error]", err);
    return NextResponse.json(
      { error: "检索失败", details: err instanceof Error ? err.message : "未知错误" }, 
      { status: 500 }
    );
  }
}
