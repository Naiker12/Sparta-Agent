import { useT as useUiT } from "@/i18n";
const EXTERNAL_URL_RE = /^https?:\/\//;

export function ReadMore({ href = "#" }: { href?: string }) {
  const uiT = useUiT();

  const isExternal = EXTERNAL_URL_RE.test(href);
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={(e) => {
        if (href === "#") {
          e.preventDefault();
        }
      }}
      className="text-control-accent underline underline-offset-2 hover:text-control-accent/80"
    >
      {uiT("studio.params.readMore")}</a>
  );
}
