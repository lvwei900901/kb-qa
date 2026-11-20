import { ChatPanel } from "@/components/chat-panel";
import { loadIndex } from "@/lib/vector-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const index = await loadIndex().catch(() => null);
  return (
    <ChatPanel
      mode={index?.mode ?? "demo"}
      chunks={index?.chunks.length ?? 0}
    />
  );
}
