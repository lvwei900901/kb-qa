"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  ChevronDown,
  FileText,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatEvent, ChatMessage, Source } from "@/lib/types";

const SUGGESTIONS = [
  "App Router 和 pages 目录有什么区别？",
  "什么时候该用 use client？",
  "Route Handler 怎么做流式输出？",
  "Next.js 15 的 params 怎么用？",
];

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function SourceList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <FileText className="size-3.5" aria-hidden />
        <span>参考了 {sources.length} 个片段</span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5" aria-label="引用来源列表">
          {sources.map((source, index) => (
            <li
              key={source.id}
              className="rounded-md bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-foreground/80">
                  [{index + 1}] {source.title}
                </span>
                <span className="shrink-0 font-mono tabular-nums">{source.score.toFixed(3)}</span>
              </div>
              <p className="mt-1 line-clamp-2 leading-relaxed">{source.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const typing = message.pending && message.content.length === 0;
  return (
    <div className="flex gap-2.5 sm:gap-3 animate-fade-up">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Sparkles className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
        {typing ? (
          <div className="flex items-center gap-1 py-1" role="status" aria-label="正在生成回答">
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.15s]" />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground [animation-delay:0.3s]" />
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-7 text-card-foreground">
              {message.content}
              {message.pending && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle" />
              )}
            </p>
            <SourceList sources={message.sources ?? []} />
          </>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ mode, chunks }: { mode: "demo" | "live"; chunks: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("kb-theme", next ? "dark" : "light");
    } catch {
      // storage unavailable
    }
  }

  function updateAssistant(id: string, updater: (message: ChatMessage) => ChatMessage) {
    setMessages((previous) =>
      previous.map((message) => (message.id === id ? updater(message) : message)),
    );
  }

  function handleEvent(id: string, event: ChatEvent) {
    switch (event.type) {
      case "status":
        setStatus(event.message);
        break;
      case "sources":
        updateAssistant(id, (message) => ({ ...message, sources: event.sources }));
        break;
      case "delta":
        updateAssistant(id, (message) => ({ ...message, content: message.content + event.text }));
        break;
      case "done":
        setStatus("");
        updateAssistant(id, (message) => ({ ...message, pending: false, mode: event.mode }));
        break;
      case "error":
        setStatus("");
        setError(event.message);
        updateAssistant(id, (message) => ({
          ...message,
          pending: false,
          content: message.content || "回答生成失败，请稍后重试。",
        }));
        break;
    }
  }

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || status) return;

    setError(null);
    setInput("");
    const assistantId = createId();
    setMessages((previous) => [
      ...previous,
      { id: createId(), role: "user", content: trimmed },
      { id: assistantId, role: "assistant", content: "", pending: true },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `请求失败 (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split("\n").find((item) => item.startsWith("data:"));
          if (!line) continue;
          try {
            handleEvent(assistantId, JSON.parse(line.slice(5).trim()) as ChatEvent);
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "请求失败，请重试。";
      setError(message);
      setStatus("");
      setMessages((previous) => previous.filter((item) => item.id !== assistantId));
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-foreground">知识库问答</h1>
            <p className="truncate text-[11px] text-muted-foreground">Next.js 技术文档 · 语义检索</p>
          </div>
          <span
            className={cn(
              "hidden rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-block",
              mode === "live"
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            )}
          >
            {mode === "live" ? "真实模式" : "演示模式"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
          >
            {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          </Button>
        </div>
      </header>

      <main
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="对话记录"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
          {empty ? (
            <section className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-up">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Sparkles className="size-7" aria-hidden />
              </div>
              <h2 className="mt-5 text-xl font-medium text-foreground sm:text-2xl">
                你想了解什么？
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                基于 {chunks} 个知识片段的 Next.js 技术文档问答。
                {mode === "demo" && " 当前为演示模式，配置 API Key 后可启用真实语义检索。"}
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-card-foreground shadow-sm transition-colors hover:border-primary/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="space-y-6">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end animate-fade-up">
                    <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground sm:max-w-[70%]">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <AssistantBubble key={message.id} message={message} />
                ),
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6">
          {error && (
            <div
              role="alert"
              className="mb-2.5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="关闭错误提示"
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={status || "输入你的问题，回车发送..."}
              aria-label="输入你的问题"
              disabled={Boolean(status)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || Boolean(status)}
              aria-label="发送问题"
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setMessages([]);
                  setError(null);
                  setStatus("");
                }}
                aria-label="开始新对话"
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            回答基于知识库片段生成，请注意核对引用来源
          </p>
        </div>
      </footer>
    </div>
  );
}
