// ============================================
// 鹰爪技能 · AI Agent 主循环
// ============================================
//
// Agent 生命周期：
// 1. 启动 → 注册节点 → 连接 WebSocket
// 2. 主循环：轮询任务 → 匹配技能 → 抢单 → 执行 → 提交
// 3. 同时监听 WebSocket 推送，实时响应新任务
//
// ============================================

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SkynetClient } from './client.js';
import { registry } from './skills/registry.js';
import type { AgentConfig, Task, SkillContext, WsEvent } from './types.js';

export class Agent {
  private client: SkynetClient;
  private config: AgentConfig;
  private running = false;
  private processing = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private workBaseDir: string;

  private stats = {
    tasksProcessed: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    totalReward: 0,
    startTime: Date.now(),
  };

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new SkynetClient(config);
    this.workBaseDir = join(process.cwd(), '.eagle-work');
  }

  async start(): Promise<void> {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║          🦅 鹰爪技能 · AI Agent 启动             ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║ 节点：${this.config.alias}`);
    console.log(`║ 公钥：${this.config.publicKey.slice(0, 32)}...`);
    console.log(`║ 中枢：${this.config.httpUrl}`);
    console.log(`║ 技能：${registry.getNames().join(', ')}`);
    console.log(`║ 轮询：${this.config.pollInterval}s`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    await mkdir(this.workBaseDir, { recursive: true });

    console.log('[AGENT] Checking Skynet hub health...');
    const healthy = await this.client.health();
    if (!healthy) {
      console.error('[AGENT] ❌ Skynet hub is not reachable.');
    } else {
      console.log('[AGENT] ✅ Skynet hub is healthy');
    }

    // 读取邀请人信息（通过环境变量或命令行参数）
    const referredBy = process.env.REFERRED_BY || process.argv.find(arg => arg.startsWith('--ref='))?.split('=')[1];
    if (referredBy) {
      console.log(`[AGENT] 👤 Referred by: ${referredBy.slice(0, 16)}...`);
    }

    console.log('[AGENT] Registering node...');
    const regResult = await this.client.register(referredBy);
    if (regResult.success) {
      console.log(`[AGENT] ✅ Registered: ${regResult.data?.message}`);
      // 显示邀请链接
      if (regResult.data?.inviteLink) {
        console.log(`[AGENT] 🔗 你的邀请链接: ${regResult.data.inviteLink}`);
      }
    } else {
      console.log(`[AGENT] ⚠️ Register response: ${regResult.error}`);
    }

    const balResult = await this.client.getBalance();
    if (balResult.success && balResult.data) {
      console.log(`[AGENT] 💰 Balance: ${balResult.data.balance}`);
      console.log(`[AGENT] ⭐ Reputation: ${balResult.data.reputation}`);
    }

    this.setupWebSocket();
    this.running = true;
    this.startPolling();

    console.log('[AGENT] 🚀 Agent is running. Waiting for tasks...');
    console.log('');
  }

  async stop(): Promise<void> {
    console.log('[AGENT] Stopping...');
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.client.disconnect();
    this.printStats();
    console.log('[AGENT] Stopped.');
  }

  private setupWebSocket(): void {
    this.client.connectWs();

    this.client.on('task_posted', (event: WsEvent) => {
      console.log(`[WS] 📢 New task posted: ${event.task.id}`);
      this.tryProcessTask(event.task);
    });

    this.client.on('task_claimed', (event: WsEvent) => {
      if (event.task.claimer_key === this.config.publicKey) {
        console.log(`[WS] ✅ We claimed task: ${event.task.id}`);
      }
    });

    this.client.on('task_submitted', (event: WsEvent) => {
      console.log(`[WS] 📤 Task submitted: ${event.task.id}`);
    });
  }

  private startPolling(): void {
    const interval = this.config.pollInterval * 1000;

    this.pollTimer = setInterval(async () => {
      if (this.processing) return;

      try {
        const result = await this.client.listTasks('open', 10);
        if (result.success && result.data?.tasks && result.data.tasks.length > 0) {
          const task = result.data.tasks[0];
          console.log(`[POLL] Found open task: ${task.id} — ${task.description.slice(0, 50)}...`);
          this.tryProcessTask(task);
        }
      } catch (err: any) {
        console.error('[POLL] Error:', err.message);
      }
    }, interval);
  }

  private async tryProcessTask(task: Task): Promise<void> {
    if (this.processing || task.status !== 'open') return;

    this.processing = true;

    try {
      console.log(`[AGENT] Attempting to claim task: ${task.id}`);

      const claimResult = await this.client.claimTask(task.id);
      if (!claimResult.success) {
        console.log(`[AGENT] ❌ Failed to claim task ${task.id}: ${claimResult.error}`);
        this.processing = false;
        return;
      }

      console.log(`[AGENT] ✅ Claimed task ${task.id}`);

      const workDir = join(this.workBaseDir, task.id);
      await mkdir(workDir, { recursive: true });

      const context: SkillContext = {
        taskId: task.id,
        publisherKey: task.publisher_key,
        reward: task.reward,
        workDir,
        timeout: parseInt(process.env.CODE_EXEC_TIMEOUT || '30', 10),
      };

      const skill = registry.selectBest(task.description);
      if (!skill) {
        throw new Error('No suitable skill found for task');
      }

      console.log(`[AGENT] Executing skill: ${skill.name}`);
      const result = await skill.execute(task.description, context);

      console.log(`[AGENT] Submitting result for task ${task.id}`);
      const submitResult = await this.client.submitTask(task.id, result);

      if (submitResult.success) {
        console.log(`[AGENT] ✅ Task ${task.id} completed successfully`);
        this.stats.tasksSucceeded++;
        this.stats.totalReward += task.reward;
      } else {
        console.log(`[AGENT] ❌ Task ${task.id} submit failed: ${submitResult.error}`);
        this.stats.tasksFailed++;
      }

      this.stats.tasksProcessed++;
    } catch (err: any) {
      console.error(`[AGENT] Task ${task.id} failed:`, err.message);
      this.stats.tasksFailed++;
    } finally {
      this.processing = false;
    }
  }

  private printStats(): void {
    const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║              📊 Agent 运行统计                    ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║ 运行时长：${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`);
    console.log(`║ 处理任务：${this.stats.tasksProcessed}`);
    console.log(`║ 成功：${this.stats.tasksSucceeded} | 失败：${this.stats.tasksFailed}`);
    console.log(`║ 总奖励：${this.stats.totalReward}`);
    console.log('╚══════════════════════════════════════════════════╝');
  }
}
