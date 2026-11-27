import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/ui/copy-button";

/** A read-only credential value with a copy button. */
export function CredentialField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-[12px] text-(--color-text-muted)">{label}</Label>
      <div className="flex items-center gap-2">
        <code
          className={`min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-[12px] break-all ${
            secret
              ? "border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-(--color-warning-soft) text-(--color-text)"
              : "border-(--color-border-subtle) bg-(--color-surface-subtle) text-(--color-text)"
          }`}
        >
          {value}
        </code>
        <CopyButton text={value} variant="outline" label={`Copy ${label}`} />
      </div>
    </div>
  );
}
