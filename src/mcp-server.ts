import { Server } from '@modelcontextprotocol/sdk/dist/server/index';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/dist/server/stdio';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/dist/types';
import { EagleClawAgent } from './agent';
import { logger } from './logger';

let agent: EagleClawAgent | null = null;

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'eagle-claw', version: '2.1.1' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'eagle_claw_connect',
        description: '连接到星联调度服务器，注册为执行节点',
        inputSchema: {
          type: 'object' as const,
          properties: {
            wsUrl: {
              type: 'string',
              description: '星联 WebSocket 地址 (默认: ws://localhost:8080)',
            },
          },
          required: [],
        },
      },
      {
        name: 'eagle_claw_status',
        description: '查看鹰爪节点当前状态',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'eagle_claw_execute',
        description: '手动提交任务到本地 OpenClaw 引擎执行',
        inputSchema: {
          type: 'object' as const,
          properties: {
            prompt: {
              type: 'string',
              description: '要执行的任务描述',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'eagle_claw_disconnect',
        description: '断开与星联的连接',
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'eagle_claw_connect': {
        if (agent) {
          return { content: [{ type: 'text', text: '⚠️ 鹰爪已在运行中' }] };
        }
        agent = new EagleClawAgent();
        await agent.start();
        return { content: [{ type: 'text', text: '🦅 鹰爪已连接到星联' }] };
      }

      case 'eagle_claw_status': {
        const status = agent ? '🟢 已连接' : '🔴 未连接';
        return { content: [{ type: 'text', text: `鹰爪状态: ${status}` }] };
      }

      case 'eagle_claw_execute': {
        const prompt = (args as Record<string, unknown>)?.prompt as string;
        if (!prompt) {
          return { content: [{ type: 'text', text: '❌ 缺少 prompt 参数' }] };
        }
        try {
          const { OpenClawClient } = await import('./openclaw-client');
          const client = new OpenClawClient();
          const result = await client.processTask(prompt);
          return { content: [{ type: 'text', text: result }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { content: [{ type: 'text', text: `❌ 执行失败: ${msg}` }] };
        }
      }

      case 'eagle_claw_disconnect': {
        if (!agent) {
          return { content: [{ type: 'text', text: '⚠️ 鹰爪未在运行' }] };
        }
        await agent.shutdown();
        agent = null;
        return { content: [{ type: 'text', text: '🦅 鹰爪已断开连接' }] };
      }

      default:
        return { content: [{ type: 'text', text: `❌ 未知工具: ${name}` }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.log('🦅 鹰爪 MCP Server 已启动 (stdio 模式)');
}
