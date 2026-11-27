import { GraduationCap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSetTutorialMode, useTutorialMode } from "@/hooks/useTutorialMode";

export function TutorialModeToggle() {
  const enabled = useTutorialMode();
  const onChange = useSetTutorialMode();

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] text-(--color-text-muted) transition-colors duration-200 ease-out hover:bg-(--color-hover) hover:text-(--color-text)">
          <GraduationCap className="size-4" />
          <span className="hidden sm:inline">Tutorial mode</span>
          <Switch checked={enabled} onCheckedChange={onChange} aria-label="Tutorial mode" />
        </label>
      </TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        className="rounded-lg border border-(--color-border-subtle) bg-(color:--color-surface-raised) px-3 py-2 text-[13px] font-medium text-(color:--color-text) shadow-(--shadow-md) duration-150 ease-out [&_svg]:hidden!"
      >
        {enabled ? "Tutorial mode is on" : "Turn on tutorial mode"}
      </TooltipContent>
    </Tooltip>
  );
}
