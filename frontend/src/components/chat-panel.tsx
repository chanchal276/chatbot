import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, Send, Sparkles, Square, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStore } from "@/store/chat-store";
import { MessageBubble } from "@/components/message-bubble";

const exampleQuestions = [
  "What's new in Tableau 2024?",
  "Upload a document",
  "Compare tools",
];

export function ChatPanel() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const {
    activeThreadId,
    messagesByThread,
    isSending,
    sendMessage,
    createThread,
    uploadDocument,
    settings,
  } = useChatStore();

  const messages = useMemo(() => (activeThreadId ? messagesByThread[activeThreadId] ?? [] : []), [activeThreadId, messagesByThread]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [draft]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        textareaRef.current?.focus();
      }
      if (event.key === "Escape") {
        setDraft("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const onSubmit = async () => {
    const value = draft.trim();
    if (!value || isSending) return;
    setDraft("");
    await sendMessage(value);
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Web Speech API is not available in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setDraft((current) => `${current}${current ? " " : ""}${transcript}`.trim());
    };
    recognition.start();
  };

  return (
    <section className="flex h-full min-h-[70vh] flex-col rounded-[2rem] border bg-card/90 shadow-panel">
      <div className="flex items-center justify-between border-b px-6 py-5">
        <div>
          <h1 className="text-xl font-semibold">Smart Research Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            {activeThreadId ? `Thread ${activeThreadId.slice(0, 8)} loaded` : "Start a new conversation"}
          </p>
        </div>
        <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          {settings.webSearchEnabled ? "Web + Docs" : "Docs Only"}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-6">
        {messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
            <div className="animate-float rounded-[2rem] bg-secondary p-5 text-secondary-foreground shadow-lg">
              <Bot className="h-10 w-10" />
            </div>
            <h3 className="mt-6 text-2xl font-semibold">Welcome to your research cockpit</h3>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Ask questions across uploaded documents and the web, then come back later with full thread history intact.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {exampleQuestions.map((question) => (
                <button
                  key={question}
                  className="rounded-full border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                  onClick={async () => {
                    if (!activeThreadId) createThread();
                    await sendMessage(question);
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {isSending ? (
          <div className="flex justify-start">
            <div className="rounded-[1.75rem] rounded-bl-md border bg-card px-5 py-4 shadow-sm">
              <div className="flex items-center gap-2">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-2.5 w-2.5 rounded-full bg-primary animate-pulseDot"
                    style={{ animationDelay: `${index * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t px-4 py-4 md:px-6">
        <div className="rounded-[1.75rem] border bg-background/80 p-3">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about your documents, compare findings, or continue a saved thread..."
            className="max-h-60 min-h-[96px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
            onKeyDown={async (event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                await onSubmit();
              }
            }}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Enter to send, Shift+Enter for newline, Ctrl+K to focus
            </div>
            <div className="flex items-center gap-2">
              <input
                id="quick-upload"
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    await uploadDocument(file);
                    toast.success(`${file.name} uploaded.`);
                  }
                }}
              />
              <Button variant="outline" size="icon" onClick={() => document.getElementById("quick-upload")?.click()}>
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={startVoiceInput}>
                {isListening ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button onClick={onSubmit} disabled={!draft.trim() || isSending}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
        {messages.length ? (
          <p className="mt-3 text-right text-xs text-muted-foreground">
            Last activity {format(new Date(messages[messages.length - 1].timestamp), "PPpp")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start: () => void;
  }

  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
  }
}
