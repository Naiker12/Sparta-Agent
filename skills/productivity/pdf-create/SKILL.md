---
name: pdf-create
description: Create new PDF documents with text, tables, and images; use this for PDF output rather than editing an existing PDF.
---

# Creating PDFs

Use `fpdf2` to create new PDFs. For edits, annotation, extraction, or page-level changes to an existing PDF, use the PDF-editing workflow instead.

## Layout

Choose a page size and margins before adding content. Use `multi_cell` for prose so text wraps correctly, repeat table headers after page breaks, and check available vertical space before drawing a block. Keep typography and spacing consistent; use tables only for genuinely tabular information.

Save the result with a descriptive `.pdf` name in the sandbox working directory. Verify the file can be opened with PyMuPDF, has the expected page count, and contains the intended text. If it includes dense layout or images, render at least one page for a visual inspection before delivery.
