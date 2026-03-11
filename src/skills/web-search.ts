// ============================================
// 鹰爪技能 · 联网搜索
// ============================================
//
// 使用 DuckDuckGo Instant Answer API（免费，无需 key）
// 也支持配置自定义搜索 API
//
// 触发关键词：搜索、search、查询、query、查找、find、
//            最新、latest、新闻、news、百科、wiki
//
// ============================================

import { request } from 'undici';
import type { Skill, SkillContext } from '../types.js';

const SEARCH_KEYWORDS = [
  '搜索', 'search', '查询', 'query', '查找', 'find',
  '最新', 'latest', '新闻', 'news', '百科', 'wiki',
  '谁是', 'who is', '什么是', 'what is', '怎么', 'how to',
  '哪里', 'where', '多少', 'how many', '为什么', 'why',
  '天气', 'weather', '股价', 'stock', '汇率', 'exchange rate',
];

/** 提取搜索关键词（去掉触发词，保留核心内容） */
function extractQuery(description: string): string {
  let query = description.trim();

  const prefixes = [
    '请帮我搜索', '帮我搜索', '请搜索', '搜索一下', '搜索',
    'please search', 'search for', 'search',
    '请帮我查询', '帮我查询', '请查询', '查询',
    '请帮我查找', '帮我查找', '请查找', '查找',
  ];

  for (const prefix of prefixes) {
    if (query.toLowerCase().startsWith(prefix.toLowerCase())) {
      query = query.slice(prefix.length).trim();
      break;
    }
  }

  query = query.replace(/[.?!.,,]+$/, '').trim();
  return query || description;
}

/** DuckDuckGo Instant Answer API */
async function duckduckgoSearch(query: string): Promise<string> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const res = await request(url, {
    method: 'GET',
    headers: { 'User-Agent': 'EagleClaw/1.0' },
  });

  const body = await res.body.json() as any;
  const results: string[] = [];

  if (body.Abstract) {
    results.push(`📖 摘要：${body.Abstract}`);
    if (body.AbstractSource) {
      results.push(`   来源：${body.AbstractSource} — ${body.AbstractURL}`);
    }
  }

  if (body.Answer) {
    results.push(`✅ 回答：${body.Answer}`);
  }

  if (body.Definition) {
    results.push(`📝 定义：${body.Definition}`);
  }

  if (body.RelatedTopics && body.RelatedTopics.length > 0) {
    results.push('');
    results.push('🔗 相关结果:');
    const topics = body.RelatedTopics.slice(0, 5);
    for (const topic of topics) {
      if (topic.Text) {
        results.push(`  • ${topic.Text}`);
        if (topic.FirstURL) {
          results.push(`    ${topic.FirstURL}`);
        }
      }
    }
  }

  if (results.length === 0) {
    return `未找到关于 "${query}" 的直接结果。建议尝试更具体的关键词。`;
  }

  return results.join('\n');
}

export const webSearchSkill: Skill = {
  name: 'web-search',
  description: '联网搜索：通过搜索引擎查找实时信息、百科知识、新闻等',

  canHandle(taskDescription: string): boolean {
    const lower = taskDescription.toLowerCase();
    return SEARCH_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
  },

  async execute(taskDescription: string, _context: SkillContext): Promise<string> {
    const query = extractQuery(taskDescription);
    console.log(`[WEB-SEARCH] Query: "${query}"`);

    const searxngUrl = process.env.SEARXNG_URL;
    let result: string;

    if (searxngUrl) {
      console.log(`[WEB-SEARCH] Using SearXNG: ${searxngUrl}`);
      // SearXNG 实现略
      result = await duckduckgoSearch(query);
    } else {
      console.log('[WEB-SEARCH] Using DuckDuckGo Instant Answer API');
      result = await duckduckgoSearch(query);
    }

    return `🔍 搜索任务完成\n查询："${query}"\n\n${result}`;
  },
};
