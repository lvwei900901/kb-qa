import type { SearchResult, VersionDiff } from "./types";

interface TopicHint {
  topic: string;
  title: string;
  keywords: string[];
  note: string;
}

const TOPIC_HINTS: TopicHint[] = [
  {
    topic: "routing",
    title: "路由与请求 API",
    keywords: ["params", "searchparams", "middleware", "proxy", "turbopack", "路由", "请求", "cookie", "header", "异步"],
    note: "v16 中同步访问 param/cookie/header 已被完全移除，middleware 改名为 proxy。",
  },
  {
    topic: "data-fetching",
    title: "数据获取与缓存",
    keywords: ["revalidatetag", "updatetag", "cachelife", "cachetag", "缓存", "cache", "ppr", "prerender"],
    note: "v16 的 revalidateTag 必须传第二个 profile 参数，新增 updateTag。",
  },
  {
    topic: "route-handlers",
    title: "Route Handler 与 Server Action",
    keywords: ["route handler", "server action", "api", "接口", "revalidate", "image", "图片"],
    note: "v16 的 route context params 变为 Promise，next/image 默认值调整。",
  },
  {
    topic: "server-components",
    title: "Server/Client Components",
    keywords: ["use client", "server component", "client component", "compiler", "react", "amp", "lint"],
    note: "v16 基于 React 19.2，React Compiler 稳定，AMP 与 next lint 被移除。",
  },
  {
    topic: "layouts",
    title: "布局与页面",
    keywords: ["layout", "template", "布局", "滚动", "scroll", "parallel", "平行路由", "default"],
    note: "v16 的 layout params 变为 Promise，默认不再覆盖 scroll-behavior。",
  },
  {
    topic: "streaming",
    title: "流式渲染与构建",
    keywords: ["stream", "suspense", "streaming", "build", "compile", "编译", "流式"],
    note: "v16 默认使用 Turbopack，构建产物不再输出体积指标。",
  },
];

export function isVersionQuestion(question: string): boolean {
  const q = question.toLowerCase();
  const explicit = /v?16|v?15|16版|15版|新版|旧版|升级|upgrade|区别|不同|变化|breaking|迁移|migrat|差异|以前|之前|现在/.test(q);
  if (explicit) return true;
  return TOPIC_HINTS.some((hint) => hint.keywords.some((keyword) => q.includes(keyword)));
}

function firstSentence(text: string, max = 130): string {
  const clean = text
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[`*]/g, "")
    .trim();
  const match = clean.split(/(?<=[。！？；\n])/).find((s) => s.trim().length > 20);
  const sentence = (match ?? clean).trim();
  return sentence.length > max ? `${sentence.slice(0, max)}…` : sentence;
}

export function buildVersionDiffs(
  question: string,
  results: SearchResult[],
): VersionDiff[] {
  const q = question.toLowerCase();
  const byTopic = new Map<string, { old?: SearchResult; newer?: SearchResult }>();

  for (const result of results) {
    const topic = result.chunk.topic;
    if (!byTopic.has(topic)) byTopic.set(topic, {});
    const entry = byTopic.get(topic)!;
    if (result.chunk.version === "15" && !entry.old) entry.old = result;
    if (result.chunk.version === "16" && !entry.newer) entry.newer = result;
  }

  const diffs: VersionDiff[] = [];
  for (const [topic, pair] of byTopic.entries()) {
    if (!pair.old || !pair.newer) continue;
    const hint = TOPIC_HINTS.find((h) => h.topic === topic);
    const title = hint?.title ?? topic;
    const changed = firstSentence(pair.newer.chunk.content);
    diffs.push({
      topic,
      title,
      oldSummary: firstSentence(pair.old.chunk.content),
      newSummary: changed,
      oldSource: pair.old.chunk.title,
      newSource: pair.newer.chunk.title,
      note: hint?.note,
    });
  }

  if (diffs.length === 0) {
    for (const hint of TOPIC_HINTS) {
      if (!hint.keywords.some((keyword) => q.includes(keyword))) continue;
      const old = results.find((r) => r.chunk.version === "15" && r.chunk.topic === hint.topic);
      const newer = results.find((r) => r.chunk.version === "16" && r.chunk.topic === hint.topic);
      if (!old || !newer) continue;
      diffs.push({
        topic: hint.topic,
        title: hint.title,
        oldSummary: firstSentence(old.chunk.content),
        newSummary: firstSentence(newer.chunk.content),
        oldSource: old.chunk.title,
        newSource: newer.chunk.title,
        note: hint.note,
      });
    }
  }

  return diffs.slice(0, 3);
}
