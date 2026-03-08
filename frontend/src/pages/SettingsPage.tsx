import { useTheme, type Theme } from "../theme";
import { clearToken } from "../api";

const themes: { id: Theme; label: string; desc: string }[] = [
  { id: "light", label: "Light", desc: "White background with dark nav bars" },
  { id: "dark", label: "Dark", desc: "Fully dark interface" },
  { id: "solarized", label: "Solarized", desc: "Dark teal with warm accents" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h1 className="text-xl font-bold text-[var(--text-heading)] mb-6">Settings</h1>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-xl mb-6">
        <h2 className="text-sm font-bold text-[var(--text-heading)] mb-4">Theme</h2>
        <div className="space-y-2">
          {themes.map((t) => (
            <label
              key={t.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                theme === t.id
                  ? "border-[var(--accent)] bg-[var(--bg-card-hover)]"
                  : "border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              <input
                type="radio"
                name="theme"
                checked={theme === t.id}
                onChange={() => setTheme(t.id)}
                className="accent-[var(--accent)]"
              />
              <div>
                <div className="text-sm font-medium text-[var(--text-heading)]">{t.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-xl">
        <h2 className="text-sm font-bold text-[var(--text-heading)] mb-4">Session</h2>
        <button
          onClick={() => { clearToken(); window.location.reload(); }}
          className="bg-[var(--danger-bg)] hover:opacity-80 text-[var(--danger)] rounded px-4 py-1.5 text-sm border border-[var(--danger-border)]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
