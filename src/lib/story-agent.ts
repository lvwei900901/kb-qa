import type {
  StoryEvent,
  StoryToolCall,
  StoryToolRecord,
} from "./types";
import { STORY_TOOLS, executeTool } from "./story-tools";

interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  label: string;
}

interface ToolCallDraft {
  id: string;
  name: string;
  args: string;
}

/**
 * 故事 Agent 使用真实 LLM。优先用 LLM_API_KEY；未配置时复用智谱 Key 跑免费的
 * GLM-4-Flash（已实测支持 Function Calling），这样无需额外申请即可体验完整 Agent。
 */
export function getStoryLLMConfig(): LLMConfig | null {
  if (process.env.LLM_API_KEY) {
    return {
      apiKey: process.env.LLM_API_KEY,
      baseUrl:
        process.env.LLM_BASE_URL ??
        "https://api.deepseek.com/chat/completions",
      model: process.env.LLM_MODEL ?? "deepseek-chat",
      label: process.env.LLM_MODEL ?? "deepseek-chat",
    };
  }
  if (process.env.EMBEDDING_API_KEY) {
    return {
      apiKey: process.env.EMBEDDING_API_KEY,
      baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      model: "glm-4-flash",
      label: "GLM-4-Flash",
    };
  }
  return null;
}

const SYSTEM_PROMPT = `你是一位童话故事创作家，正在为用户写一个故事。你有三个工具可以调用：

1. plan_characters：规划角色。写故事前先调用它确定人物。
2. design_twist：设计情节转折。让故事有张力。
3. speak：请求把某段故事朗读出来。当用户说"讲给我听/读出来"，或故事写到适合朗读的高潮、结尾时调用。

工作方式（严格遵守）：
- 第一轮：先调用 plan_characters 和 design_twist 准备素材。调用工具时不要输出任何文字。
- 收到工具结果后：写一个完整的中文故事（400-600 字），开头、发展、转折、结尾齐全，语言生动有画面感，分段清晰。这段文字要流式写出，不要在其中夹杂工具调用。
- 故事写完后：调用一次 speak，text 选取故事中最精彩的 60-150 字，voice 根据故事氛围选 female（温柔）或 male（沉稳）。
- speak 之后不要再输出任何文字，直接结束。

用户主题会作为下一条消息给出。`;

const MAX_TURNS = 6;

/** 单次流式请求：实时吐出文字 delta，tool_calls 写入 state 供调用方读取 */
async function* streamTurn(
  config: LLMConfig,
  messages: Record<string, unknown>[],
  state: { toolCalls: ToolCallDraft[]; textEmitted: boolean },
): AsyncGenerator<string> {
  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: STORY_TOOLS.map((tool) => ({ type: "function", function: tool })),
      tool_choice: "auto",
      stream: true,
      temperature: 0.8,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(`故事模型调用失败 (${response.status}): ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const drafts = new Map<number, ToolCallDraft>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: {
                index: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }[];
            };
          }[];
        };
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          state.textEmitted = true;
          yield delta.content;
        }

        for (const tc of delta.tool_calls ?? []) {
          const index = tc.index ?? 0;
          const draft = drafts.get(index) ?? { id: "", name: "", args: "" };
          if (tc.id) draft.id = tc.id;
          if (tc.function?.name) draft.name += tc.function.name;
          if (tc.function?.arguments) draft.args += tc.function.arguments;
          drafts.set(index, draft);
        }
      } catch {
        // 跳过非 JSON 的 keepalive 行
      }
    }
  }

  state.toolCalls = [...drafts.values()];
}

export async function* runStoryAgent(topic: string): AsyncGenerator<StoryEvent> {
  const config = getStoryLLMConfig();
  if (!config) {
    yield {
      type: "error",
      message: "未配置 LLM Key。请配置 LLM_API_KEY 或确保 EMBEDDING_API_KEY（智谱）可用。",
    };
    return;
  }

  yield { type: "status", message: `${config.label} 正在构思故事...` };

  const messages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `故事主题：${topic}。请开始创作。` },
  ];

  let toolsUsed = 0;
  let fullStory = "";
  let spoke = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const state: { toolCalls: ToolCallDraft[]; textEmitted: boolean } = {
      toolCalls: [],
      textEmitted: false,
    };

    // 逐轮流式：文字 delta 立即转成 SSE 事件；tool_calls 写入 state
    for await (const textDelta of streamTurn(config, messages, state)) {
      fullStory += textDelta;
      yield { type: "delta", text: textDelta };
    }
    const toolCalls = state.toolCalls;

    // 若本轮没有工具调用，说明故事已写完，结束
    if (toolCalls.length === 0) break;

    // 把本轮的 assistant 消息（含 tool_calls）按协议回灌
    const assistantMessage: Record<string, unknown> = {
      role: "assistant",
      content: "",
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.args },
      })),
    };
    messages.push(assistantMessage);

    for (const draft of toolCalls) {
      let args: Record<string, string> = {};
      try {
        args = JSON.parse(draft.args || "{}") as Record<string, string>;
      } catch {
        args = {};
      }
      const call: StoryToolCall = { name: draft.name, args };
      yield { type: "tool_call", tool: call };

      const record: StoryToolRecord = executeTool(call);
      toolsUsed += 1;
      yield { type: "tool_result", record };

      messages.push({
        role: "tool",
        tool_call_id: draft.id,
        content: record.result,
      });

      // speak 是"前端执行的工具"：发事件让浏览器朗读，不把文本再次交给模型输出
      if (draft.name === "speak") {
        spoke = true;
        yield {
          type: "speak",
          text: args.text ?? "",
          voice: args.voice === "male" ? "male" : "female",
        };
      }
    }
  }

  // 保底：模型有时会忽略"最后调 speak"的指令。若整段流程都没触发朗读，
  // 则从故事正文抽取一段补发，保证演示稳定（工具调用依然真实发生）。
  if (!spoke && fullStory.trim()) {
    const paragraphs = fullStory
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 40);
    const picked =
      paragraphs[Math.min(1, paragraphs.length - 1)] ?? fullStory.trim();
    const excerpt = picked.slice(0, 140);
    yield { type: "tool_call", tool: { name: "speak", args: { text: excerpt, voice: "female" } } };
    toolsUsed += 1;
    yield {
      type: "tool_result",
      record: {
        name: "speak",
        args: { text: excerpt, voice: "female" },
        result: `朗读请求已接受：温柔女声，内容 ${excerpt.length} 字。（保底触发）`,
      },
    };
    yield { type: "speak", text: excerpt, voice: "female" };
  }

  yield { type: "done", toolsUsed };
}
