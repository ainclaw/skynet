#!/usr/bin/env node

import { startMcpServer } from './mcp-server';
import { EagleClawAgent } from './agent';

async function main() {
  const isMcpMode = process.argv.includes('--mcp');

  if (isMcpMode) {
    await startMcpServer();
  } else {
    const agent = new EagleClawAgent();
    await agent.start();
  }
}

main().catch((err) => {
  console.error('❌ 启动失败:', err);
  process.exit(1);
});
