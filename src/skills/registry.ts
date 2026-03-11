// ============================================
// 鹰爪技能 · 技能注册表
// ============================================
//
// 所有技能在此注册，Agent 通过注册表：
// 1. 查找能处理某任务的技能
// 2. 按优先级排序（先注册 = 高优先级）
// 3. 支持运行时动态注册
//
// ============================================

import type { Skill, SkillContext } from '../types.js';

class SkillRegistry {
  private skills: Skill[] = [];

  /** 注册技能 */
  register(skill: Skill): void {
    // 去重
    if (this.skills.find(s => s.name === skill.name)) {
      console.log(`[SKILLS] Skill already registered: ${skill.name}, skipping`);
      return;
    }
    this.skills.push(skill);
    console.log(`[SKILLS] Registered: ${skill.name} — ${skill.description}`);
  }

  /** 获取所有已注册技能 */
  getAll(): Skill[] {
    return [...this.skills];
  }

  /** 获取技能名称列表 */
  getNames(): string[] {
    return this.skills.map(s => s.name);
  }

  /** 按名称查找技能 */
  get(name: string): Skill | undefined {
    return this.skills.find(s => s.name === name);
  }

  /**
   * 查找能处理该任务的所有技能（按注册顺序 = 优先级）
   */
  findCapable(taskDescription: string): Skill[] {
    return this.skills.filter(s => s.canHandle(taskDescription));
  }

  /**
   * 智能选择最佳技能
   * 策略：返回第一个 canHandle 为 true 的技能
   * 如果没有匹配的，返回 null
   */
  selectBest(taskDescription: string): Skill | null {
    for (const skill of this.skills) {
      if (skill.canHandle(taskDescription)) {
        return skill;
      }
    }
    return null;
  }

  /**
   * 组合执行：依次尝试所有能处理的技能，直到成功
   * 适用于不确定哪个技能最合适的场景
   */
  async executeWithFallback(
    taskDescription: string,
    context: SkillContext,
  ): Promise<{ skill: string; result: string } | null> {
    const capable = this.findCapable(taskDescription);

    if (capable.length === 0) {
      console.log('[SKILLS] No capable skill found for task');
      return null;
    }

    for (const skill of capable) {
      try {
        console.log(`[SKILLS] Trying skill: ${skill.name}`);
        const result = await skill.execute(taskDescription, context);
        console.log(`[SKILLS] Skill ${skill.name} succeeded`);
        return { skill: skill.name, result };
      } catch (err: any) {
        console.error(`[SKILLS] Skill ${skill.name} failed: ${err.message}`);
        // 继续尝试下一个
      }
    }

    console.log('[SKILLS] All capable skills failed');
    return null;
  }

  /** 生成技能摘要（给 LLM 做工具选择用） */
  toPromptSummary(): string {
    if (this.skills.length === 0) return '(no skills available)';

    return this.skills
      .map((s, i) => `${i + 1}. [${s.name}] ${s.description}`)
      .join('\n');
  }

  /** 清空（测试用） */
  clear(): void {
    this.skills = [];
  }
}

/** 全局单例 */
export const registry = new SkillRegistry();
