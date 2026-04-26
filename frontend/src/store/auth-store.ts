import { create } from "zustand";
import { persist } from "zustand/middleware";
import { client, getApiErrorMessage } from "@/lib/api";
import { useChatStore } from "@/store/chat-store";
import type { AuthUser } from "@/types";

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  isAuthenticating: boolean;
  error: string | null;
  setSession: (token: string, user: AuthUser) => void;
  register: (payload: { email: string; password: string; full_name: string }) => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hydrateUser: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; dev_reset_link?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticating: false,
      error: null,
      setSession: (token, user) => {
        localStorage.setItem("smart-research-auth-token", token);
        useChatStore.getState().setSettings({ userId: user.email });
        set({ token, user, error: null });
      },
      register: async (payload) => {
        set({ isAuthenticating: true, error: null });
        try {
          const response = await client.register(payload);
          localStorage.setItem("smart-research-auth-token", response.token);
          useChatStore.getState().setSettings({ userId: response.user.email });
          set({ token: response.token, user: response.user, isAuthenticating: false });
        } catch (error) {
          set({ isAuthenticating: false, error: getApiErrorMessage(error) });
          throw error;
        }
      },
      login: async (payload) => {
        set({ isAuthenticating: true, error: null });
        try {
          const response = await client.login(payload);
          localStorage.setItem("smart-research-auth-token", response.token);
          useChatStore.getState().setSettings({ userId: response.user.email });
          set({ token: response.token, user: response.user, isAuthenticating: false });
        } catch (error) {
          set({ isAuthenticating: false, error: getApiErrorMessage(error) });
          throw error;
        }
      },
      logout: async () => {
        try {
          await client.logout();
        } catch {
          // Ignore logout network errors and clear local session anyway.
        }
        localStorage.removeItem("smart-research-auth-token");
        useChatStore.getState().clearState();
        set({ token: null, user: null, error: null });
      },
      hydrateUser: async () => {
        const token = localStorage.getItem("smart-research-auth-token");
        if (!token) return;
        set({ isAuthenticating: true });
        try {
          const user = await client.me();
          useChatStore.getState().setSettings({ userId: user.email });
          set({ token, user, isAuthenticating: false });
        } catch (error) {
          localStorage.removeItem("smart-research-auth-token");
          useChatStore.getState().clearState();
          set({ token: null, user: null, isAuthenticating: false, error: getApiErrorMessage(error) });
        }
      },
      updateProfile: async (fullName) => {
        set({ isAuthenticating: true, error: null });
        try {
          const user = await client.updateProfile({ full_name: fullName });
          set((state) => ({ user, token: state.token, isAuthenticating: false }));
        } catch (error) {
          set({ isAuthenticating: false, error: getApiErrorMessage(error) });
          throw error;
        }
      },
      forgotPassword: async (email) => {
        set({ isAuthenticating: true, error: null });
        try {
          const response = await client.forgotPassword({ email });
          set({ isAuthenticating: false });
          return response;
        } catch (error) {
          set({ isAuthenticating: false, error: getApiErrorMessage(error) });
          throw error;
        }
      },
      resetPassword: async (token, newPassword) => {
        set({ isAuthenticating: true, error: null });
        try {
          await client.resetPassword({ token, new_password: newPassword });
          set({ isAuthenticating: false });
        } catch (error) {
          set({ isAuthenticating: false, error: getApiErrorMessage(error) });
          throw error;
        }
      },
    }),
    {
      name: "smart-research-auth-store",
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
