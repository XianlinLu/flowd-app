import { Card } from '@/types/board';

export interface FeishuConfig {
  appId?: string;
  appSecret?: string;
  baseUrl?: string;
  userAccessToken?: string; // 支持传入用户授权的 token
}

export interface FeishuDocument {
  title: string;
  content: string;
  documentId: string;
  url: string;
  lastModified: number;
}

export interface FeishuBitable {
  name: string;
  appToken: string;
  tables: FeishuTable[];
}

export interface FeishuTable {
  name: string;
  tableId: string;
  records: FeishuRecord[];
}

export interface FeishuRecord {
  recordId: string;
  fields: Record<string, any>;
  createdTime: number;
  updatedTime: number;
}

export class FeishuClient {
  private config: FeishuConfig;
  private tenantAccessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: FeishuConfig) {
    this.config = {
      baseUrl: 'https://open.feishu.cn/open-apis',
      ...config,
    };
  }

  private async getTenantAccessToken(): Promise<string> {
    if (this.tenantAccessToken && Date.now() < this.tokenExpiry) {
      return this.tenantAccessToken;
    }

    if (!this.config.appId || !this.config.appSecret) {
      throw new Error('App ID and Secret are required for tenant access token');
    }

    const response = await fetch(`${this.config.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: this.config.appId,
        app_secret: this.config.appSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get Feishu access token: ${response.status}`);
    }

    const data = await response.json();
    this.tenantAccessToken = data.tenant_access_token;
    this.tokenExpiry = Date.now() + (data.expire - 60) * 1000;
    
    return this.tenantAccessToken!;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    // 优先使用用户的 user_access_token，如果没有则回退使用 tenant_access_token
    const token = this.config.userAccessToken || await this.getTenantAccessToken();
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Feishu API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async replyMessage(messageId: string, content: string): Promise<any> {
    return this.request(`/im/v1/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({
        content: JSON.stringify({ text: content }),
        msg_type: 'text',
      }),
    });
  }

  // Document Operations
  async getDocument(documentId: string): Promise<{ document: { title: string; document_id: string } }> {
    const response = await this.request(`/docx/v1/documents/${documentId}`);
    return response.data;
  }

  async createDocument(title: string, content?: string, folderToken?: string): Promise<FeishuDocument> {
    const response = await this.request('/docx/v1/documents', {
      method: 'POST',
      body: JSON.stringify({
        title,
        folder_token: folderToken || '',
      }),
    });

    const documentId = response.data.document.document_id;

    if (content) {
      await this.updateDocumentContent(documentId, content);
    }

    return {
      title,
      content: content || '',
      documentId,
      url: `https://www.feishu.cn/docx/${documentId}`,
      lastModified: Date.now(),
    };
  }

  async updateDocumentContent(documentId: string, content: string): Promise<void> {
    const blocks = this.contentToBlocks(content);
    await this.request(`/docx/v1/documents/${documentId}/blocks`, {
      method: 'POST',
      body: JSON.stringify({
        children: blocks,
      }),
    });
  }

  async getDocumentContent(documentId: string): Promise<string> {
    const response = await this.request(`/docx/v1/documents/${documentId}/blocks`);
    return this.blocksToContent(response.data.items);
  }

  // Bitable Operations
  async getBitableInfo(appToken: string): Promise<{ app: { name: string } }> {
    const response = await this.request(`/bitable/v1/apps/${appToken}`);
    return response.data;
  }

  async listBitableRecords(appToken: string, tableId: string, options?: {
    viewId?: string;
    filter?: string;
    pageSize?: number;
    pageToken?: string;
  }): Promise<FeishuRecord[]> {
    const params = new URLSearchParams();
    if (options?.viewId) params.append('view_id', options.viewId);
    if (options?.filter) params.append('filter', options.filter);
    if (options?.pageSize) params.append('page_size', options.pageSize.toString());
    if (options?.pageToken) params.append('page_token', options.pageToken);

    const response = await this.request(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params.toString()}`
    );

    return (response.data.items || []).map((item: any) => ({
      recordId: item.record_id,
      fields: item.fields,
      createdTime: new Date(item.created_time).getTime(),
      updatedTime: new Date(item.last_modified_time).getTime(),
    }));
  }

  async createBitableRecord(appToken: string, tableId: string, fields: Record<string, any>): Promise<FeishuRecord> {
    const response = await this.request(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      {
        method: 'POST',
        body: JSON.stringify({ fields }),
      }
    );

    return {
      recordId: response.data.record.record_id,
      fields: response.data.record.fields,
      createdTime: Date.now(),
      updatedTime: Date.now(),
    };
  }

  async updateBitableRecord(
    appToken: string,
    tableId: string,
    recordId: string,
    fields: Record<string, any>
  ): Promise<FeishuRecord> {
    const response = await this.request(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ fields }),
      }
    );

    return {
      recordId: response.data.record.record_id,
      fields: response.data.record.fields,
      createdTime: Date.now(),
      updatedTime: Date.now(),
    };
  }

  // Card to Feishu sync
  async syncCardsToBitable(
    appToken: string,
    tableId: string,
    cards: Card[],
    options?: {
      batchSize?: number;
      maxRecords?: number;
    }
  ): Promise<{ synced: number; failed: number }> {
    const batchSize = options?.batchSize || 100;
    const maxRecords = options?.maxRecords || 5000;
    
    let synced = 0;
    let failed = 0;

    // Get existing records to avoid duplicates
    const existingRecords = await this.listBitableRecords(appToken, tableId, {
      pageSize: maxRecords,
    });
    
    const existingCardIds = new Set(
      existingRecords
        .filter(r => r.fields.card_id)
        .map(r => r.fields.card_id)
    );

    // Filter new cards
    const newCards = cards.filter(c => !existingCardIds.has(c.id)).slice(0, maxRecords - existingRecords.length);

    // Batch create records
    for (let i = 0; i < newCards.length; i += batchSize) {
      const batch = newCards.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (card) => {
          try {
            await this.createBitableRecord(appToken, tableId, this.cardToFields(card));
            synced++;
          } catch (error) {
            console.error(`Failed to sync card ${card.id}:`, error);
            failed++;
          }
        })
      );
    }

    return { synced, failed };
  }

  async loadCardsFromBitable(appToken: string, tableId: string): Promise<Card[]> {
    const records = await this.listBitableRecords(appToken, tableId, {
      pageSize: 500,
    });

    return records.map(r => this.fieldsToCard(r));
  }

  // Helper methods
  private contentToBlocks(content: string): any[] {
    // Simple text to Feishu blocks conversion
    const paragraphs = content.split('\n\n');
    return paragraphs.map(p => ({
      block_type: 'paragraph',
      paragraph: {
        elements: [
          {
            text_run: {
              content: p,
            },
          },
        ],
      },
    }));
  }

  private blocksToContent(blocks: any[]): string {
    // Convert Feishu blocks to plain text. Feishu blocks structure can vary deeply.
    if (!blocks || !Array.isArray(blocks)) return '';
    let content = '';
    for (const b of blocks) {
      if (b.block_type === 1) { // Text
        const elements = b.text?.elements || [];
        content += elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 2) { // Heading 1
        const elements = b.heading1?.elements || [];
        content += '# ' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 3) { // Heading 2
        const elements = b.heading2?.elements || [];
        content += '## ' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 4) { // Heading 3
        const elements = b.heading3?.elements || [];
        content += '### ' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 12) { // Bullet list
        const elements = b.bullet?.elements || [];
        content += '- ' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 13) { // Ordered list
        const elements = b.ordered?.elements || [];
        content += '1. ' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
      } else if (b.block_type === 14) { // Code block
        const elements = b.code?.elements || [];
        content += '```\n' + elements.map((e: any) => e.text_run?.content || '').join('') + '\n```\n';
      } else {
        // Try fallback parsing for other block types
        const key = Object.keys(b).find(k => typeof b[k] === 'object' && b[k]?.elements);
        if (key) {
          content += b[key].elements.map((e: any) => e.text_run?.content || '').join('') + '\n';
        }
      }
    }
    return content.trim();
  }

  private cardToFields(card: Card): Record<string, any> {
    return {
      card_id: card.id,
      type: card.type,
      title: card.title,
      content: card.content,
      created_at: card.createdAt,
      updated_at: card.updatedAt,
      tags: card.metadata?.tags?.join(', ') || '',
      priority: card.metadata?.priority || '',
      category: card.category || '',
    };
  }

  private fieldsToCard(record: FeishuRecord): Card {
    const fields = record.fields;
    return {
      id: fields.card_id || record.recordId,
      type: fields.type || 'note',
      category: fields.category || 'note',
      title: fields.title || '',
      content: fields.content || '',
      createdAt: fields.created_at || record.createdTime,
      updatedAt: fields.updated_at || record.updatedTime,
      status: 'synced',
      metadata: {
        tags: fields.tags?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
        priority: fields.priority || undefined,
      },
    };
  }
}

// Singleton instance
let feishuClient: FeishuClient | null = null;

export function getFeishuClient(config?: FeishuConfig): FeishuClient {
  const mergedConfig = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    ...config
  };
  
  if (!feishuClient) {
    feishuClient = new FeishuClient(mergedConfig);
  } else if (config?.userAccessToken) {
    // If client exists but we have a new user token, update it
    // Note: To avoid mutating a true singleton across different user requests in a concurrent environment,
    // it's actually safer to create a new instance or just pass the token. 
    // Since this is serverless/edge, we should just return a new instance if we have a userAccessToken
    // or update the config. Let's return a new instance to be safe.
    return new FeishuClient(mergedConfig);
  }
  return feishuClient;
}
