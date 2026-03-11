// ============================================
// 鹰爪技能 · 文件读写
// ============================================
//
// 支持操作：读取、写入、列出目录、文件信息
// 安全措施：限制在工作目录内操作，禁止路径穿越
//
// 触发关键词：文件、file、读取、read、写入、write、
//            保存、save、目录、directory、列出、list
//
// ============================================

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import type { Skill, SkillContext } from '../types.js';

const FILE_KEYWORDS = [
  '文件', 'file', '读取', 'read', '写入', 'write',
  '保存', 'save', '目录', 'directory', 'dir',
  '列出', 'list', '创建', 'create', '打开', 'open',
  '查看', 'view', 'cat', 'ls', 'mkdir', 'touch',
];

const MAX_READ_SIZE = 1024 * 512; // 512KB

interface FileCommand {
  action: 'read' | 'write' | 'list' | 'info' | 'mkdir';
  path: string;
  content?: string;
}

function parseFileCommand(description: string): FileCommand | null {
  const lower = description.toLowerCase();

  const readMatch = description.match(/(?:读取|read|cat|打开|open|查看|view)\s+[`"']?([^\s`"']+)[`"']?/i);
  if (readMatch) return { action: 'read', path: readMatch[1] };

  const listMatch = description.match(/(?:列出|list|ls|目录|dir)\s*[`"']?([^\s`"']*)[`"']?/i);
  if (listMatch) return { action: 'list', path: listMatch[1] || '.' };

  const mkdirMatch = description.match(/(?:创建目录|mkdir)\s+[`"']?([^\s`"']+)[`"']?/i);
  if (mkdirMatch) return { action: 'mkdir', path: mkdirMatch[1] };

  const writeMatch = description.match(/(?:写入|write|保存|save|创建|create)\s+[`"']?([^\s`"']+)[`"']?\s*(?:内容|content)?[:\s]*([\s\S]+)/i);
  if (writeMatch) return { action: 'write', path: writeMatch[1], content: writeMatch[2].trim() };

  const infoMatch = description.match(/(?:文件信息|file info|stat)\s+[`"']?([^\s`"']+)[`"']?/i);
  if (infoMatch) return { action: 'info', path: infoMatch[1] };

  return null;
}

function safePath(workDir: string, filePath: string): string | null {
  if (filePath.includes('..')) return null;
  const absPath = resolve(workDir, filePath);
  const rel = relative(workDir, absPath);
  if (rel.startsWith('..') || !absPath.startsWith(resolve(workDir))) return null;
  return absPath;
}

export const fileIoSkill: Skill = {
  name: 'file-io',
  description: '文件读写：读取、写入、列出目录等文件系统操作（限工作目录内）',

  canHandle(taskDescription: string): boolean {
    const lower = taskDescription.toLowerCase();
    return FILE_KEYWORDS.some(kw => lower.includes(kw));
  },

  async execute(taskDescription: string, context: SkillContext): Promise<string> {
    const cmd = parseFileCommand(taskDescription);

    if (!cmd) {
      return '⚠️ 无法解析文件操作指令。支持格式：读取 <路径>、写入 <路径> 内容：<内容>、列出 <目录>、创建目录 <路径>';
    }

    await mkdir(context.workDir, { recursive: true });

    const safep = safePath(context.workDir, cmd.path);
    if (!safep) {
      return `🚫 安全限制：路径 "${cmd.path}" 不在允许的工作目录内。`;
    }

    try {
      switch (cmd.action) {
        case 'read': {
          const info = await stat(safep);
          if (info.size > MAX_READ_SIZE) {
            return `⚠️ 文件过大 (${(info.size / 1024).toFixed(1)}KB)，超过 ${MAX_READ_SIZE / 1024}KB 限制。`;
          }
          const content = await readFile(safep, 'utf-8');
          return `📄 文件内容 [${cmd.path}] (${info.size} bytes):\n\n${content}`;
        }

        case 'write': {
          const content = cmd.content || '';
          await mkdir(join(safep, '..'), { recursive: true });
          await writeFile(safep, content, 'utf-8');
          return `✅ 文件已写入 [${cmd.path}] (${Buffer.byteLength(content, 'utf-8')} bytes)`;
        }

        case 'list': {
          const entries = await readdir(safep, { withFileTypes: true });
          if (entries.length === 0) return `📁 目录 [${cmd.path}] 为空`;
          const lines = entries.map(e => {
            const icon = e.isDirectory() ? '📁' : '📄';
            return `  ${icon} ${e.name}${e.isDirectory() ? '/' : ''}`;
          });
          return `📁 目录 [${cmd.path}] (${entries.length} 项):\n${lines.join('\n')}`;
        }

        case 'mkdir': {
          await mkdir(safep, { recursive: true });
          return `✅ 目录已创建 [${cmd.path}]`;
        }

        case 'info': {
          const info = await stat(safep);
          return [
            `📋 文件信息 [${cmd.path}]:`,
            `  类型：${info.isDirectory() ? '目录' : '文件'}`,
            `  大小：${info.size} bytes (${(info.size / 1024).toFixed(1)} KB)`,
            `  修改：${info.mtime.toISOString()}`,
            `  权限：${info.mode.toString(8)}`,
          ].join('\n');
        }

        default:
          return '⚠️ 未知的文件操作';
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') return `❌ 文件/目录不存在：${cmd.path}`;
      if (err.code === 'EACCES') return `🚫 权限不足：${cmd.path}`;
      return `❌ 文件操作失败：${err.message}`;
    }
  },
};
