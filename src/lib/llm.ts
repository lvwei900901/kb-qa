import type { SearchResult, VersionDiff } from "./types";

export interface LLMConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  label: string;
}

export function getLLMConfig(): LLMConfig | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;

  const provider = process.env.LLM_PROVIDER ?? "deepseek";
  if (provider === "qwen") {
    return {
      apiKey,
      model: process.env.LLM_MODEL ?? "qwen-plus",
      baseUrl:
        process.env.LLM_BASE_URL ??
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      label: "通义千问 qwen-plus",
    };
  }
  return {
    apiKey,
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    baseUrl:
      process.env.LLM_BASE_URL ?? "https://api.deepseek.com/chat/completions",
    label: "DeepSeek-V3",
  };
}

function scoreTokens(text: string): string[] {
  const normalized = text.toLowerCase();
  const words = normalized.match(/[a-z][a-z0-9_+.-]{1,}/g) ?? [];
  const cjk = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  const bigrams: string[] = [];
  for (const segment of cjk) {
    for (let i = 0; i < segment.length - 1; i++) bigrams.push(segment.slice(i, i + 2));
  }
  return [...words, ...bigrams];
}

function buildContext(results: SearchResult[]): string {
  return results
    .map(
      (result, index) =>
        `[${index + 1}] [Next.js ${result.chunk.version}] 来源：${result.chunk.title}\n${result.chunk.content}`,
    )
    .join("\n\n");
}

function buildDiffContext(diffs: VersionDiff[]): string {
  if (diffs.length === 0) return "";
  const blocks = diffs.map((diff) => {
    return [
      `主题：${diff.title}`,
      `Next.js 15（旧）：${diff.oldSummary}（出处：${diff.oldSource}）`,
      `Next.js 16（新）：${diff.newSummary}（出处：${diff.newSource}）`,
      diff.note ? `差异要点：${diff.note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  return `\n\n新旧版本差异对照：\n${blocks.join("\n\n")}`;
}

async function* demoAnswer(
  question: string,
  results: SearchResult[],
  diffs: VersionDiff[],
): AsyncGenerator<string> {
  const queryTokens = new Set(scoreTokens(question));
  const candidates: { text: string; score: number; index: number }[] = [];

  results.slice(0, 4).forEach((result, index) => {
    for (const sentence of result.chunk.content.split(/(?<=[。！？；\n])/)) {
      const text = sentence.trim();
      if (text.length < 12) continue;
      const tokens = scoreTokens(text);
      const overlap = tokens.filter((token) => queryTokens.has(token)).length;
      candidates.push({
        text,
        score: overlap / Math.sqrt(tokens.length + 1),
        index,
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  const picked = candidates.slice(0, 5);

  if (diffs.length > 0) {
    yield `这个问题涉及版本差异。以下是 Next.js 15 与 16 的对照（以 16 为准）：`;
    for (const diff of diffs) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield `\n\n【${diff.title}】\n旧版（v15）：${diff.oldSummary}\n新版（v16）：${diff.newSummary}`;
      if (diff.note) yield `\n差异要点：${diff.note}`;
    }
    yield "\n\n下面补充检索到的原文片段：";
  } else {
    yield `根据知识库中的 ${results.length} 个相关片段，我找到了以下内容：`;
  }
  for (const item of picked) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    const version = results[item.index]?.chunk.version ?? "15";
    yield `\n\n${item.text} [Next.js ${version}] [${item.index + 1}]`;
  }
  yield "\n\n配置 LLM_API_KEY 后可切换到大模型生成模式，答案会更完整连贯。";
}

export async function* streamAnswer(
  question: string,
  results: SearchResult[],
  config: LLMConfig | null,
  diffs: VersionDiff[] = [],
): AsyncGenerator<string> {
  if (results.length === 0) {
    yield "知识库中暂时没有与这个问题相关的内容。可以换个问法试试，或确认已运行 `npm run ingest` 完成入库。";
    return;
  }
  if (!config) {
    yield* demoAnswer(question, results, diffs);
    return;
  }

  const system =
    "你是一个技术文档问答助手，同时掌握 Next.js 15 和 16 两套文档。只根据提供的参考资料回答，不要编造资料中没有的信息。当参考资料同时包含 v15 和 v16 时，以 v16 为最新结论作答，并明确说明新旧版本的区别。回答用中文，简洁清晰，并在关键结论后标注引用编号如 [1]。";
  const user = `参考资料：\n${buildContext(results)}${buildDiffContext(diffs)}\n\n用户问题：${question}`;

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      temperature: 0.3,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(`LLM API 调用失败 (${response.status}): ${detail.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip non-JSON keepalive lines
      }
    }
  }
}
