import WebSocket from 'ws';
import { CONFIG } from './config';
import { Identity } from './identity';
import { OpenClawClient } from './openclaw-client';
import { SkynetTask, OpenClawStreamEvent, EagleClawStatus } from './types';

export class EagleClawAgent {
  private ws: WebSocket | null = null;
  private identity: Identity;
  private openclaw: OpenClawClient;
  private activeTasks: Map<string, boolean> = new Map();
  private capabilities: string[] = [];
  private startTime: number = 0;
  private _connected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.identity = new Identity();
    this.openclaw = new OpenClawClient();
  }

  public getStatus(): EagleClawStatus {
    return {
      connected: this._connected,
      nodeId: this._connected ? this.identity.getPublicKey() : null,
      activeTaskCount: this.activeTasks.size,
      capabilities: this.capabilities,
      uptime: this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    };
  }

  public isConnected(): boolean {
    return this._connected;
  }

  public async start(): Promise<string> {
    console.log('🦅 鹰爪 (Eagle Claw) v2.1 启动中...');
    this.startTime = Date.now();

    this.capabilities = await this.openclaw.getCapabilities();
    console.log(`✅ OpenClaw 引擎已连接，加载能力: [${this.capabilities.join(', ')}]`);

    await this.connectToSkynet();

    return `鹰爪节点已启动，节点ID: ${this.identity.getPublicKey()}，能力: [${this.capabilities.join(', ')}]`;
  }

  public disconnect(): string {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    console.log('🔌 鹰爪节点已断开星联连接');
    return '鹰爪节点已断开连接';
  }

  public async submitTask(taskType: string, payload: string): Promise<string> {
    if (!this._connected) {
      throw new Error('节点未连接星联，请先调用 eagle_claw_connect');
    }

    const taskId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const task: SkynetTask = {
      id: taskId,
      type: taskType,
      payload: taskType === 'search' ? { query: payload } :
              taskType === 'coding' ? { requirement: payload } :
              payload,
    };

    return new Promise((resolve, reject) => {
      this.activeTasks.set(taskId, true);
      const prompt = this.buildPrompt(task);

      this.openclaw.executeTask(prompt, (event: OpenClawStreamEvent) => {
        if (event.status === 'done') {
          this.activeTasks.delete(taskId);

          this.send({
            type: 'task_complete',
            taskId: task.id,
            result: event.content,
            cost: event.usage?.total_tokens || 0,
            signature: this.identity.sign(event.content || ''),
          });

          resolve(`任务完成 [${taskId}]: ${event.content?.substring(0, 200) || '(空结果)'}`);
        }

        if (event.status === 'error') {
          this.activeTasks.delete(taskId);
          this.send({ type: 'task_fail', taskId: task.id, error: event.content });
          reject(new Error(`任务失败 [${taskId}]: ${event.content}`));
        }
      }).catch((err) => {
        this.activeTasks.delete(taskId);
        reject(err);
      });
    });
  }

  private connectToSkynet(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🌐 正在连接星联: ${CONFIG.SKYNET_WS_URL}`);
      this.ws = new WebSocket(CONFIG.SKYNET_WS_URL);

      const onOpenOnce = () => {
        this._connected = true;
        console.log('✅ 星联连接成功');
        this.send({
          type: 'handshake',
          nodeId: this.identity.getPublicKey(),
          signature: this.identity.sign(`handshake-${Date.now()}`),
          capabilities: this.capabilities,
        });
        resolve();
      };

      this.ws.once('open', onOpenOnce);

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleSkynetMessage(msg);
        } catch (e) {
          console.error('❌ 消息解析失败:', e);
        }
      });

      this.ws.on('error', (err) => {
        console.error('❌ WebSocket 错误:', err.message);
        if (!this._connected) reject(err);
      });

      this.ws.on('close', () => {
        this._connected = false;
        console.log('🔄 星联断开，5秒后重连...');
        this.reconnectTimer = setTimeout(() => {
          this.connectToSkynet().catch((e) =>
            console.error('重连失败:', e.message)
          );
        }, 5000);
      });
    });
  }

  private handleSkynetMessage(msg: any) {
    switch (msg.type) {
      case 'task_assign':
        this.acceptTask(msg.task);
        break;
      case 'ping':
        this.send({ type: 'pong' });
        break;
      default:
        console.log('收到未知消息类型:', msg.type);
    }
  }

  private async acceptTask(task: SkynetTask) {
    console.log(`📋 [接单] 任务ID: ${task.id} | 类型: ${task.type}`);

    this.send({ type: 'task_ack', taskId: task.id });
    this.activeTasks.set(task.id, true);

    const prompt = this.buildPrompt(task);

    this.openclaw.executeTask(prompt, (event: OpenClawStreamEvent) => {
      if (event.status === 'done') {
        console.log(`✅ [完成] 任务ID: ${task.id} | Token: ${event.usage?.total_tokens}`);
        this.send({
          type: 'task_complete',
          taskId: task.id,
          result: event.content,
          cost: event.usage?.total_tokens || 0,
          signature: this.identity.sign(event.content || ''),
        });
        this.activeTasks.delete(task.id);
      }

      if (event.status === 'error') {
        console.error(`❌ [失败] 任务ID: ${task.id} | 原因: ${event.content}`);
        this.send({ type: 'task_fail', taskId: task.id, error: event.content });
        this.activeTasks.delete(task.id);
      }
    }).catch((err) => {
      console.error(`❌ [异常] 任务ID: ${task.id} 执行异常:`, err);
      this.send({ type: 'task_fail', taskId: task.id, error: 'Agent Internal Error' });
      this.activeTasks.delete(task.id);
    });
  }

  private buildPrompt(task: SkynetTask): string {
    if (task.type === 'search') return `请搜索：${task.payload.query}`;
    if (task.type === 'coding') return `写代码：${task.payload.requirement}`;
    return typeof task.payload === 'string' ? task.payload : JSON.stringify(task.payload);
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
