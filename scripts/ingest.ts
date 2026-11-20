import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { chunkMarkdown } from "../src/lib/chunker";
import { embedTexts, embeddingModelName, getEmbeddingConfig } from "../src/lib/embeddings";
import { saveIndex } from "../src/lib/vector-store";
import type { IndexedChunk } from "../src/lib/types";

async function main() {
  const docsDir = path.join(process.cwd(), "src", "data", "docs");
  const files = (await fs.readdir(docsDir)).filter((file) => file.endsWith(".md")).sort();
  if (files.length === 0) throw new Error("没有找到任何 .md 文档");

  const config = getEmbeddingConfig();
  console.log(`Embedding 模式: ${config ? config.label : "本地降级（哈希 bigram，无需 API Key）"}`);

  const allChunks = [];
  for (const file of files) {
    const markdown = await fs.readFile(path.join(docsDir, file), "utf8");
    const docId = file.replace(/\.md$/, "");
    const chunks = chunkMarkdown(markdown, docId, file);
    allChunks.push(...chunks);
    console.log(`  ${file}: ${chunks.length} 块`);
  }
  console.log(`共 ${allChunks.length} 块，开始生成向量...`);

  const batchSize = config ? 16 : 64;
  const embeddings: number[][] = [];
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const vectors = await embedTexts(
      batch.map((chunk) => `${chunk.title}\n${chunk.content}`),
      config,
    );
    embeddings.push(...vectors);
    console.log(`  进度 ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length}`);
  }

  const indexedChunks: IndexedChunk[] = allChunks.map((chunk, index) => ({
    ...chunk,
    embedding: embeddings[index],
  }));

  await saveIndex({
    version: 1,
    createdAt: new Date().toISOString(),
    model: embeddingModelName(config),
    mode: config ? "live" : "demo",
    chunks: indexedChunks,
  });

  console.log(`入库完成: data/index.json（${indexedChunks.length} 块）`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
