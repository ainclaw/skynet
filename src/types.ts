// ===== 星联通信协议类型 =====

export interface SkynetMessage {
  type: string;
  payload?: Record<string, unknown>;
  taskId?: string;
  timestamp?: number;
}

export interface TaskAssignment {
  taskId: string;
  type: string;
  payload: Record<string, unknown>;
  timeout?: number;
  priority?: number;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  executionTime?: number;
}

export interface NodeRegistration {
  nodeId: string;
  publicKey: string;
  capabilities: string[];
  signature: string;
  timestamp: number;
}

// ===== OpenClaw 本地交互类型 =====

export interface OpenClawStreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}
