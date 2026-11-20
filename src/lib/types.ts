export interface Chunk {
  id: string;
  docId: string;
  title: string;
  content: string;
  source: string;
  headingPath: string[];
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
}

export type ChatEvent =
  | { type: "status"; message: string }
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done"; mode: "demo" | "live" }
  | { type: "error"; message: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  mode?: "demo" | "live";
  pending?: boolean;
}
