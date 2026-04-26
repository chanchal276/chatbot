import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { client, getApiErrorMessage } from "@/lib/api";
import type { AppSettings, ChatMessage, DocumentItem, ThreadSummary } from "@/types";

interface ChatStore {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  messagesByThread: Record<string, ChatMessage[]>;
  documents: DocumentItem[];
  isSidebarOpen: boolean;
  isDocumentsOpen: boolean;
  isSettingsOpen: boolean;
  isSending: boolean;
  isLoadingThreads: boolean;
  isLoadingDocuments: boolean;
  healthStatus: "checking" | "connected" | "disconnected";
  uploadProgress: number;
  threadSearch: string;
  settings: AppSettings;
  feedback: Record<string, "up" | "down">;
  error: string | null;
  initialize: () => Promise<void>;
  refreshThreads: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  loadThread: (threadId: string) => Promise<void>;
  createThread: () => string;
  sendMessage: (question: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  togglePinThread: (threadId: string, pinned: boolean) => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  setThreadSearch: (value: string) => void;
  setSidebarOpen: (value: boolean) => void;
  setDocumentsOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setHealthStatus: (value: ChatStore["healthStatus"]) => void;
  setSettings: (patch: Partial<AppSettings>) => void;
  rateMessage: (messageId: string, value: "up" | "down") => void;
  retryLastUserMessage: () => Promise<void>;
  clearState: () => void;
}

const defaultSettings: AppSettings = {
  userId: "default",
  autoCreateThread: true,
  maxMessagesPerThread: 100,
  webSearchEnabled: true,
  maxNeo4jResults: 3,
  maxWebResults: 2,
  fontSize: "medium",
  showConfidence: true,
  showSources: true,
  defaultThreadId: "",
  apiKey: "",
};

function sortThreads(threads: ThreadSummary[]) {
  return [...threads].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      threads: [],
      activeThreadId: null,
      messagesByThread: {},
      documents: [],
      isSidebarOpen: true,
      isDocumentsOpen: true,
      isSettingsOpen: false,
      isSending: false,
      isLoadingThreads: false,
      isLoadingDocuments: false,
      healthStatus: "checking",
      uploadProgress: 0,
      threadSearch: "",
      settings: defaultSettings,
      feedback: {},
      error: null,
      initialize: async () => {
        await Promise.allSettled([get().refreshThreads(), get().refreshDocuments()]);
        const { threads, activeThreadId, settings } = get();
        if (activeThreadId && threads.some((thread) => thread.id === activeThreadId)) {
          await get().loadThread(activeThreadId);
        } else if (settings.defaultThreadId) {
          await get().loadThread(settings.defaultThreadId).catch(() => undefined);
        } else if (threads[0]) {
          await get().loadThread(threads[0].id);
        } else if (settings.autoCreateThread) {
          get().createThread();
        }
      },
      refreshThreads: async () => {
        set({ isLoadingThreads: true, error: null });
        try {
          const threads = await client.getThreads();
          set({ threads: sortThreads(threads), isLoadingThreads: false });
        } catch (error) {
          set({ error: getApiErrorMessage(error), isLoadingThreads: false });
        }
      },
      refreshDocuments: async () => {
        set({ isLoadingDocuments: true });
        try {
          const documents = await client.getDocuments();
          set({ documents, isLoadingDocuments: false });
        } catch (error) {
          set({ error: getApiErrorMessage(error), isLoadingDocuments: false });
        }
      },
      loadThread: async (threadId) => {
        set({ activeThreadId: threadId, error: null });
        try {
          const data = await client.getThread(threadId);
          set((state) => ({
            activeThreadId: threadId,
            messagesByThread: {
              ...state.messagesByThread,
              [threadId]: data.messages,
            },
            threads: sortThreads(
              state.threads.some((thread) => thread.id === data.thread.id)
                ? state.threads.map((thread) => (thread.id === data.thread.id ? data.thread : thread))
                : [data.thread, ...state.threads],
            ),
          }));
        } catch (error) {
          set({ error: getApiErrorMessage(error) });
        }
      },
      createThread: () => {
        const threadId = uuidv4();
        const now = new Date().toISOString();
        const summary: ThreadSummary = {
          id: threadId,
          title: "New Conversation",
          preview: "",
          created_at: now,
          updated_at: now,
          message_count: 0,
          pinned: false,
          tags: [],
        };
        set((state) => ({
          activeThreadId: threadId,
          threads: sortThreads([summary, ...state.threads.filter((thread) => thread.id !== threadId)]),
          messagesByThread: {
            ...state.messagesByThread,
            [threadId]: [],
          },
        }));
        return threadId;
      },
      sendMessage: async (question) => {
        const state = get();
        const currentThreadId = state.activeThreadId || state.createThread();
        const userMessage: ChatMessage = {
          id: uuidv4(),
          role: "user",
          content: question,
          timestamp: new Date().toISOString(),
        };

        set((current) => ({
          isSending: true,
          error: null,
          activeThreadId: currentThreadId,
          messagesByThread: {
            ...current.messagesByThread,
            [currentThreadId]: [...(current.messagesByThread[currentThreadId] ?? []), userMessage],
          },
        }));

        try {
          const response = await client.sendMessage({
            question,
            thread_id: currentThreadId,
            user_id: state.settings.userId,
          });

          const assistantMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: response.answer,
            timestamp: new Date().toISOString(),
            confidence: response.confidence,
            sources: response.sources,
            follow_up_suggestions: response.follow_up_suggestions,
          };

          set((current) => {
            const nextMessages = [...(current.messagesByThread[currentThreadId] ?? []), assistantMessage];
            const existingThread = current.threads.find((thread) => thread.id === currentThreadId);
            const title = existingThread?.message_count ? existingThread.title : question.slice(0, 60);
            const summary: ThreadSummary = {
              id: response.thread_id,
              title: title || "New Conversation",
              preview: response.answer.slice(0, 140),
              created_at: existingThread?.created_at || userMessage.timestamp,
              updated_at: assistantMessage.timestamp,
              message_count: nextMessages.length,
              pinned: existingThread?.pinned ?? false,
              tags: existingThread?.tags ?? [],
            };
            return {
              isSending: false,
              activeThreadId: response.thread_id,
              messagesByThread: {
                ...current.messagesByThread,
                [response.thread_id]: nextMessages,
              },
              threads: sortThreads([
                summary,
                ...current.threads.filter((thread) => thread.id !== response.thread_id),
              ]),
            };
          });
        } catch (error) {
          set({ isSending: false, error: getApiErrorMessage(error) });
        }
      },
      deleteThread: async (threadId) => {
        await client.deleteThread(threadId);
        set((state) => {
          const nextThreads = state.threads.filter((thread) => thread.id !== threadId);
          const nextActive = state.activeThreadId === threadId ? nextThreads[0]?.id ?? null : state.activeThreadId;
          const nextMessages = { ...state.messagesByThread };
          delete nextMessages[threadId];
          return {
            threads: nextThreads,
            activeThreadId: nextActive,
            messagesByThread: nextMessages,
          };
        });
      },
      renameThread: async (threadId, title) => {
        const updated = await client.updateThread(threadId, { title });
        set((state) => ({
          threads: sortThreads(state.threads.map((thread) => (thread.id === threadId ? updated : thread))),
        }));
      },
      togglePinThread: async (threadId, pinned) => {
        const updated = await client.updateThread(threadId, { pinned });
        set((state) => ({
          threads: sortThreads(state.threads.map((thread) => (thread.id === threadId ? updated : thread))),
        }));
      },
      uploadDocument: async (file) => {
        set({ uploadProgress: 15, error: null });
        try {
          await client.uploadDocument(file, get().settings.userId);
          set({ uploadProgress: 100 });
          await get().refreshDocuments();
          set({ uploadProgress: 0 });
        } catch (error) {
          set({ uploadProgress: 0, error: getApiErrorMessage(error) });
          throw error;
        }
      },
      setThreadSearch: (value) => set({ threadSearch: value }),
      setSidebarOpen: (value) => set({ isSidebarOpen: value }),
      setDocumentsOpen: (value) => set({ isDocumentsOpen: value }),
      setSettingsOpen: (value) => set({ isSettingsOpen: value }),
      setHealthStatus: (value) => set({ healthStatus: value }),
      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      rateMessage: (messageId, value) => set((state) => ({ feedback: { ...state.feedback, [messageId]: value } })),
      retryLastUserMessage: async () => {
        const { activeThreadId, messagesByThread } = get();
        if (!activeThreadId) return;
        const messages = messagesByThread[activeThreadId] ?? [];
        const lastUser = [...messages].reverse().find((message) => message.role === "user");
        if (lastUser) {
          await get().sendMessage(lastUser.content);
        }
      },
      clearState: () =>
        set({
          threads: [],
          activeThreadId: null,
          messagesByThread: {},
          documents: [],
          isSending: false,
          isLoadingThreads: false,
          isLoadingDocuments: false,
          uploadProgress: 0,
          threadSearch: "",
          error: null,
        }),
    }),
    {
      name: "smart-research-chatbot-store",
      partialize: (state) => ({
        settings: state.settings,
        isSidebarOpen: state.isSidebarOpen,
        feedback: state.feedback,
      }),
    },
  ),
);
