import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { estimateSourcePreview, getSourceLabel } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import { useTheme } from "@/theme/theme-provider";
import type { ChatMessage } from "@/types";

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null;
  const variant = confidence > 0.7 ? "success" : confidence >= 0.5 ? "warning" : "danger";
  const label = confidence > 0.7 ? "High confidence" : confidence >= 0.5 ? "Medium confidence" : "Low confidence";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant}>
          <span className="mr-2 h-2 w-2 rounded-full bg-current opacity-80" />
          {Math.round(confidence * 100)}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();
  const { rateMessage, feedback, retryLastUserMessage, settings } = useChatStore();
  const isUser = message.role === "user";

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[92%] md:max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-3`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={
                isUser
                  ? "rounded-[1.75rem] rounded-br-md bg-gradient-to-br from-sky-500 to-blue-700 px-5 py-4 text-white shadow-lg"
                  : "rounded-[1.75rem] rounded-bl-md border bg-card px-5 py-4 text-card-foreground shadow-sm"
              }
            >
              {isUser ? (
                <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-code:before:hidden prose-code:after:hidden">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code(props) {
                        const { children, className, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || "");
                        if (!match) {
                          return (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...rest}>
                              {children}
                            </code>
                          );
                        }
                        const text = String(children).replace(/\n$/, "");
                        return (
                          <div className="not-prose overflow-hidden rounded-2xl border">
                            <div className="flex items-center justify-between bg-slate-900 px-4 py-2 text-xs text-slate-200">
                              <span>{match[1]}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-slate-200 hover:bg-slate-800 hover:text-white"
                                onClick={() => navigator.clipboard.writeText(text)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </Button>
                            </div>
                            <SyntaxHighlighter
                              {...rest}
                              language={match[1]}
                              style={theme === "dark" ? oneDark : oneLight}
                              customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.85rem" }}
                            >
                              {text}
                            </SyntaxHighlighter>
                          </div>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{format(new Date(message.timestamp), "p")}</TooltipContent>
        </Tooltip>

        {!isUser && (
          <div className="flex w-full flex-wrap items-center gap-2">
            {settings.showConfidence && <ConfidenceBadge confidence={message.confidence} />}
            {settings.showSources &&
              message.sources?.map((source) => (
                <Tooltip key={source}>
                  <TooltipTrigger asChild>
                    <a
                      href={source.startsWith("http") ? source : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                    >
                      {getSourceLabel(source)}
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>{estimateSourcePreview(source)}</TooltipContent>
                </Tooltip>
              ))}
          </div>
        )}

        {!isUser && message.follow_up_suggestions?.length ? (
          <div className="flex flex-wrap gap-2">
            {message.follow_up_suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/75"
                onClick={() => useChatStore.getState().sendMessage(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {!isUser && (
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            <Button variant="ghost" size="icon" onClick={copyMessage}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => rateMessage(message.id, "up")}>
              <ThumbsUp className={`h-4 w-4 ${feedback[message.id] === "up" ? "text-emerald-600" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => rateMessage(message.id, "down")}>
              <ThumbsDown className={`h-4 w-4 ${feedback[message.id] === "down" ? "text-rose-600" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => retryLastUserMessage()}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
