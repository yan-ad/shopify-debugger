import React from "react";
import ReactDOM from "react-dom/client";
import { DebuggerShell } from "./DebuggerShell";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DebuggerShell />
  </React.StrictMode>,
);
