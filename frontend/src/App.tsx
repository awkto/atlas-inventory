import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { checkAuth, setToken } from "./api";
import { useTheme } from "./theme";
import ItemsPage from "./pages/ItemsPage";
import ItemDetailPage from "./pages/ItemDetailPage";
import NetworksPage from "./pages/NetworksPage";
import TagSearchPage from "./pages/TagSearchPage";
import SettingsPage from "./pages/SettingsPage";

function Login() {
  const [token, setTokenVal] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-6 text-center text-[var(--accent-brand)]">Atlas</h1>
        <p className="text-[var(--text-muted)] text-sm mb-4">Enter your access token</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setTokenVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setToken(token);
              window.location.reload();
            }
          }}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-input)] rounded px-3 py-2 mb-4 text-sm text-[var(--text-heading)] focus:outline-none focus:border-[var(--focus-ring)]"
          placeholder="Bearer token"
        />
        <button
          onClick={() => { setToken(token); window.location.reload(); }}
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--btn-text)] font-medium rounded px-4 py-2 text-sm"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

const navItems = [
  { to: "/", label: "Items" },
  { to: "/networks", label: "Networks" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { theme, toggleDarkLight } = useTheme();

  useEffect(() => {
    checkAuth().then(setAuthed);
  }, []);

  if (authed === null) return null;
  if (!authed) return <Login />;

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
