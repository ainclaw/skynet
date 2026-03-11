// ============================================
// 鹰爪技能 · 天网中枢通信客户端
// ============================================

import { request } from 'undici';
import WebSocket from 'ws';
import { signEnvelope } from './identity.js';
import type { ApiResponse, Task, NodeInfo, WsEvent, AgentConfig } from './types.js';

type WsEventHandler = (event: WsEvent) => void;

export class SkynetClient {
  private config: AgentConfig;
  private ws: WebSocket | null = null;
  private wsHandlers: Map<string, WsEventHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private alive = true;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // ==========================================
  // HTTP 层
  // ==========================================

  /** 通用签名请求 */
  private async post<T = any>(path: string, action: string, payload: any = {}): Promise<ApiResponse<T>> {
    const envelope = await signEnvelope(
      this.config.privateKey,
      this.config.publicKey,
      action,
      payload,
    );

    const url = `${this.config.httpUrl}${path}`;

    try {
      const res = await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      const body = await res.body.json() as ApiResponse<T>;
      return body;
    } catch (err: any) {
      console.error(`[CLIENT] POST ${path} failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /** 注册节点 - 支持邀请人 */
  async register(referredBy?: string): Promise<ApiResponse<{ message: string; node: NodeInfo; inviteLink?: string }>> {
    const payload: any = { alias: this.config.alias };
    if (referredBy) {
      payload.referredBy = referredBy;
    }
    return this.post('/api/register', 'register', payload);
  }

  /** 查询余额 */
  async getBalance(): Promise<ApiResponse<{ balance: number; frozen: number; available: number; reputation: number }>> {
    return this.post('/api/balance', 'balance');
  }

  /** 查看任务列表 */
  async listTasks(status?: string, limit = 50): Promise<ApiResponse<{ tasks: Task[]; count: number }>> {
    return this.post('/api/tasks/list', 'list_tasks', { status, limit });
  }

  /** 查看任务详情 */
  async getTaskDetail(taskId: string): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/detail', 'task_detail', { taskId });
  }

  /** 抢单 */
  async claimTask(taskId: string): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/claim', 'claim_task', { taskId });
  }

  /** 提交成果 */
  async submitTask(taskId: string, result: string): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/submit', 'submit_task', { taskId, result });
  }

  /** 发布任务 */
  async postTask(description: string, reward: number): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/post', 'post_task', { description, reward });
  }

  /** 评审任务 */
  async judgeTask(taskId: string, verdict: 'approve' | 'reject', reason: string): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/judge', 'judge_task', { taskId, verdict, reason });
  }

  /** 取消任务 */
  async cancelTask(taskId: string): Promise<ApiResponse<{ task: Task }>> {
    return this.post('/api/tasks/cancel', 'cancel_task', { taskId });
  }

  /** 健康检查 */
  async health(): Promise<boolean> {
    try {
      const res = await request(`${this.config.httpUrl}/api/health`);
      const body = await res.body.json() as ApiResponse;
      return body.success === true;
    } catch {
      return false;
    }
  }

  // ==========================================
  // WebSocket 层
  // ==========================================

  /** 连接 WebSocket */
  connectWs(): void {
    const wsUrl = this.config.wsUrl;
    console.log(`[CLIENT] Connecting to WebSocket: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('[CLIENT] ✅ WebSocket connected');
      this.alive = true;
    });

    this.ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString()) as WsEvent;
        this.handleWsEvent(event);
      } catch (err) {
        console.error('[CLIENT] Failed to parse WS message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[CLIENT] 🔌 WebSocket disconnected');
      this.alive = false;
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[CLIENT] WebSocket error:', err.message);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.alive === false) {
        this.connectWs();
      }
    }, 5000);
  }

  private handleWsEvent(event: WsEvent): void {
    const handlers = this.wsHandlers.get(event.type) || [];
    handlers.forEach((handler) => handler(event));

    // 默认日志
    if (event.type === 'task_new') {
      console.log(`[CLIENT] 📥 New task received: ${event.data?.taskId}`);
    }
  }

  on(eventType: string, handler: WsEventHandler): void {
    const handlers = this.wsHandlers.get(eventType) || [];
    handlers.push(handler);
    this.wsHandlers.set(eventType, handlers);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
