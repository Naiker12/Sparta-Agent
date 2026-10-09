export type ConvExportFormat = "jsonl-raw" | "csv" | "sharegpt";
const labels: Record<ConvExportFormat, string> = {
  "jsonl-raw": "Raw JSONL", csv: "CSV", sharegpt: "ShareGPT JSONL",
};
export const EXPORT_FORMATS_LIST = (Object.keys(labels) as ConvExportFormat[])
  .map((fmt) => ({ fmt, label: labels[fmt] }));
