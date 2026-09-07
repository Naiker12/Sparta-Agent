import * as XLSX from "xlsx";

export async function parseSpreadsheetPreview(blob: Blob) {
  try {
    if (blob.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB preview limit");
    const data = await blob.arrayBuffer();
    const names = XLSX.read(data, { type: "array", bookSheets: true }).SheetNames;
    const workbook = XLSX.read(data, { type: "array", sheets: names.slice(0, 32), sheetRows: 501, cellFormula: false, cellHTML: false });
    const sheets = names.slice(0, 32).map(name => {
      const sheet = workbook.Sheets[name];
      if (!sheet?.["!ref"]) return { name, rows: [], truncated: false };
      const range = XLSX.utils.decode_range(sheet["!ref"]);
      range.s = { r: 0, c: 0 };
      range.e.r = Math.min(range.e.r, 499);
      range.e.c = Math.min(range.e.c, 63);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, range });
      return { name, rows: rows.map(row => row.map(cell => String(cell ?? "").slice(0, 1000))), truncated: Boolean(sheet["!fullref"]) || XLSX.utils.decode_range(sheet["!ref"]).e.r > 499 || XLSX.utils.decode_range(sheet["!ref"]).e.c > 63 };
    });
    return { sheets, limited: names.length > 32 };
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 200) : "Invalid workbook", sheets: [] };
  }
}

if (typeof self !== "undefined") self.onmessage = async (event: MessageEvent<Blob>) => { self.postMessage(await parseSpreadsheetPreview(event.data)); };
