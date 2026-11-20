import { embedTexts, getEmbeddingConfig } from "./embeddings";
import { getLLMConfig, streamAnswer } from "./llm";
import { loadIndex, search } from "./vector-store";
import { buildVersionDiffs, isVersionQuestion } from "./version-diff";
import type { ChatEvent, SearchResult, Source } from "./types";

function rerank(question: string, results: SearchResult[]): SearchResult[] {
  const query = question.toLowerCase();
  return [...results]
    .map((result) => {
      const title = result.chunk.title.toLowerCase();
      const titleBonus = query.includes(title.split(" > ").pop() ?? "") ? 0.12 : 0;
      return { ...result, score: result.score + titleBonus };
    })
    .sort((a, b) => b.score - a.score);
}

function diversifyVersions(results: SearchResult[]): SearchResult[] {
  const picked: SearchResult[] = [];
  const seenTopics = new Map<string, { v15: number; v16: number }>();
  for (const result of results) {
    const topic = result.chunk.topic;
    const seen = seenTopics.get(topic) ?? { v15: 0, v16: 0 };
    const isV16 = result.chunk.version === "16";
    if (isV16 ? seen.v16 >= 1 : seen.v15 >= 1) continue;
    picked.push(result);
    if (isV16) seen.v16 += 1;
    else seen.v15 += 1;
    seenTopics.set(topic, seen);
    if (picked.length >= 12) break;
  }
  return picked.sort((a, b) => {
    if (a.chunk.version !== b.chunk.version) return a.chunk.version === "16" ? -1 : 1;
    return b.score - a.score;
  });
}

function toSources(results: SearchResult[]): Source[] {
  return results.map((result) => ({
    id: result.chunk.id,
    docId: result.chunk.docId,
    title: result.chunk.title,
    source: result.chunk.source,
    score: Number(result.score.toFixed(4)),
    excerpt: result.chunk.content.slice(0, 180),
    version: result.chunk.version,
  }));
}

export async function* runRag(question: string): AsyncGenerator<ChatEvent> {
  const index = await loadIndex();
  if (!index) {
    yield { type: "error", message: "知识库索引不存在，请先运行 npm run ingest 完成入库。" };
    return;
  }

  yield { type: "status", message: "正在检索相关知识..." };
  const embeddingConfig = getEmbeddingConfig();
  const [queryEmbedding] = await embedTexts([question], embeddingConfig);

  const threshold = embeddingConfig ? 0.22 : 0.13;
  const wantsVersions = isVersionQuestion(question);
  const candidates = search(index, queryEmbedding, 24).filter((result) => result.score >= threshold);

  let results = rerank(question, candidates);
  if (wantsVersions) results = diversifyVersions(results);
  results = results.slice(0, 6);

  const diffs = wantsVersions ? buildVersionDiffs(question, candidates) : [];

  yield { type: "sources", sources: toSources(results) };
  if (diffs.length > 0) yield { type: "version_diff", diffs };

  yield { type: "status", message: "正在生成回答..." };

  const llmConfig = getLLMConfig();
  try {
    for await (const delta of streamAnswer(question, results, llmConfig, diffs)) {
      yield { type: "delta", text: delta };
    }
    yield { type: "done", mode: llmConfig ? "live" : "demo" };
  } catch (error) {
    yield {
      type: "error",
      message: error instanceof Error ? error.message : "生成回答时发生未知错误。",
    };
  }
}
