import { cn, getPublicUrl } from "@/lib/utils";

export function SpartaMark({
  className,
  tone = "white",
}: {
  className?: string;
  tone?: "white" | "black";
}) {
  return (
    <span className={cn("sparta-mark", className)} aria-hidden="true">
      <img src={getPublicUrl(`brand/sparta-${tone}.png`)} alt="" />
    </span>
  );
}
