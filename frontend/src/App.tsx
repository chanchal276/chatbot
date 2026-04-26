import { useEffect, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import { AuthScreen } from "@/components/auth-screen";
import { ChatPanel } from "@/components/chat-panel";
import { DocumentPanel } from "@/components/document-panel";
import { ProfileDialog } from "@/components/profile-dialog";
import { SettingsPanel } from "@/components/settings-panel";
import { ThreadSidebar } from "@/components/thread-sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { client } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useChatStore } from "@/store/chat-store";

export default function App() {
  const [profileOpen, setProfileOpen] = useState(false);
  const { initialize, isSidebarOpen, setSidebarOpen, healthStatus, setHealthStatus, isDocumentsOpen, setDocumentsOpen, isSettingsOpen, setSettingsOpen, error } =
    useChatStore();
  const { user, token, hydrateUser, logout, isAuthenticating } = useAuthStore();

  useEffect(() => {
    void hydrateUser();
  }, [hydrateUser]);

  useEffect(() => {
    if (token && user) {
      void initialize();
    }
  }, [initialize, token, user]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await client.health();
        setHealthStatus("connected");
      } catch {
        setHealthStatus("disconnected");
      }
    };
    void checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => window.clearInterval(timer);
  }, [setHealthStatus]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (!token || !user) {
    if (isAuthenticating) {
      return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading account...</div>;
    }
    return (
      <>
        <AuthScreen />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen p-3 md:p-5">
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1700px] gap-4">
          {isSidebarOpen ? (
            <div className="hidden w-[340px] shrink-0 lg:block">
              <ThreadSidebar />
            </div>
          ) : null}

          <main className="flex min-w-0 flex-1 flex-col gap-4">
            <header className="rounded-[2rem] border bg-card/85 px-4 py-4 shadow-panel md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-orange-400 p-3 text-white shadow-lg">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Smart Research Chatbot</p>
                    <p className="text-sm text-muted-foreground">Document-grounded answers with full thread history</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      healthStatus === "connected"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : healthStatus === "disconnected"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {healthStatus === "connected" ? "Connected" : healthStatus === "disconnected" ? "Disconnected" : "Checking"}
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setSidebarOpen(!isSidebarOpen)} className="hidden lg:inline-flex">
                    {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" onClick={() => setDocumentsOpen(!isDocumentsOpen)}>
                    {isDocumentsOpen ? "Hide Docs" : "Show Docs"}
                  </Button>
                  <Button variant="outline" onClick={() => setSettingsOpen(!isSettingsOpen)}>
                    <Settings2 className="h-4 w-4" />
                    Settings
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="h-10 rounded-full px-3">
                        {(user.full_name || user.email).slice(0, 2).toUpperCase()}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setProfileOpen(true)}>Profile</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSettingsOpen(true)}>Settings</DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          await logout();
                          toast.success("Logged out.");
                        }}
                      >
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_380px]">
              <ChatPanel />
              <div className="space-y-4">
                {isDocumentsOpen ? <DocumentPanel /> : null}
                {isSettingsOpen ? <SettingsPanel /> : null}
              </div>
            </div>
          </main>
        </div>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <Toaster richColors position="top-right" />
      </div>
    </TooltipProvider>
  );
}
