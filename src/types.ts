export interface SkynetTask {
  id: string;
  type: string;
  payload: any;
}

export interface McpTool {
  name: string;
  description: string;
}

export interface OpenClawStreamEvent {
  status: 'thinking' | 'tool_call' | 'done' | 'error';
  content?: string;
  usage?: { total_tokens: number };
}

// 鹰爪节点状态
export interface EagleClawStatus {
  connected: boolean;
  nodeId: string | null;
  activeTaskCount: number;
  capabilities: string[];
  uptime: number;
}

// MCP 工具调用参数
export interface EagleClawConnectParams {
  skynet_url?: string;
  private_key?: string;
}

export interface EagleClawExecuteParams {
  task_type: 'search' | 'coding' | 'general';
  payload: string;
}
