import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import { applyTheme, useAppStore } from "./store/useAppStore";

// Follow the OS when the user has chosen "system".
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  const { theme } = useAppStore.getState();
  if (theme === "system") applyTheme("system");
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
