import { Badge } from "@/components/ui/badge";
import { DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n";
import { CubeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function ContainersComingSoonItem() {
  const t = useT();
  return (
    <DropdownMenuGroup>
      <DropdownMenuItem disabled>
        <HugeiconsIcon icon={CubeIcon} strokeWidth={2} />
        {t("shell.navigation.containers")}
        <Badge variant="secondary" className="ml-auto">
          {t("shell.navigation.comingSoon")}
        </Badge>
      </DropdownMenuItem>
    </DropdownMenuGroup>
  );
}
