import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { checkAuth, setToken } from "./api";
import { useTheme } from "./theme";
import DevicesPage from "./pages/DevicesPage";
import DeviceDetailPage from "./pages/DeviceDetailPage";
import TreePage from "./pages/TreePage";
import NetworksPage from "./pages/NetworksPage";
import NetworkMapPage from "./pages/NetworkMapPage";
import EndpointsPage from "./pages/EndpointsPage";
import EndpointDetailPage from "./pages/EndpointDetailPage";
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
  { to: "/", label: "Devices" },
  { to: "/endpoints", label: "Endpoints" },
  { to: "/tree", label: "Hierarchy" },
  { to: "/networks", label: "Networks" },
  { to: "/network-map", label: "Network Map" },
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
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `text-sm hover:text-[var(--text-nav-active)] transition ${isActive ? "text-[var(--text-nav-active)] font-medium" : "text-[var(--text-nav)]"}`
            }
          >
            Settings
          </NavLink>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<DevicesPage />} />
          <Route path="/devices/:id" element={<DeviceDetailPage />} />
          <Route path="/endpoints" element={<EndpointsPage />} />
          <Route path="/endpoints/:id" element={<EndpointDetailPage />} />
          <Route path="/tree" element={<TreePage />} />
          <Route path="/networks" element={<NetworksPage />} />
          <Route path="/network-map" element={<NetworkMapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
