export type DocVersion = "15" | "16";

export interface Chunk {
  id: string;
  docId: string;
  title: string;
  content: string;
  source: string;
  headingPath: string[];
  version: DocVersion;
  topic: string;
}

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface VectorIndex {
  version: number;
  createdAt: string;
  model: string;
  mode: "demo" | "live";
  chunks: IndexedChunk[];
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface Source {
  id: string;
  docId: string;
  title: string;
  source: string;
  score: number;
  excerpt: string;
  version: DocVersion;
}

export interface VersionDiff {
  topic: string;
  title: string;
  oldSummary: string;
  newSummary: string;
  oldSource: string;
  newSource: string;
  note?: string;
}

export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "sources"; sources: Source[] }
  | { type: "version_diff"; diffs: VersionDiff[] }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "demo" | "live" }
  | { type: "error"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  versionDiffs?: VersionDiff[];
  mode?: "demo" | "live";
  pending?: boolean;
}
