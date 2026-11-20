import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import { chunkMarkdown, parseFrontmatter } from "../src/lib/chunker";
import { embedTexts, embeddingModelName, getEmbeddingConfig } from "../src/lib/embeddings";
import { saveIndex } from "../src/lib/vector-store";
import type { IndexedChunk } from "../src/lib/types";

async function main() {
  const docsDir = path.join(process.cwd(), "src", "data", "docs");

  async function collectMarkdown(dir: string, prefix = ""): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result: string[] = [];
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        result.push(...(await collectMarkdown(path.join(dir, entry.name), relative)));
      } else if (entry.name.endsWith(".md")) {
        result.push(relative);
      }
    }
    return result.sort();
  }

  const files = await collectMarkdown(docsDir);
  if (files.length === 0) throw new Error("没有找到任何 .md 文档");

  const config = getEmbeddingConfig();
  console.log(`Embedding 模式: ${config ? config.label : "本地降级（哈希 bigram，无需 API Key）"}`);

  const allChunks = [];
  for (const file of files) {
    const markdown = await fs.readFile(path.join(docsDir, file), "utf8");
    const { version, topic, body } = parseFrontmatter(markdown);
    const baseId = file.replace(/\.md$/, "").replace(/\//g, "-");
    const docId = version === "16" ? baseId : baseId.replace(/-v16$/, "");
    const source = version === "16" ? `v16/${file.replace(/^v16\//, "")}` : file;
    const chunks = chunkMarkdown(body, docId, source, { version, topic });
    allChunks.push(...chunks);
    console.log(`  ${file} [v${version}/${topic}]: ${chunks.length} 块`);
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
