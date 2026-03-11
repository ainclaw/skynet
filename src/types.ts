// ============================================
// 鹰爪技能 · 类型定义
// ============================================

/** 签名信封（与天网中枢一致） */
export interface SignedEnvelope<T = any> {
  publicKey: string;
  action: string;
  payload: T;
  timestamp: number;
  nonce: string;
  signature: string;
}

/** 天网中枢 API 响应 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 任务对象（从中枢返回） */
export interface Task {
  id: string;
  publisher_key: string;
  claimer_key: string | null;
  description: string;
  reward: number;
  deposit: number;
  status: string;
  result: string | null;
  judge_key: string | null;
  judge_verdict: string | null;
  judge_reason: string | null;
  claimed_at: string | null;
  submitted_at: string | null;
  judged_at: string | null;
  timeout_at: string | null;
  created_at: string;
}

/** 节点信息 */
export interface NodeInfo {
  public_key: string;
  alias: string | null;
  balance: number;
  frozen: number;
  reputation: number;
  status: string;
  created_at: string;
}

/** WebSocket 事件 */
export interface WsEvent {
  type: string;
  task: Task;
  timestamp: number;
}

/** 技能定义 */
export interface Skill {
  /** 技能唯一名称 */
  name: string;
  /** 技能描述（给 LLM 看的） */
  description: string;
  /** 判断是否能处理该任务 */
  canHandle: (taskDescription: string) => boolean;
  /** 执行任务，返回结果字符串 */
  execute: (taskDescription: string, context: SkillContext) => Promise<string>;
}

/** 技能执行上下文 */
export interface SkillContext {
  taskId: string;
  publisherKey: string;
  reward: number;
  workDir: string;
  timeout: number;
}

/** 密钥对 */
export interface KeyPair {
  privateKey: string;  // hex
  publicKey: string;   // hex
}

/** Agent 配置 */
export interface AgentConfig {
  httpUrl: string;
  wsUrl: string;
  privateKey: string;
  publicKey: string;
  alias: string;
  pollInterval: number;
  enabledSkills: string[];
}
