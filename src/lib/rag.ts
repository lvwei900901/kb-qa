import { embedTexts, getEmbeddingConfig } from "./embeddings";
import { getLLMConfig, streamAnswer } from "./llm";
import { loadIndex, search } from "./vector-store";
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

function toSources(results: SearchResult[]): Source[] {
  return results.map((result) => ({
    id: result.chunk.id,
    docId: result.chunk.docId,
    title: result.chunk.title,
    source: result.chunk.source,
    score: Number(result.score.toFixed(4)),
    excerpt: result.chunk.content.slice(0, 180),
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

  const threshold = embeddingConfig ? 0.25 : 0.15;
  const results = rerank(
    question,
    search(index, queryEmbedding, 12).filter((result) => result.score >= threshold),
  ).slice(0, 5);

  yield { type: "sources", sources: toSources(results) };
  yield { type: "status", message: "正在生成回答..." };

  const llmConfig = getLLMConfig();
  try {
    for await (const delta of streamAnswer(question, results, llmConfig)) {
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
