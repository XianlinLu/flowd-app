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

    if (!feishuConfig || !feishuConfig.appToken || !feishuConfig.tableId) {
      return NextResponse.json({ error: "项目未绑定有效的飞书配置" }, { status: 403 });
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
