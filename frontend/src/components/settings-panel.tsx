import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chat-store";
import { useTheme } from "@/theme/theme-provider";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background/70 p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  const { theme, toggleTheme } = useTheme();
  const { settings, setSettings } = useChatStore();

  return (
    <section className="rounded-[1.75rem] border bg-card/90 p-5 shadow-panel">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Tune search, display, and thread defaults.</p>
      </div>

      <div className="mt-5 space-y-3">
        <SettingRow label="Theme" description="Switch between light and dark workspace styles.">
          <Button variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </SettingRow>

        <SettingRow label="User ID" description="Used when the backend supports multi-user document scoping.">
          <Input value={settings.userId} onChange={(event) => setSettings({ userId: event.target.value })} className="w-44" />
        </SettingRow>

        <SettingRow label="Default Thread ID" description="Resume a known thread on load when needed.">
          <Input
            value={settings.defaultThreadId}
            onChange={(event) => setSettings({ defaultThreadId: event.target.value })}
            className="w-44"
          />
        </SettingRow>

        <SettingRow label="Auto Create Thread" description="Start a fresh conversation automatically when history is empty.">
          <input
            type="checkbox"
            checked={settings.autoCreateThread}
            onChange={(event) => setSettings({ autoCreateThread: event.target.checked })}
            className="h-4 w-4 rounded"
          />
        </SettingRow>

        <SettingRow label="Show Confidence" description="Display answer confidence chips on assistant messages.">
          <input
            type="checkbox"
            checked={settings.showConfidence}
            onChange={(event) => setSettings({ showConfidence: event.target.checked })}
            className="h-4 w-4 rounded"
          />
        </SettingRow>

        <SettingRow label="Show Sources" description="Render source citation chips beneath each assistant response.">
          <input
            type="checkbox"
            checked={settings.showSources}
            onChange={(event) => setSettings({ showSources: event.target.checked })}
            className="h-4 w-4 rounded"
          />
        </SettingRow>
      </div>
    </section>
  );
}
