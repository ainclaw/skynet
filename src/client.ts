// ============================================
// 鹰爪技能 · 天网中枢通信客户端
// ============================================
//
// SkynetClient 封装了：
// 1. HTTP 请求（带自动签名）
// 2. WebSocket 连接（自动重连 + 事件监听）
//
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

  /** 注册节点 */
  async register(): Promise<ApiResponse<{ message: string; node: NodeInfo }>> {
    return this.post('/api/register', 'register', { alias: this.config.alias });
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
    if (this.ws) {
      this.ws.close();
    }

    console.log(`[WS] Connecting to ${this.config.wsUrl}...`);

    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      console.log('[WS] Connected ✓');

      // 发送身份绑定
      this.ws!.send(JSON.stringify({
        type: 'auth',
        publicKey: this.config.publicKey,
      }));

      // 启动心跳
      this.startHeartbeat();
    });

    this.ws.on('message', (raw: Buffer) => {
      try {
        const event = JSON.parse(raw.toString()) as WsEvent;
        this.dispatchEvent(event);
      } catch {
        // 忽略非 JSON
      }
    });

    this.ws.on('close', () => {
      console.log('[WS] Disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  }

  /** 监听 WS 事件 */
  on(eventType: string, handler: WsEventHandler): void {
    const handlers = this.wsHandlers.get(eventType) || [];
    handlers.push(handler);
    this.wsHandlers.set(eventType, handlers);
  }

  /** 分发事件 */
  private dispatchEvent(event: WsEvent): void {
    // 精确匹配
    const handlers = this.wsHandlers.get(event.type) || [];
    for (const h of handlers) {
      try { h(event); } catch (err) { console.error('[WS] Handler error:', err); }
    }

    // 通配符
    const wildcardHandlers = this.wsHandlers.get('*') || [];
    for (const h of wildcardHandlers) {
      try { h(event); } catch (err) { console.error('[WS] Handler error:', err); }
    }
  }

  /** 心跳 */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30_000);
  }

  /** 自动重连 */
  private scheduleReconnect(): void {
    if (!this.alive) return;
    if (this.reconnectTimer) return;

    console.log('[WS] Reconnecting in 5s...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, 5000);
  }

  /** 断开连接 */
  disconnect(): void {
    this.alive = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}
