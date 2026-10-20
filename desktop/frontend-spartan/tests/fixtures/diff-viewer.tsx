import React from "react";
import { createRoot } from "react-dom/client";
import { DiffViewer } from "../../src/components/workspace-rail/diff-viewer";
import { setLocale } from "../../src/i18n";
import "../../src/index.css";
await setLocale("es");
const files = [
  {path: "scripts/long.py", filename: "long.py", status: "modified" as const, additions: 120, deletions: 0, diff: "@@ -0,0 +1,120 @@\n" + Array.from({length: 120}, (_, i) => `+print(${i})`).join("\n")},
  {path: "short.txt", filename: "short.txt", status: "modified" as const, additions: 1, deletions: 0, diff: "@@ -0,0 +1 @@\n+hello"},
  {path: "image.png", filename: "image.png", status: "modified" as const, additions: 0, deletions: 0, diff: ""},
];
createRoot(document.getElementById("root")!).render(<div style={{height: 500, width: "100%", display: "flex", flexDirection: "column", overflow: "auto"}}>{files.map(file => <div key={file.path} className="min-w-0 shrink-0 border-b"><DiffViewer file={file} /></div>)}</div>);
