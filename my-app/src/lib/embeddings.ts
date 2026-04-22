import { OpenAI } from 'openai';

// We can reuse the LLM_API_KEY if it supports OpenAI-compatible embeddings 
// (like deepseek or others), or fallback to OpenAI
const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || 'dummy_key_for_build';
const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text) return [];
  
  try {
    // Trim text to avoid exceeding token limits for embedding models
    const trimmedText = text.substring(0, 8000);
    const response = await openai.embeddings.create({
      model: 'BAAI/bge-m3', // SiliconFlow 高性能开源多语言特征模型
      input: trimmedText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    // If embedding fails (e.g. no valid key for OpenAI), we return empty array
    // so the system gracefully falls back to keyword/filter search only.
    return [];
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
