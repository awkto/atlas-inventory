import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "solarized";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleDarkLight: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggleDarkLight: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem("atlas_theme") as Theme) || "light";
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("atlas_theme", t);
  };

  const toggleDarkLight = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleDarkLight }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
