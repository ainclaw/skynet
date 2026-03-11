// ============================================
// 鹰爪技能 · 代码执行（沙箱）
// ============================================
//
// 支持语言：JavaScript / Python / Bash
//
// 安全措施：超时强制 kill、限制输出长度、子进程隔离
//
// 触发关键词：代码、code、运行、run、执行、execute、
//            编程、program、脚本、script、python、javascript
//
// ============================================

import { spawn } from 'node:child_process';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Skill, SkillContext } from '../types.js';

const CODE_KEYWORDS = [
  '代码', 'code', '运行', 'run', '执行', 'execute',
  '编程', 'program', '脚本', 'script',
  'python', 'javascript', 'js', 'typescript', 'ts',
  'bash', 'shell', 'sh',
  '算法', 'algorithm', '函数', 'function',
  '计算', 'calculate', 'compute',
];

const MAX_OUTPUT = 10_000;

interface CodeBlock {
  language: string;
  code: string;
}

function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const mdRegex = /```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = mdRegex.exec(text)) !== null) {
    const lang = (match[1] || 'javascript').toLowerCase();
    const code = match[2].trim();
    if (code) blocks.push({ language: normalizeLang(lang), code });
  }

  if (blocks.length === 0) {
    const codePatterns = [
      /def\s+\w+\s*\(/, /function\s+\w+\s*\(/, /const\s+\w+\s*=/,
      /import\s+/, /print\s*\(/, /console\.log\s*\(/, /#!/,
    ];
    const hasCode = codePatterns.some(p => p.test(text));
    if (hasCode) {
      let lang = 'javascript';
      if (/def\s+\w+|import\s+\w+|print\s*\(/.test(text)) lang = 'python';
      if (/^#!/.test(text)) lang = 'bash';
      blocks.push({ language: lang, code: text });
    }
  }

  return blocks;
}

function normalizeLang(lang: string): string {
  const map: Record<string, string> = {
    js: 'javascript', javascript: 'javascript', ts: 'javascript', typescript: 'javascript',
    py: 'python', python: 'python', python3: 'python',
    sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash',
  };
  return map[lang] || 'javascript';
}

function runInSubprocess(
  command: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn(command, args, {
      timeout: timeout * 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'sandbox' },
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n... [OUTPUT TRUNCATED]';
        proc.kill('SIGKILL');
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > MAX_OUTPUT) {
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n... [STDERR TRUNCATED]';
      }
    });

    proc.on('close', (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1, timedOut });
    });

    proc.on('error', (err: any) => {
      if (err.code === 'ETIMEDOUT' || err.killed) timedOut = true;
      resolve({ stdout: stdout.trim(), stderr: err.message, exitCode: 1, timedOut });
    });

    setTimeout(() => {
      if (!proc.killed) {
        timedOut = true;
        proc.kill('SIGKILL');
      }
    }, (timeout + 2) * 1000);
  });
}

export const codeRunnerSkill: Skill = {
  name: 'code-runner',
  description: '代码执行：在沙箱中运行 JavaScript / Python / Bash 代码并返回结果',

  canHandle(taskDescription: string): boolean {
    const lower = taskDescription.toLowerCase();
    const hasKeyword = CODE_KEYWORDS.some(kw => lower.includes(kw));
    const hasCodeBlock = /```[\s\S]*```/.test(taskDescription);
    return hasKeyword || hasCodeBlock;
  },

  async execute(taskDescription: string, context: SkillContext): Promise<string> {
    const timeout = parseInt(process.env.CODE_EXEC_TIMEOUT || '30', 10);
    const blocks = extractCodeBlocks(taskDescription);

    if (blocks.length === 0) {
      return '⚠️ 未在任务描述中找到可执行的代码块。请使用 Markdown 格式。';
    }

    const results: string[] = [];
    const workDir = join(context.workDir, `run-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      console.log(`[CODE-RUNNER] Executing block ${i + 1}/${blocks.length}: ${block.language}`);

      let tmpFile: string;
      let command: string;
      let args: string[];

      switch (block.language) {
        case 'python':
          tmpFile = join(workDir, `script_${i}.py`);
          await writeFile(tmpFile, block.code, 'utf-8');
          command = 'python3';
          args = [tmpFile];
          break;
        case 'bash':
          tmpFile = join(workDir, `script_${i}.sh`);
          await writeFile(tmpFile, block.code, 'utf-8');
          command = 'bash';
          args = [tmpFile];
          break;
        default:
          tmpFile = join(workDir, `script_${i}.mjs`);
          await writeFile(tmpFile, block.code, 'utf-8');
          command = 'node';
          args = ['--experimental-vm-modules', tmpFile];
      }

      const result = await runInSubprocess(command, args, timeout);
      results.push(`--- 代码块 ${i + 1} [${block.language}] ---`);
      if (result.timedOut) results.push(`⏰ 执行超时（${timeout}s 限制）`);
      else results.push(`退出码：${result.exitCode}`);
      if (result.stdout) results.push(`📤 输出:\n${result.stdout}`);
      if (result.stderr) results.push(`⚠️ 错误:\n${result.stderr}`);
      if (!result.stdout && !result.stderr && !result.timedOut) results.push('(无输出)');
      results.push('');

      try { await unlink(tmpFile); } catch { /* ignore */ }
    }

    return `🖥️ 代码执行完成\n\n${results.join('\n')}`;
  },
};
