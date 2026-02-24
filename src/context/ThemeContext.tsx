"use client";

import type React from "react";
import { useEffect } from "react";

import { type Theme, ThemeContext } from "./theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    // Dark mode disabled: force light theme for all pages.
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("theme", "light");
    }
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    // no-op: dark mode disabled
  };

  return (
    <ThemeContext.Provider value={{ theme: "light" as Theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
