// Windows file pickers and native drops may omit or generalize the MIME type.
export const PDF_ATTACHMENT_ACCEPT = ".pdf,application/pdf";
export const HTML_ATTACHMENT_ACCEPT = ".html,.htm,text/html,application/xhtml+xml";
export const DOCX_ATTACHMENT_ACCEPT =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const SPREADSHEET_ATTACHMENT_ACCEPT = [
  ".xls", ".xlsx", ".xlsm", ".xlsb",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
].join(",");
