import { useEffect, useState } from "react";
import { useTheme, type Theme } from "../theme";
import {
  logout,
  getApiToken,
  regenerateApiToken,
  changePassword,
  setToken,
} from "../api";

const themes: { id: Theme; label: string; desc: string }[] = [
  { id: "light", label: "Light", desc: "White background with dark nav bars" },
  { id: "dark", label: "Dark", desc: "Fully dark interface" },
  { id: "solarized", label: "Solarized", desc: "Dark teal with warm accents" },
];

function ApiTokenSection() {
  const [token, setTokenVal] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [noauth, setNoauth] = useState(false);

  useEffect(() => {
    getApiToken().then((data) => {
      setTokenVal(data.api_token);
      setNoauth(!!data.noauth);
    });
  }, []);

  if (noauth) return null;

  const handleRegenerate = async () => {
    if (!confirm("Regenerate the API token? Any integrations using the current token will stop working.")) return;
    const result = await regenerateApiToken();
    if (result.success) {
      setTokenVal(result.api_token);
      setVisible(true);
    }
  };

  const handleCopy = () => {
    if (token) {
      navigator.clipboard.writeText(token).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-xl mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-4">API Token</h2>
      <p className="text-xs text-[var(--text-muted)] mb-3">Use this token for API and MCP access.</p>
      <div className="flex items-center gap-2 mb-3">
        <input
          type={visible ? "text" : "password"}
          readOnly
          value={token || ""}
          className="flex-1 bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 text-sm font-mono text-[var(--text-heading)]"
        />
        <button
          onClick={() => setVisible(!visible)}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-heading)] border border-[var(--border-input)] rounded px-3 py-2"
        >
          {visible ? "Hide" : "Show"}
        </button>
        <button
          onClick={handleCopy}
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-heading)] border border-[var(--border-input)] rounded px-3 py-2"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <button
        onClick={handleRegenerate}
        className="text-sm text-[var(--danger)] hover:opacity-80 border border-[var(--danger-border)] rounded px-3 py-1.5"
      >
        Regenerate Token
      </button>
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    setError("");
    setSuccess("");
    if (!currentPw || !newPw || !confirmPw) { setError("All fields are required."); return; }
    if (newPw !== confirmPw) { setError("New passwords do not match."); return; }
    if (newPw.length < 8) { setError("New password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const result = await changePassword(currentPw, newPw);
      if (result.success) {
        setToken(result.session_token);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setSuccess("Password changed successfully.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Password change failed.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-xl mb-6">
      <h2 className="text-sm font-bold text-[var(--text-heading)] mb-4">Change Password</h2>
      <div className="space-y-3">
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
        />
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          placeholder="New password (min. 8 characters)"
          autoComplete="new-password"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
        />
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleChange(); }}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
        />
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      {success && <p className="text-green-500 text-sm mt-2">{success}</p>}
      <button
        onClick={handleChange}
        disabled={loading}
        className="mt-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-1.5 text-sm disabled:opacity-50"
      >
        {loading ? "Changing..." : "Change Password"}
      </button>
    </div>
  );
}

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

      <ApiTokenSection />
      <ChangePasswordSection />

      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-6 max-w-xl">
        <h2 className="text-sm font-bold text-[var(--text-heading)] mb-4">Session</h2>
        <button
          onClick={async () => { await logout(); window.location.reload(); }}
          className="bg-[var(--danger-bg)] hover:opacity-80 text-[var(--danger)] rounded px-4 py-1.5 text-sm border border-[var(--danger-border)]"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
