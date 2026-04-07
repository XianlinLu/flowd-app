import { getFeishuClient } from '@/lib/feishu-client';
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings';

interface RetrieveParams {
  projectId: string;
  query: string;
  currentRound: number;
  limit?: number;
  feishuConfig: {
    appToken: string;
    tableId: string;
  };
  userAccessToken?: string;
  isSemantic?: boolean;
}

export async function retrieveRelevantContext(params: RetrieveParams) {
  const { projectId, query, currentRound, limit = 5, feishuConfig, userAccessToken, isSemantic = true } = params;

  const client = getFeishuClient({ userAccessToken });

  // Try to extract intent from query (e.g. round number, keywords)
  let targetRound = null;
  const roundMatch = query.match(/第(\d+)轮/);
  if (roundMatch) {
    targetRound = parseInt(roundMatch[1], 10);
  }

  // Build filter string for Feishu Bitable
  let filterStr = `CurrentValue.[项目ID]="${projectId}"`;
  if (targetRound) {
    filterStr = `AND(${filterStr}, CurrentValue.[轮次 (Round)]=${targetRound})`;
  }

  // Fetch records from Feishu (max 100 for lightweight RAG context)
  const records = await client.listBitableRecords(feishuConfig.appToken, feishuConfig.tableId, {
    filter: filterStr,
    pageSize: 100 
  });

  let formattedResults: any[] = records.map(r => ({
    id: r.recordId,
    title: r.fields['卡片标题'],
    category: r.fields['卡片类型'],
    summary: r.fields['内容摘要'],
    round: r.fields['轮次 (Round)'],
    tags: r.fields['检索关键词']?.split(',').map((t:string) => t.trim()).filter(Boolean) || [],
    docLink: r.fields['飞书文档链接']?.link || null,
    vector: r.fields['向量特征'] ? JSON.parse(r.fields['向量特征']) : []
  }));

  // If semantic search is enabled, rank by vector similarity
  if (isSemantic) {
    const queryVector = await generateEmbedding(query);
    if (queryVector.length > 0) {
      formattedResults = formattedResults.map(r => ({
        ...r,
        score: r.vector.length > 0 ? cosineSimilarity(queryVector, r.vector) : 0
      })).sort((a, b) => (b.score || 0) - (a.score || 0));
      
      // Filter out low relevance and limit
      formattedResults = formattedResults.filter(r => (r.score || 0) > 0.5).slice(0, limit);
    } else {
      // Fallback if embedding failed
      formattedResults = formattedResults.slice(0, limit);
    }
  } else {
    // Basic filter search
    formattedResults = formattedResults.slice(0, limit);
  }

  // Remove vector data from response to save bandwidth
  return formattedResults.map(({ vector, ...rest }) => rest);
}
