---
name: excel
description: Create or edit .xlsx workbooks when the user requests spreadsheets, formulas, tables, or multi-sheet data.
---

# Excel workbooks

Use `openpyxl` for workbook structure, formulas, styling, and edits. Use `pandas` when it materially simplifies data transformation, then write the final workbook with the `openpyxl` engine.

## Creation

Make each sheet purposeful, use a descriptive sheet name, put headers in row 1, freeze the header row for tabular data, and apply number formats for dates, currency, and percentages. Prefer formulas over precomputed values when the user needs a workbook they can continue using. Add a compact summary sheet when there are multiple detailed sheets.

Avoid merged cells inside data tables. Set readable column widths and use a table style or restrained header formatting to distinguish labels from data. Save a descriptive `.xlsx` file in the sandbox working directory.

## Verification

Reload the saved workbook with `openpyxl`, confirm sheet names and dimensions, and check that formulas begin with `=`. Do not claim formulas were calculated: `openpyxl` writes formulas but does not calculate them.
