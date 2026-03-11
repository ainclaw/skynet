// ============================================
// 鹰爪技能 · AI 节点客户端
// ============================================
//
// 入口文件：加载配置 → 注册技能 → 启动 Agent
//
// ============================================

import 'dotenv/config';
import { Agent } from './agent.js';
import { loadKeyPair } from './identity.js';
import { registry } from './skills/registry.js';
import { webSearchSkill } from './skills/web-search.js';
import { codeRunnerSkill } from './skills/code-runner.js';
import { fileIoSkill } from './skills/file-io.js';
import { llmCallSkill } from './skills/llm-call.js';
import type { AgentConfig } from './types.js';

// ============================================
// 1. 验证必要配置
// ============================================

const required = ['NODE_PRIVATE_KEY', 'NODE_PUBLIC_KEY', 'SKYNET_HTTP_URL', 'SKYNET_WS_URL'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ 缺少必要的环境变量:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('');
  console.error('请复制 .env.example 为 .env 并填写配置。');
  console.error('首次运行请先执行：npm run keygen');
  process.exit(1);
}

// ============================================
// 2. 加载配置
// ============================================

const keyPair = loadKeyPair(process.env.NODE_PRIVATE_KEY!);

const config: AgentConfig = {
  httpUrl: process.env.SKYNET_HTTP_URL!,
  wsUrl: process.env.SKYNET_WS_URL!,
  privateKey: keyPair.privateKey,
  publicKey: keyPair.publicKey,
  alias: process.env.NODE_ALIAS || 'eagle-node-01',
  pollInterval: parseInt(process.env.AGENT_POLL_INTERVAL || '10', 10),
  enabledSkills: process.env.ENABLED_SKILLS
    ? process.env.ENABLED_SKILLS.split(',').map(s => s.trim())
    : ['web-search', 'code-runner', 'file-io', 'llm-call'],
};

// ============================================
// 3. 注册技能（按优先级顺序）
// ============================================

// 优先级从高到低：专用技能 → 通用技能 → 兜底技能
registry.register(webSearchSkill);    // 联网搜索
registry.register(codeRunnerSkill);   // 代码执行
registry.register(fileIoSkill);       // 文件读写
registry.register(llmCallSkill);      // 大模型调用（兜底）

console.log('');
console.log('✅ 已注册技能:', registry.getNames().join(', '));
console.log('');

// ============================================
// 4. 启动 Agent
// ============================================

const agent = new Agent(config);

// 优雅退出
process.on('SIGINT', async () => {
  console.log('');
  console.log('[MAIN] Received SIGINT, shutting down...');
  await agent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('');
  console.log('[MAIN] Received SIGTERM, shutting down...');
  await agent.stop();
  process.exit(0);
});

// 启动
agent.start().catch((err) => {
  console.error('[MAIN] Fatal error:', err);
  process.exit(1);
});
