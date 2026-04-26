import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { FileDown, Pencil, Pin, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, truncate } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";

function downloadThread(threadId: string) {
  const store = useChatStore.getState();
  const thread = store.threads.find((item) => item.id === threadId);
  const messages = store.messagesByThread[threadId] ?? [];
  const markdown = [`# ${thread?.title ?? "Conversation"}`, ""]
    .concat(
      messages.flatMap((message) => [
        `## ${message.role === "user" ? "User" : "Assistant"} - ${new Date(message.timestamp).toLocaleString()}`,
        "",
        message.content,
        "",
      ]),
    )
    .join("\n");
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${thread?.title ?? "conversation"}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ThreadSidebar() {
  const {
    threads,
    activeThreadId,
    threadSearch,
    isLoadingThreads,
    setThreadSearch,
    createThread,
    loadThread,
    deleteThread,
    renameThread,
    togglePinThread,
  } = useChatStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => {
      const messages = useChatStore.getState().messagesByThread[thread.id] ?? [];
      return (
        thread.title.toLowerCase().includes(query) ||
        thread.preview.toLowerCase().includes(query) ||
        messages.some((message) => message.content.toLowerCase().includes(query))
      );
    });
  }, [threadSearch, threads]);

  return (
    <aside className="flex h-full flex-col gap-4">
      <div className="rounded-[1.75rem] border bg-card/90 p-4 shadow-panel">
        <Button className="w-full justify-start gap-3 rounded-2xl" onClick={() => createThread()}>
          <Plus className="h-4 w-4" />
          New Thread
        </Button>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={threadSearch}
            onChange={(event) => setThreadSearch(event.target.value)}
            placeholder="Search threads"
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-[1.75rem] border bg-card/80 p-3 shadow-panel">
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="text-sm font-semibold">History</p>
          <span className="text-xs text-muted-foreground">{threads.length} threads</span>
        </div>

        <div className="scrollbar-thin flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto pr-1">
          {isLoadingThreads ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border bg-muted/60 p-4">
                <div className="h-4 w-2/3 rounded bg-background/80" />
                <div className="mt-3 h-3 w-full rounded bg-background/70" />
              </div>
            ))
          ) : filteredThreads.length ? (
            filteredThreads.map((thread) => (
              <div
                key={thread.id}
                className={cn(
                  "rounded-2xl border p-3 transition hover:border-primary/40 hover:bg-muted/40",
                  activeThreadId === thread.id && "border-primary/40 bg-secondary/60",
                )}
              >
                <button className="w-full text-left" onClick={() => loadThread(thread.id)}>
                  <div className="flex items-start justify-between gap-2">
                    {renamingId === thread.id ? (
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(event) => setDraftTitle(event.target.value)}
                        onBlur={async () => {
                          const value = draftTitle.trim();
                          if (value) await renameThread(thread.id, value);
                          setRenamingId(null);
                        }}
                        onKeyDown={async (event) => {
                          if (event.key === "Enter") {
                            const value = draftTitle.trim();
                            if (value) await renameThread(thread.id, value);
                            setRenamingId(null);
                          }
                        }}
                        className="w-full rounded-lg border bg-background px-2 py-1 text-sm"
                      />
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{thread.title}</p>
                          {thread.pinned ? <Pin className="h-3.5 w-3.5 text-amber-500" /> : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{truncate(thread.preview || "No messages yet", 72)}</p>
                      </div>
                    )}
                    <span className="rounded-full bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {thread.message_count}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                  </p>
                </button>
                <div className="mt-3 flex gap-1 opacity-70">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setRenamingId(thread.id);
                      setDraftTitle(thread.title);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => togglePinThread(thread.id, !thread.pinned)}>
                    <Pin className={cn("h-4 w-4", thread.pinned && "text-amber-500")} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => downloadThread(thread.id)}>
                    <FileDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (window.confirm("Delete this conversation thread?")) {
                        await deleteThread(thread.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-center">
              <p className="font-medium">Start a new conversation</p>
              <p className="mt-2 text-sm text-muted-foreground">Your saved research threads will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
