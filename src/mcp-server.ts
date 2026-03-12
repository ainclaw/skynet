import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { EagleClawAgent } from './agent';
import { updateConfig } from './config';

let agent: EagleClawAgent | null = null;

function getOrCreateAgent(): EagleClawAgent {
  if (!agent) {
    agent = new EagleClawAgent();
  }
  return agent;
}

const TOOLS: Tool[] = [
  {
    name: 'eagle_claw_connect',
    description: '启动鹰爪(Eagle Claw)节点，连接星联(Skynet)调度系统并开始自动接收任务。可选传入星联地址和私钥。',
    inputSchema: {
      type: 'object',
      properties: {
        skynet_url: {
          type: 'string',
          description: '星联 WebSocket 地址，默认 ws://localhost:8080',
        },
        private_key: {
          type: 'string',
          description: 'Ed25519 私钥(Base64)，留空则自动生成临时身份',
        },
      },
    },
  },
  {
    name: 'eagle_claw_status',
    description: '查询鹰爪节点当前运行状态，包括连接状态、节点ID、活跃任务数、已加载能力列表和运行时长。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'eagle_claw_execute',
    description: '手动提交一个任务给星联执行。需要先调用 eagle_claw_connect 建立连接。',
    inputSchema: {
      type: 'object',
      properties: {
        task_type: {
          type: 'string',
          enum: ['search', 'coding', 'general'],
          description: '任务类型：search(搜索)、coding(编程)、general(通用)',
        },
        payload: {
          type: 'string',
          description: '任务内容，如搜索关键词或编程需求描述',
        },
      },
      required: ['task_type', 'payload'],
    },
  },
  {
    name: 'eagle_claw_disconnect',
    description: '断开鹰爪节点与星联的连接，停止接单。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'eagle_claw_connect': {
      if (args.skynet_url || args.private_key) {
        updateConfig({
          ...(args.skynet_url ? { SKYNET_WS_URL: args.skynet_url as string } : {}),
          ...(args.private_key ? { PRIVATE_KEY: args.private_key as string } : {}),
        });
      }

      const a = getOrCreateAgent();
      if (a.isConnected()) {
        return '鹰爪节点已处于连接状态，无需重复连接。';
      }

      try {
        const result = await a.start();
        return result;
      } catch (err) {
        return `连接失败: ${(err as Error).message}`;
      }
    }

    case 'eagle_claw_status': {
      const a = getOrCreateAgent();
      const status = a.getStatus();
      return JSON.stringify(status, null, 2);
    }

    case 'eagle_claw_execute': {
      const a = getOrCreateAgent();
      const taskType = (args.task_type as string) || 'general';
      const payload = (args.payload as string) || '';

      if (!payload) {
        return '错误: payload 不能为空';
      }

      try {
        const result = await a.submitTask(taskType, payload);
        return result;
      } catch (err) {
        return `任务执行失败: ${(err as Error).message}`;
      }
    }

    case 'eagle_claw_disconnect': {
      if (!agent) {
        return '节点未初始化，无需断开。';
      }
      const result = agent.disconnect();
      agent = null;
      return result;
    }

    default:
      return `未知工具: ${name}`;
  }
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: 'eagle-claw',
      version: '2.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await handleToolCall(name, (args as Record<string, unknown>) || {});
    return {
      content: [{ type: 'text' as const, text: result }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🦅 鹰爪 MCP Server 已启动 (stdio 模式)');
}
