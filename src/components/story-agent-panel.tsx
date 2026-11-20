"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Check,
  Loader2,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StoryEvent, StoryToolRecord } from "@/lib/types";

const TOOL_LABELS: Record<string, string> = {
  plan_characters: "规划角色",
  design_twist: "设计转折",
  speak: "语音朗读",
};

const SUGGESTIONS = [
  "一只会说话的猫在雨夜寻找主人",
  "深海里一座会唱歌的灯塔",
  "偷走时间的钟表匠",
  "森林里最后一颗会发光的种子",
];

interface ToolTimelineItem {
  id: string;
  name: string;
  args: Record<string, string>;
  status: "running" | "done";
  result?: string;
}

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function ToolTimeline({ items }: { items: ToolTimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Wrench className="size-3.5" aria-hidden />
        Agent 工具调用过程
      </div>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-start gap-2.5 text-xs">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                item.status === "done"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
              )}
            >
              {item.status === "done" ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {TOOL_LABELS[item.name] ?? item.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  step {index + 1}
                </span>
              </div>
              {item.name === "speak" && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  音色：{item.args.voice === "male" ? "沉稳男声" : "温柔女声"}
                </p>
              )}
              {item.status === "done" && item.result && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {item.result}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StoryAgentPanel() {
  const [dark, setDark] = useState(false);
  const [topic, setTopic] = useState("");
  const [story, setStory] = useState("");
  const [tools, setTools] = useState<ToolTimelineItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [voice, setVoice] = useState<"female" | "male">("female");
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [story, tools, status]);

  // 组件卸载时停止朗读
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  function stopSpeech() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  function startSpeech(text: string, chosenVoice: "female" | "male") {
    if (!speechSupported || !text.trim()) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const zhVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("zh"));
    const preferFemale = chosenVoice === "female";
    const matched = zhVoices.find((v) =>
      preferFemale ? /xiaoxiao|huihui|tingting|female|女/i.test(v.name) : /yunxi|kangkang|male|男/i.test(v.name),
    );
    if (matched) utterance.voice = matched;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function generate(target: string) {
    const trimmed = target.trim();
    if (!trimmed || loading) return;
    stopSpeech();
    setTopic(trimmed);
    setStory("");
    setTools([]);
    setStatus("");
    setError("");
    setSpeechText("");
    setLoading(true);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `请求失败 (${response.status})`);
      }
      if (!response.body) throw new Error("响应没有内容");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const pendingCalls = new Map<string, string>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: StoryEvent;
          try {
            event = JSON.parse(line.slice(6)) as StoryEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              setStatus(event.message);
              break;
            case "delta":
              setStory((prev) => prev + event.text);
              break;
            case "tool_call": {
              const id = createId();
              pendingCalls.set(event.tool.name, id);
              setTools((prev) => [
                ...prev,
                {
                  id,
                  name: event.tool.name,
                  args: event.tool.args,
                  status: "running",
                },
              ]);
              break;
            }
            case "tool_result": {
              const record: StoryToolRecord = event.record;
              setTools((prev) =>
                prev.map((item) =>
                  item.name === record.name && item.status === "running"
                    ? { ...item, status: "done", result: record.result }
                    : item,
                ),
              );
              break;
            }
            case "speak":
              setSpeechText(event.text);
              setVoice(event.voice);
              break;
            case "done":
              setStatus(`完成 · 共调用 ${event.toolsUsed} 次工具`);
              break;
            case "error":
              setError(event.message);
              break;
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium text-foreground">故事 Agent</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Function Calling · 工具调用 · 流式成文 · 语音朗读
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">知识库问答</span>
          </Link>
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
        className="flex-1 overflow-y-auto"
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          {!story && tools.length === 0 && !loading && (
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="size-6" aria-hidden />
              </div>
              <h2 className="text-lg font-medium text-foreground">给一个主题，写一个故事</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                大模型会先自主调用工具规划角色与情节，再逐字写出故事，最后请求朗读精彩片段。
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => generate(item)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {(story || tools.length > 0) && (
            <article className="rounded-2xl border border-border bg-card p-5 sm:p-7">
              <ToolTimeline items={tools} />

              {status && (
                <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="size-3.5 text-green-600" aria-hidden />
                  )}
                  {status}
                </div>
              )}

              {story && (
                <>
                  <h2 className="mb-4 text-base font-medium text-foreground">故事正文</h2>
                  <div className="whitespace-pre-wrap text-[15px] leading-8 text-card-foreground">
                    {story}
                    {loading && (
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-middle" />
                    )}
                  </div>
                </>
              )}

              {speechText && (
                <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Volume2 className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">Agent 请求朗读精彩片段</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {speechText.slice(0, 60)}…
                    </p>
                  </div>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value as "female" | "male")}
                    aria-label="选择音色"
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                  >
                    <option value="female">温柔女声</option>
                    <option value="male">沉稳男声</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={() => startSpeech(speechText, voice)}
                    disabled={!speechSupported}
                  >
                    <Volume2 className="size-3.5" aria-hidden />
                    朗读
                  </Button>
                  {speaking && (
                    <Button size="sm" variant="outline" onClick={stopSpeech}>
                      <VolumeX className="size-3.5" aria-hidden />
                      停止
                    </Button>
                  )}
                </div>
              )}
              {!speechSupported && speechText && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  当前浏览器不支持语音合成，可更换 Chrome / Edge 后重试。
                </p>
              )}
            </article>
          )}
        </div>
      </main>

      <div className="border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              generate(topic);
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 pl-4 shadow-sm"
          >
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入故事主题，例如：一只会说话的猫在雨夜寻找主人"
              maxLength={200}
              aria-label="故事主题"
              className="min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            {story && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  stopSpeech();
                  setStory("");
                  setTools([]);
                  setStatus("");
                  setSpeechText("");
                }}
                aria-label="清空重写"
              >
                <RotateCcw className="size-4" aria-hidden />
              </Button>
            )}
            <Button type="submit" size="icon" disabled={loading || !topic.trim()} aria-label="生成故事">
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden />
              )}
            </Button>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            由 GLM-4-Flash 驱动 · Function Calling 真实调用 · 语音由浏览器本地合成
          </p>
        </div>
      </div>
    </div>
  );
}
