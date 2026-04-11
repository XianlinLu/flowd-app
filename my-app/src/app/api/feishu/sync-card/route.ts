import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const { title, content, category } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const docTitle = `[${category}] ${title}`;
    
    // Call lark-cli securely using execFile
    const { stdout, stderr } = await execFileAsync('npx', [
      '@larksuite/cli',
      'docs',
      '+create',
      '--title',
      docTitle,
      '--markdown',
      content,
      '--format',
      'json'
    ]);
    
    // Try to parse the JSON output from lark-cli
    let docUrl = '';
    let docId = '';
    
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.url) {
          docUrl = result.url;
        }
        if (result.document_id || result.obj_token) {
          docId = result.document_id || result.obj_token;
        }
      }
    } catch (e) {
      console.error('Failed to parse lark-cli output as JSON', e);
    }

    return NextResponse.json({
      success: true,
      url: docUrl || '同步成功',
      docId,
      rawOutput: stdout
    });

  } catch (error: any) {
    console.error('Failed to sync card to Feishu:', error);
    // 提取命令执行的错误信息（如果有）
    const errorMessage = error.stderr || error.message || '未知错误';
    return NextResponse.json(
      { 
        error: '同步到飞书失败',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
