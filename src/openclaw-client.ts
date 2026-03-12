import { McpTool, OpenClawStreamEvent } from './types';
import { CONFIG } from './config';

export class OpenClawClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = CONFIG.OPENCLAW_API_URL.replace(/\/$/, '');
  }

  async getCapabilities(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/v1/mcp/tools`;
      console.log(`Connecting to OpenClaw at: ${url}`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { tools: McpTool[] };
      return data.tools.map((t) => t.name);
    } catch (error) {
      console.error('❌ 无法连接 OpenClaw 引擎。请确认它已在本地启动。');
      console.error(` 错误详情: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async executeTask(
    prompt: string,
    onUpdate: (event: OpenClawStreamEvent) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenClaw Execution Failed: ${response.statusText}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of response.body as any) {
      const text = decoder.decode(chunk as BufferSource, { stream: true });
      buffer += text;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') return;

          try {
            const event: OpenClawStreamEvent = JSON.parse(jsonStr);
            onUpdate(event);
          } catch (e) {
            console.warn('⚠️ SSE JSON Parse Error:', jsonStr);
          }
        }
      }
    }
  }
}
