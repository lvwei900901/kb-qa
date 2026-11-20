import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { embedTexts, getEmbeddingConfig } from "../src/lib/embeddings";
import { loadIndex, search } from "../src/lib/vector-store";
import type { VectorIndex } from "../src/lib/types";

interface EvalCase {
  id: string;
  question: string;
  relevantDocs: string[];
}

const TOP_K = 5;

function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 0;
  const top = retrieved.slice(0, k);
  const hit = relevant.some((doc) => top.includes(doc));
  return hit ? 1 : 0;
}

function reciprocalRank(retrieved: string[], relevant: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

function printReport(results: {
  id: string;
  question: string;
  expected: string;
  retrieved: string[];
  hit: boolean;
  rank: number;
  score: number;
}[]) {
  console.log("\n逐条结果：");
  console.log("─".repeat(78));
  for (const r of results) {
    const mark = r.hit ? "✓" : "✗";
    const topDoc = r.retrieved[0] ?? "(无)";
    console.log(
      `${mark} ${r.id}  期望[${r.expected}]  首位=${topDoc}  得分=${r.score.toFixed(3)}`,
    );
    console.log(`    ${r.question}`);
  }
  console.log("─".repeat(78));
}

async function main() {
  const index = await loadIndex();
  if (!index) throw new Error("索引不存在，请先运行 npm run ingest");

  const config = getEmbeddingConfig();
  const evalPath = path.join(process.cwd(), "scripts", "eval-set.json");
  const cases = JSON.parse(await fs.readFile(evalPath, "utf8")) as EvalCase[];

  console.log(`评测模型: ${config ? config.model : "local-hash-bigram-v1"}`);
  console.log(`索引: ${(index as VectorIndex).chunks.length} 块 / ${index.model}`);
  console.log(`评测集: ${cases.length} 条，Top-K=${TOP_K}\n`);

  const questions = cases.map((item) => item.question);
  const vectors = await embedTexts(questions, config);

  const results: {
    id: string;
    question: string;
    expected: string;
    retrieved: string[];
    hit: boolean;
    rank: number;
    score: number;
  }[] = [];

  for (let i = 0; i < cases.length; i++) {
    const evalCase = cases[i];
    const hits = search(index, vectors[i], TOP_K);
    const retrieved = hits.map((hit) => hit.chunk.docId);
    const retrievedTopics = hits.map((hit) => hit.chunk.topic);
    const score = hits[0]?.score ?? 0;
    const isNegative = evalCase.relevantDocs.length === 0;

    results.push({
      id: evalCase.id,
      question: evalCase.question,
      expected: evalCase.relevantDocs.join("|") || "(应拒答)",
      retrieved,
      hit: isNegative
        ? score < 0.25
        : recallAtK(retrieved, evalCase.relevantDocs, TOP_K) === 1 ||
          recallAtK(retrievedTopics, evalCase.relevantDocs, TOP_K) === 1,
      rank: Math.max(
        reciprocalRank(retrieved, evalCase.relevantDocs),
        reciprocalRank(retrievedTopics, evalCase.relevantDocs),
      ),
      score,
    });
  }

  printReport(results);

  const answered = results.filter((r) => r.expected !== "(应拒答)");
  const rejected = results.filter((r) => r.expected === "(应拒答)" && r.hit);
  const recall = answered.reduce((sum, r) => sum + (r.hit ? 1 : 0), 0) / answered.length;
  const mrr = answered.reduce((sum, r) => sum + r.rank, 0) / answered.length;

  const negative = results.find((r) => r.expected === "(应拒答)");
  const rejectedCorrectly = rejected.length > 0;

  console.log("\n汇总指标：");
  console.log(`  Recall@${TOP_K}          ${(recall * 100).toFixed(1)}%  (${answered.filter((r) => r.hit).length}/${answered.length})`);
  console.log(`  MRR                  ${mrr.toFixed(3)}`);
  console.log(`  无关问题正确拒答      ${rejectedCorrectly ? "是" : "否"}  (最高分 ${negative?.score.toFixed(3) ?? "N/A"})`);

  const pass = recall >= 0.85 && mrr >= 0.7 && rejectedCorrectly;
  console.log(`\n结论: ${pass ? "通过" : "未达标"}（门槛 Recall≥85%, MRR≥0.7, 无关问题拒答）`);
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error("评测失败:", error);
  process.exit(1);
});
