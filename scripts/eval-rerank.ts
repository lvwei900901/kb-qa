import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { embedTexts, getEmbeddingConfig } from "../src/lib/embeddings";
import { loadIndex, search } from "../src/lib/vector-store";
import type { SearchResult } from "../src/lib/types";

interface EvalCase {
  id: string;
  question: string;
  relevantDocs: string[];
}

const TOP_K = 5;

// 与 src/lib/rag.ts 中的 rerank 完全一致的逻辑
function rerank(question: string, results: SearchResult[]): SearchResult[] {
  const query = question.toLowerCase();
  return [...results]
    .map((result) => {
      const title = result.chunk.title.toLowerCase();
      const leaf = title.split(" > ").pop() ?? "";
      const titleBonus = leaf && query.includes(leaf) ? 0.12 : 0;
      return { ...result, score: result.score + titleBonus };
    })
    .sort((a, b) => b.score - a.score);
}

function reciprocalRank(retrieved: string[], relevant: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  return relevant.some((doc) => retrieved.slice(0, k).includes(doc)) ? 1 : 0;
}

async function main() {
  const index = await loadIndex();
  if (!index) throw new Error("索引不存在，请先运行 npm run ingest");
  const config = getEmbeddingConfig();
  const evalPath = path.join(process.cwd(), "scripts", "eval-set.json");
  const cases = JSON.parse(await fs.readFile(evalPath, "utf8")) as EvalCase[];
  const vectors = await embedTexts(cases.map((c) => c.question), config);

  let changedAtTop1 = 0;
  let bonusTriggered = 0;
  const stats = { baseHit: 0, rerankHit: 0, baseRR: 0, rerankRR: 0, n: 0 };

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (c.relevantDocs.length === 0) continue; // 拒答题不参与排序对比
    const base = search(index, vectors[i], TOP_K);
    const reranked = rerank(c.question, search(index, vectors[i], 24)).slice(0, TOP_K);

    const baseIds = base.map((h) => h.chunk.docId);
    const baseTopics = base.map((h) => h.chunk.topic);
    const rerankIds = reranked.map((h) => h.chunk.docId);
    const rerankTopics = reranked.map((h) => h.chunk.topic);

    const baseHit = Math.max(
      recallAtK(baseIds, c.relevantDocs, TOP_K),
      recallAtK(baseTopics, c.relevantDocs, TOP_K),
    );
    const rerankHit = Math.max(
      recallAtK(rerankIds, c.relevantDocs, TOP_K),
      recallAtK(rerankTopics, c.relevantDocs, TOP_K),
    );
    const baseRR = Math.max(
      reciprocalRank(baseIds, c.relevantDocs),
      reciprocalRank(baseTopics, c.relevantDocs),
    );
    const rerankRR = Math.max(
      reciprocalRank(rerankIds, c.relevantDocs),
      reciprocalRank(rerankTopics, c.relevantDocs),
    );

    stats.baseHit += baseHit;
    stats.rerankHit += rerankHit;
    stats.baseRR += baseRR;
    stats.rerankRR += rerankRR;
    stats.n += 1;

    const query = c.question.toLowerCase();
    const anyTitleLeafMatched = search(index, vectors[i], 24).some((h) => {
      const leaf = h.chunk.title.toLowerCase().split(" > ").pop() ?? "";
      return leaf && query.includes(leaf);
    });
    if (anyTitleLeafMatched) bonusTriggered += 1;

    if (baseIds[0] !== rerankIds[0]) {
      changedAtTop1 += 1;
      console.log(
        `  [首位变化] ${c.id}  ${baseIds[0]} -> ${rerankIds[0]}  (${c.question})`,
      );
    }
  }

  const n = stats.n;
  console.log("\n=== A/B 对照结果（34 条有答案的问题）===");
  console.log(`  Recall@5   无 rerank ${((stats.baseHit / n) * 100).toFixed(1)}%   有 rerank ${((stats.rerankHit / n) * 100).toFixed(1)}%`);
  console.log(`  MRR        无 rerank ${(stats.baseRR / n).toFixed(4)}   有 rerank ${(stats.rerankRR / n).toFixed(4)}`);
  console.log(`  首位被改写 ${changedAtTop1}/${n} 条`);
  console.log(`  触发标题加分的题 ${bonusTriggered}/${n} 条`);
}

main().catch((error) => {
  console.error("实验失败:", error);
  process.exit(1);
});
