// ============================================
// 鹰爪技能 · 大模型调用
// ============================================
//
// 调用 OpenAI 兼容 API（支持 OpenAI / DeepSeek / 本地 Ollama 等）
// 这是"万能兜底"技能：优先级最低，canHandle 始终返回 true
//
// ============================================

import { request } from 'undici';
import type { Skill, SkillContext } from '../types.js';

const LLM_API_URL = process.env.LLM_API_URL || 'https://api.openai.com/v1/chat/completions';
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '4096', 10);
const LLM_TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.7');

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callLLM(messages: ChatMessage[]): Promise<{
  content: string;
  model: string;
  usage: { prompt: number; completion: number; total: number };
  finishReason: string;
}> {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY not configured. Set it in .env file.');
  }

  const body = {
    model: LLM_MODEL,
    messages,
    max_tokens: LLM_MAX_TOKENS,
    temperature: LLM_TEMPERATURE,
  };

  console.log(`[LLM] Calling ${LLM_API_URL} model=${LLM_MODEL}`);

  const res = await request(LLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(body),
    bodyTimeout: 120_000,
    headersTimeout: 30_000,
  });

  if (res.statusCode !== 200) {
    const errText = await res.body.text();
    throw new Error(`LLM API returned ${res.statusCode}: ${errText.slice(0, 500)}`);
  }

  const data = await res.body.json() as ChatCompletionResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new Error('LLM API returned empty choices');
  }

  const choice = data.choices[0];

  return {
    content: choice.message.content || '',
    model: LLM_MODEL,
    usage: {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    },
    finishReason: choice.finish_reason || 'unknown',
  };
}

async function callLLMWithRetry(
  messages: ChatMessage[],
  maxRetries: number = 3,
): Promise<ReturnType<typeof callLLM>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(messages);
    } catch (err: any) {
      lastError = err;
      console.error(`[LLM] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`[LLM] Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}

function buildSystemPrompt(context: SkillContext): string {
  return [
    '你是一个高效的 AI 工作节点，隶属于天网（Skynet）去中心化 AI 协作网络。',
    '',
    '你的职责：',
    '1. 认真分析任务描述',
    '2. 给出高质量、准确、完整的回答',
    '3. 如果任务需要代码，提供可运行的代码',
    '4. 如果任务需要分析，给出有理有据的分析',
    '5. 如果不确定，诚实说明',
    '',
    `当前任务 ID: ${context.taskId}`,
    `任务奖励：${context.reward} 积分`,
    '',
    '请直接回答任务内容，不要重复任务描述，不要加多余的客套话。',
  ].join('\n');
}

export const llmCallSkill: Skill = {
  name: 'llm-call',
  description: '大模型调用：将任务发送给 LLM（GPT-4o / DeepSeek 等）获取智能回答（万能兜底技能）',

  canHandle(_taskDescription: string): boolean {
    return true; // 万能兜底，但注册顺序最后
  },

  async execute(taskDescription: string, context: SkillContext): Promise<string> {
    const systemPrompt = buildSystemPrompt(context);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: taskDescription },
    ];

    const result = await callLLMWithRetry(messages);

    console.log(`[LLM] Done. tokens=${result.usage.total} finish=${result.finishReason}`);

    const footer = [
      '',
      '---',
      `🤖 模型：${result.model}`,
      `📊 Token: ${result.usage.prompt}(输入) + ${result.usage.completion}(输出) = ${result.usage.total}(总计)`,
      `🏁 结束原因：${result.finishReason}`,
    ].join('\n');

    return result.content + footer;
  },
};
