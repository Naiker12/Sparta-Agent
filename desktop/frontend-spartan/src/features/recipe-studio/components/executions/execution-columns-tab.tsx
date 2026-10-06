import { useT as useUiT } from "@/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReactElement } from "react";
import type { AnalysisColumnStat } from "./executions-view-helpers";

type ExecutionColumnsTabProps = {
  analysisColumns: AnalysisColumnStat[];
};

export function ExecutionColumnsTab({
  analysisColumns,
}: ExecutionColumnsTabProps): ReactElement {
  const uiT = useUiT();

  return (
    <div className="mt-3 rounded-xl border p-3">
      <p className="mb-2 text-sm font-semibold">{uiT("ui.column_statistics")}</p>
      {analysisColumns.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {uiT("ui.no_column_statistics_yet")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{uiT("ui.column")}</TableHead>
              <TableHead>{uiT("ui.type")}</TableHead>
              <TableHead>{uiT("ui.data_type")}</TableHead>
              <TableHead>{uiT("ui.unique")}</TableHead>
              <TableHead>{uiT("ui.nulls")}</TableHead>
              <TableHead>{uiT("ui.input_tok_avg")}</TableHead>
              <TableHead>{uiT("ui.output_tok_avg")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analysisColumns.map((column) => (
              <TableRow key={column.column_name}>
                <TableCell>{column.column_name}</TableCell>
                <TableCell>{column.column_type}</TableCell>
                <TableCell>{column.simple_dtype}</TableCell>
                <TableCell>{column.num_unique ?? "--"}</TableCell>
                <TableCell>{column.num_null ?? "--"}</TableCell>
                <TableCell>{column.input_tokens_mean ?? "--"}</TableCell>
                <TableCell>{column.output_tokens_mean ?? "--"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
