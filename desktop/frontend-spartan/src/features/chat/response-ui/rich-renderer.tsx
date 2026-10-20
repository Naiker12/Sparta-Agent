import {
  Renderer,
  createLibrary,
  defineComponent,
  type OpenUIError,
} from "@openuidev/react-lang";
import { z } from "zod";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/i18n";
import { openLink } from "@/lib/open-link";
import {
  comparisonSeries,
  preferComparisonChart,
  presentationDocument,
  publicReferenceUrl,
  validateComparison,
  type ComparisonData,
  type ReferenceImage,
} from "./contracts";
import { parseComparisonMarkdown } from "./parse-table";
import { PanelView } from "./panel-view";
import { validatePanel, type ResponsePanel } from "./panels";

function ComparisonView({ data }: { data: ComparisonData }) {
  const t = useT();
  const [sort, setSort] = useState<{ column: number; reverse: boolean } | null>(
    null,
  );
  const [chart, setChart] = useState(() => preferComparisonChart(data));
  const rows = useMemo(
    () =>
      sort
        ? [...data.rows].sort((a, b) => {
            const left = a[sort.column],
              right = b[sort.column];
            const numeric = [left, right].every(
              (value) =>
                /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) &&
                Number.isFinite(Number(value)),
            );
            return (
              (numeric
                ? Number(left) - Number(right)
                : left.localeCompare(right, undefined, { numeric: true })) *
              (sort.reverse ? -1 : 1)
            );
          })
        : data.rows,
    [data.rows, sort],
  );
  const series = comparisonSeries(data);
  const max = series
    ? Math.max(1, ...series.map((point) => Math.abs(point.value)))
    : 1;
  return (
    <div
      data-response-ui="comparison"
      className="min-w-0 my-3 flex flex-col gap-2"
    >
      {series && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChart(!chart)}
            aria-pressed={chart}
          >
            {t(
              chart ? "chat.responseUi.showTable" : "chat.responseUi.showChart",
            )}
          </Button>
        </div>
      )}
      {chart && series ? (
        <figure
          className="flex flex-col gap-2"
          aria-label={data.columns.join(" — ")}
        >
          <figcaption className="text-sm text-muted-foreground">
            {data.columns.join(" — ")}
          </figcaption>
          {series.map((point, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-3"
            >
              <span className="break-words text-sm">{point.label}</span>
              <div className="flex items-center gap-2">
                <svg
                  viewBox="0 0 200 20"
                  className="h-5 min-w-0 flex-1"
                  aria-hidden="true"
                >
                  <line
                    x1="100"
                    x2="100"
                    y1="0"
                    y2="20"
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <rect
                    x={
                      point.value < 0
                        ? 100 - (Math.abs(point.value) / max) * 98
                        : 100
                    }
                    y="2"
                    width={(Math.abs(point.value) / max) * 98}
                    height="16"
                    rx="2"
                    fill="currentColor"
                    className="text-primary"
                  />
                </svg>
                <span className="text-sm tabular-nums">{point.value}</span>
              </div>
            </div>
          ))}
        </figure>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {data.columns.map((column, i) => (
                <TableHead
                  key={i}
                  scope="col"
                  aria-sort={
                    sort?.column === i
                      ? sort.reverse
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSort({
                        column: i,
                        reverse: sort?.column === i && !sort.reverse,
                      })
                    }
                  >
                    {column}
                    {sort?.column === i ? (sort.reverse ? " ↓" : " ↑") : ""}
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell
                    key={j}
                    className="whitespace-pre-wrap break-words"
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ReferenceImageView({
  image,
  loaded,
}: { image: ReferenceImage; loaded: boolean }) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      {loaded && !failed ? (
        <img
          src={image.imageUrl}
          alt={image.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="aspect-video w-full rounded-lg object-contain bg-muted"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="aspect-video flex items-center justify-center rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {t(
            failed
              ? "chat.responseUi.imageFailed"
              : "chat.responseUi.imageReference",
          )}
        </div>
      )}
      <figcaption>
        <a
          href={image.url}
          rel="noopener noreferrer"
          target="_blank"
          onClick={(event) => {
            if (openLink(image.url)) event.preventDefault();
          }}
          className="text-sm text-primary underline underline-offset-2"
        >
          {image.title}
        </a>
        <div className="text-xs text-muted-foreground break-all">
          {new URL(image.url).hostname}
        </div>
      </figcaption>
    </figure>
  );
}

function GalleryView({ images }: { images: ReferenceImage[] }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <div data-response-ui="gallery" className="my-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {t("chat.responseUi.imageReference")}
        </span>
        {!loaded && (
          <Button variant="outline" size="sm" onClick={() => setLoaded(true)}>
            {t("chat.responseUi.loadImages")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 @sm/thread:grid-cols-2">
        {images.map((image) => (
          <ReferenceImageView
            key={image.imageUrl}
            image={image}
            loaded={loaded}
          />
        ))}
      </div>
    </div>
  );
}

const Comparison = defineComponent({
  name: "Comparison",
  description: "Display a verified comparison table",
  props: z.object({ data: z.string().max(40_000) }),
  component: ({ props }) => {
    const data = validateComparison(JSON.parse(props.data));
    if (!data) throw new Error("Invalid comparison");
    return <ComparisonView data={data} />;
  },
});
const Gallery = defineComponent({
  name: "ReferenceGallery",
  description: "Display reference images with source pages",
  props: z.object({ data: z.string().max(40_000) }),
  component: ({ props }) => {
    const images: ReferenceImage[] = JSON.parse(props.data);
    if (
      !Array.isArray(images) ||
      !images.length ||
      images.length > 6 ||
      images.some(
        (image) =>
          typeof image.title !== "string" ||
          !publicReferenceUrl(image.url) ||
          !publicReferenceUrl(image.imageUrl),
      )
    )
      throw new Error("Invalid reference gallery");
    return <GalleryView images={images} />;
  },
});
// No tools, actions, query providers, network gateway or hosted observability.
const Panel = defineComponent({
  name: "Panel",
  description: "Compose native display blocks and human-input forms",
  props: z.object({ data: z.string().max(40_000) }),
  component: ({ props }) => {
    const panel = validatePanel(JSON.parse(props.data));
    if (!panel) throw new Error("Invalid panel");
    return (
      <PanelView
        panel={panel}
        table={(block) => <ComparisonView data={block} />}
      />
    );
  },
});
const library = createLibrary({ components: [Comparison, Gallery, Panel] });

export function CustomPanel({
  panel,
  fallback,
}: { panel: ResponsePanel; fallback: ReactNode }) {
  const t = useT();
  const [textOnly, setTextOnly] = useState(false);
  return (
    <div className="min-w-0">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={textOnly}
          onClick={() => setTextOnly(!textOnly)}
        >
          {t(
            textOnly
              ? "chat.responseUi.showVisual"
              : "chat.responseUi.showText",
          )}
        </Button>
      </div>
      <div hidden={textOnly}>
        <SafeRenderer
          document={presentationDocument("Panel", panel)}
          fallback={fallback}
        />
      </div>
      {textOnly && fallback}
    </div>
  );
}

function SafeRenderer({
  document,
  fallback,
}: { document: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const onError = useMemo(
    () => (errors: OpenUIError[]) => {
      if (errors.length) setFailed(true);
    },
    [],
  );
  return failed ? (
    fallback
  ) : (
    <Renderer
      library={library}
      response={document}
      isStreaming={false}
      toolProvider={null}
      onError={onError}
    />
  );
}

export function RichTable({
  markdown,
  fallback,
}: { markdown: string; fallback: ReactNode }) {
  const t = useT();
  const data = useMemo(() => parseComparisonMarkdown(markdown), [markdown]);
  const [textOnly, setTextOnly] = useState(false);
  if (!data) return fallback;
  return (
    <div className="min-w-0">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTextOnly(!textOnly)}
          aria-pressed={textOnly}
        >
          {t(
            textOnly
              ? "chat.responseUi.showVisual"
              : "chat.responseUi.showText",
          )}
        </Button>
      </div>
      {textOnly ? (
        fallback
      ) : (
        <SafeRenderer
          document={presentationDocument("Comparison", data)}
          fallback={fallback}
        />
      )}
    </div>
  );
}

export function ReferenceGallery({
  images,
  fallback,
}: { images: ReferenceImage[]; fallback: ReactNode }) {
  return (
    <SafeRenderer
      document={presentationDocument("ReferenceGallery", images)}
      fallback={fallback}
    />
  );
}
