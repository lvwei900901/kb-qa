import type { Chunk, DocVersion } from "./types";

interface Section {
  headingPath: string[];
  lines: string[];
}

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
  version?: DocVersion;
  topic?: string;
}

export interface Frontmatter {
  version: DocVersion;
  topic: string;
  body: string;
}

export function parseFrontmatter(markdown: string): Frontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) {
    return { version: "15", topic: "general", body: markdown };
  }
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  return {
    version: meta.version === "16" ? "16" : "15",
    topic: meta.topic || "general",
    body: markdown.slice(match[0].length),
  };
}

function splitLongText(text: string, maxChars: number, overlapChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const pieces: string[] = [];
  const sentences = text.split(/(?<=[。！？.!?\n])/);
  let buffer = "";

  for (const sentence of sentences) {
    if (buffer.length + sentence.length > maxChars && buffer.length > 0) {
      pieces.push(buffer.trim());
      const tail = buffer.slice(-overlapChars);
      buffer = tail + sentence;
    } else {
      buffer += sentence;
    }
  }
  if (buffer.trim()) pieces.push(buffer.trim());

  const finalPieces: string[] = [];
  for (const piece of pieces) {
    if (piece.length <= maxChars) {
      finalPieces.push(piece);
      continue;
    }
    let start = 0;
    while (start < piece.length) {
      finalPieces.push(piece.slice(start, start + maxChars).trim());
      start += maxChars - overlapChars;
    }
  }
  return finalPieces.filter(Boolean);
}

export function chunkMarkdown(
  markdown: string,
  docId: string,
  source: string,
  options: ChunkOptions = {},
): Chunk[] {
  const maxChars = options.maxChars ?? 800;
  const overlapChars = options.overlapChars ?? 120;
  const version = options.version ?? "15";
  const topic = options.topic ?? "general";
  const sections: Section[] = [];
  let headingPath: string[] = [];
  let current: Section | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/[#*`]/g, "").trim();
      headingPath = [...headingPath.slice(0, level - 1), title];
      current = { headingPath: [...headingPath], lines: [line] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const chunks: Chunk[] = [];
  let counter = 0;
  for (const section of sections) {
    const text = section.lines.join("\n").trim();
    if (text.length < 20) continue;

    for (const piece of splitLongText(text, maxChars, overlapChars)) {
      chunks.push({
        id: `${docId}-${counter++}`,
        docId,
        title: section.headingPath.join(" > "),
        content: piece,
        source,
        headingPath: section.headingPath,
        version,
        topic,
      });
    }
  }
  return chunks;
}
