import type { StoryToolCall, StoryToolRecord } from "./types";

/**
 * 故事 Agent 的工具集。
 *
 * 每个工具有三部分：
 *  - definition: 提交给 LLM 的 Function Calling schema
 *  - run: 服务端实际执行的逻辑（speak 例外，它的执行在前端）
 *  - describe: 给前端展示的中文名
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

const CHARACTERS: ToolDefinition = {
  name: "plan_characters",
  description:
    "为故事规划主要角色。当你需要确定人物设定、性格、动机时调用。返回可供创作参考的角色建议。",
  parameters: {
    type: "object",
    properties: {
      theme: { type: "string", description: "故事主题" },
      count: { type: "string", description: "需要的角色数量，如 2" },
    },
    required: ["theme"],
  },
};

const TWIST: ToolDefinition = {
  name: "design_twist",
  description:
    "为故事设计一个情节转折或冲突点。当你需要让情节更有张力时调用。返回一个出人意料但合理的转折建议。",
  parameters: {
    type: "object",
    properties: {
      genre: { type: "string", description: "故事类型，如 悬疑、奇幻、温情" },
      setup: { type: "string", description: "已有的情节铺垫" },
    },
    required: ["genre"],
  },
};

const SPEAK: ToolDefinition = {
  name: "speak",
  description:
    "请求把故事内容朗读出来。当故事写到适合朗读的段落（如开场、高潮或结尾），或用户要求听故事时调用。你只需决定朗读哪一段和用什么音色，实际朗读由客户端完成。",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "要朗读的故事片段，建议 60-200 字" },
      voice: {
        type: "string",
        description: "音色：female 表示温柔女声，male 表示沉稳男声",
      },
    },
    required: ["text"],
  },
};

export const STORY_TOOLS: ToolDefinition[] = [CHARACTERS, TWIST, SPEAK];

export const TOOL_LABELS: Record<string, string> = {
  plan_characters: "规划角色",
  design_twist: "设计转折",
  speak: "语音朗读",
};

/** 服务端执行的工具（speak 不在其中，它的结果由前端产生） */
export function executeTool(call: StoryToolCall): StoryToolRecord {
  if (call.name === "plan_characters") {
    const count = Number(call.args.count) || 2;
    return {
      name: call.name,
      args: call.args,
      result: `已规划 ${count} 位角色：一位主角（背负与「${call.args.theme}」相关的秘密），一位对手或伙伴（与主角立场冲突但动机合理）。建议给每人一个鲜明的口头禅或习惯动作，让对话有辨识度。`,
    };
  }
  if (call.name === "design_twist") {
    return {
      name: call.name,
      args: call.args,
      result: `转折建议：在「${call.args.setup || "看似顺利的铺垫"}」之后，揭露一个早已埋下却被忽略的细节，让主角意识到自己一直被误导；真相不该凭空出现，而应来自前文一句不起眼的描述。`,
    };
  }
  if (call.name === "speak") {
    // 朗读由客户端 Web Speech API 执行，这里只确认请求
    return {
      name: call.name,
      args: call.args,
      result: `朗读请求已接受：${call.args.voice === "male" ? "沉稳男声" : "温柔女声"}，内容 ${call.args.text?.length ?? 0} 字。`,
    };
  }
  return {
    name: call.name,
    args: call.args,
    result: `未知工具：${call.name}`,
  };
}
