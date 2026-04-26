import axios from "axios";
import type { AuthUser, ChatResponse, DocumentItem, ThreadResponse, ThreadSummary } from "@/types";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smart-research-auth-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const client = {
  async health() {
    return api.get<{ status: string; service: string }>("/health").then((res) => res.data);
  },
  async sendMessage(payload: { question: string; thread_id?: string | null; user_id?: string }) {
    return api.post<ChatResponse>("/chat", payload).then((res) => res.data);
  },
  async uploadDocument(file: File, userId: string) {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post("/upload", formData, {
        params: { user_id: userId },
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },
  async getDocuments() {
    return api.get<{ documents: DocumentItem[] }>("/documents").then((res) => res.data.documents);
  },
  async getThreads() {
    return api.get<{ threads: ThreadSummary[] }>("/threads").then((res) => res.data.threads);
  },
  async getThread(threadId: string) {
    return api.get<ThreadResponse>(`/threads/${threadId}`).then((res) => res.data);
  },
  async updateThread(threadId: string, payload: { title?: string; pinned?: boolean; tags?: string[] }) {
    return api.patch<{ thread: ThreadSummary }>(`/threads/${threadId}`, payload).then((res) => res.data.thread);
  },
  async deleteThread(threadId: string) {
    return api.delete(`/threads/${threadId}`).then((res) => res.data);
  },
  async register(payload: { email: string; password: string; full_name: string }) {
    return api.post<{ user: AuthUser; token: string }>("/auth/register", payload).then((res) => res.data);
  },
  async login(payload: { email: string; password: string }) {
    return api.post<{ user: AuthUser; token: string }>("/auth/login", payload).then((res) => res.data);
  },
  async logout() {
    return api.post("/auth/logout").then((res) => res.data);
  },
  async me() {
    return api.get<{ user: AuthUser }>("/auth/me").then((res) => res.data.user);
  },
  async updateProfile(payload: { full_name: string }) {
    return api.patch<{ user: AuthUser }>("/auth/profile", payload).then((res) => res.data.user);
  },
  async forgotPassword(payload: { email: string }) {
    return api.post<{ message: string; dev_reset_link?: string }>("/auth/forgot-password", payload).then((res) => res.data);
  },
  async resetPassword(payload: { token: string; new_password: string }) {
    return api.post<{ message: string; user: AuthUser }>("/auth/reset-password", payload).then((res) => res.data);
  },
};

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail) return detail;
    if (error.code === "ECONNABORTED") return "Request took too long. You can retry or keep waiting.";
    if (!error.response) return "Connection lost. Check that the API is running on http://localhost:8000.";
  }
  return "Something went wrong while talking to the chatbot API.";
}
