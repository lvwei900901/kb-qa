export interface EmbeddingConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  label: string;
}

const DIMENSION = 512;

export function getEmbeddingConfig(): EmbeddingConfig | null {
  const apiKey = process.env.EMBEDDING_API_KEY;
  if (!apiKey) return null;

  const provider = process.env.EMBEDDING_PROVIDER ?? "siliconflow";
  if (provider === "zhipu") {
    return {
      apiKey,
      model: process.env.EMBEDDING_MODEL ?? "embedding-3",
      baseUrl:
        process.env.EMBEDDING_BASE_URL ??
        "https://open.bigmodel.cn/api/paas/v4/embeddings",
      label: "智谱 embedding-3",
    };
  }
  if (provider === "dashscope") {
    return {
      apiKey,
      model: process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
      baseUrl:
        process.env.EMBEDDING_BASE_URL ??
        "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
      label: "阿里百炼 text-embedding-v3",
    };
  }
  return {
    apiKey,
    model: process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3",
    baseUrl:
      process.env.EMBEDDING_BASE_URL ??
      "https://api.siliconflow.cn/v1/embeddings",
    label: "硅基流动 bge-m3",
  };
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens: string[] = [];
  const words = normalized.match(/[a-z][a-z0-9_+.-]{1,}/g) ?? [];
  tokens.push(...words);
  const cjkSegments = normalized.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const segment of cjkSegments) {
    if (segment.length === 1) {
      tokens.push(segment);
      continue;
    }
    for (let i = 0; i < segment.length - 1; i++) {
      tokens.push(segment.slice(i, i + 2));
    }
  }
  return tokens;
}

function localEmbed(text: string): number[] {
  const vector = new Array<number>(DIMENSION).fill(0);
  for (const token of tokenize(text)) {
    const hash = hashToken(token);
    vector[hash % DIMENSION] += 1;
    vector[(hash >>> 9) % DIMENSION] += 0.5;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

async function embedWithApi(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, input: texts }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding API 调用失败 (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  const sorted = [...payload.data].sort((a, b) => a.index - b.index);
  return sorted.map((item) => item.embedding);
}

export async function embedTexts(
  texts: string[],
  config: EmbeddingConfig | null,
): Promise<number[][]> {
  if (config) return embedWithApi(texts, config);
  return texts.map(localEmbed);
}

export function embeddingModelName(config: EmbeddingConfig | null): string {
  return config ? config.model : "local-hash-bigram-v1";
}
