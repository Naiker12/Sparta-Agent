---
name: word
description: Create or edit .docx documents when the requested output needs Word-specific structure or formatting.
---

# Word documents

Use `python-docx` for `.docx` creation and edits. Preserve the original file when editing unless the user asks to replace it.

## Creation

Start with semantic structure: a document title, headings, short paragraphs, and tables only where they clarify data. Set margins and use Word styles instead of applying font settings independently to every run. For tables, add a header row and avoid fixed-width layouts that clip when opened on another machine.

Save the deliverable in the sandbox working directory with a descriptive `.docx` name, then verify it opens by reloading it with `python-docx` and checking expected text, tables, and section count.

## Editing

Inspect paragraphs, tables, headers, and sections before changing a file. Keep existing styles and page setup unless the request calls for a redesign. `python-docx` does not preserve every advanced Word feature; for complex templates, change only the required content and validate the resulting file.
