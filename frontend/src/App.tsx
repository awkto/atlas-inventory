import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { getAuthStatus, login, setup, setToken, clearToken, logout } from "./api";
import { useTheme } from "./theme";
import ItemsPage from "./pages/ItemsPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import NetworksPage from "./pages/NetworksPage";
import TagSearchPage from "./pages/TagSearchPage";
import SettingsPage from "./pages/SettingsPage";

// ---------------------------------------------------------------------------
// Setup screen (first run)
// ---------------------------------------------------------------------------

function SetupScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setError("");
    if (!password || !confirm) { setError("Both fields are required."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    const result = await setup(password);
    setLoading(false);

    if (result.success && result.session_token) {
      setToken(result.session_token);
      setApiToken(result.api_token || "");
    } else {
      setError(result.error || "Setup failed");
    }
  };

  // After setup, show the API token before proceeding
  if (apiToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-8 w-full max-w-md">
          <h1 className="text-xl font-bold mb-2 text-center text-[var(--accent-brand)]">Setup Complete</h1>
          <p className="text-[var(--text-muted)] text-sm mb-4 text-center">
            Your API token has been generated. Copy it now — you can also find it in Settings later.
          </p>
          <div className="bg-[var(--bg-input)] border border-[var(--border-input)] rounded p-3 mb-4 font-mono text-xs break-all text-[var(--text-heading)]">
            {apiToken}
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(apiToken).catch(() => {}); }}
            className="w-full bg-[var(--bg-input)] hover:bg-[var(--border-input)] text-[var(--text-heading)] font-medium rounded px-4 py-2 text-sm mb-2 border border-[var(--border-input)]"
          >
            Copy Token
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-2 text-sm"
          >
            Continue to Atlas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-2 text-center text-[var(--accent-brand)]">Atlas</h1>
        <p className="text-[var(--text-muted)] text-sm mb-6 text-center">Welcome — create an admin password to get started.</p>
        <label className="block text-sm font-medium text-[var(--text-heading)] mb-1">Password <span className="text-[var(--text-muted)] font-normal">(min. 8 characters)</span></label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 mb-3 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
          placeholder="Choose a password..."
          autoComplete="new-password"
        />
        <label className="block text-sm font-medium text-[var(--text-heading)] mb-1">Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSetup(); }}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 mb-4 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
          placeholder="Repeat password..."
          autoComplete="new-password"
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Setting up..." : "Complete Setup"}
        </button>
        <p className="text-[var(--text-muted)] text-xs mt-3 text-center">
          An API token will be generated for programmatic access.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login screen
// ---------------------------------------------------------------------------

function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!password) { setError("Password is required."); return; }
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (result.success && result.session_token) {
      setToken(result.session_token);
      window.location.reload();
    } else {
      setError(result.error || "Invalid password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)]">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6 text-center text-[var(--accent-brand)]">Atlas</h1>
        <p className="text-[var(--text-muted)] text-sm mb-4">Enter your password to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 mb-4 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
          placeholder="Password"
          autoComplete="current-password"
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav + main app shell
// ---------------------------------------------------------------------------

const navItems = [
  { to: "/", label: "Items" },
  { to: "/networks", label: "Networks" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  const [authState, setAuthState] = useState<"loading" | "noauth" | "setup" | "login" | "authed">("loading");
  const { theme, toggleDarkLight } = useTheme();

  useEffect(() => {
    getAuthStatus().then((status) => {
      if (status.noauth) {
        setAuthState("noauth");
      } else if (status.first_run) {
        setAuthState("setup");
      } else {
        // Check if we have a valid session token
        const token = localStorage.getItem("atlas_token");
        if (token) {
          // Verify the token works by hitting a protected endpoint
          fetch("/api/health", { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
              setAuthState(res.ok ? "authed" : "login");
              if (!res.ok) clearToken();
            })
            .catch(() => { clearToken(); setAuthState("login"); });
        } else {
          setAuthState("login");
        }
      }
    });
  }, []);

  if (authState === "loading") return null;
  if (authState === "setup") return <SetupScreen />;
  if (authState === "login") return <LoginScreen />;

  // "noauth" or "authed" — show the app
  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <nav className="bg-[var(--bg-nav)] border-b border-[var(--border-card)] px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold tracking-wide text-[var(--accent-brand)] mr-4">ATLAS</span>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `text-sm hover:text-[var(--text-nav-active)] transition ${isActive ? "text-[var(--text-nav-active)] font-medium" : "text-[var(--text-nav)]"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={toggleDarkLight}
            className="text-[var(--text-nav)] hover:text-[var(--text-nav-active)] transition text-sm border border-[var(--text-nav)]/30 rounded px-2 py-0.5"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? "Light" : "Dark"}
          </button>
          <a
            href="/api/export/csv"
            className="text-sm text-[var(--text-nav)] hover:text-[var(--text-nav-active)] transition"
          >
            Export CSV
          </a>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<ItemsPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route path="/networks" element={<NetworksPage />} />
          <Route path="/search" element={<TagSearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
