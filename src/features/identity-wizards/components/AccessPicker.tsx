import { useListApplicationsQuery } from "@/app/api/applicationsApi";
import { useListRSRolesQuery } from "@/app/api/setupWizardApi";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface AccessChoice {
  applicationId: string;
  roleId: string;
}

interface AccessPickerProps {
  value: AccessChoice;
  onChange: (next: AccessChoice) => void;
  /** Explains what the grant does for this identity type. */
  hint: string;
}

/** Pick an application and one of its roles, and see the scopes that grant carries. */
export function AccessPicker({ value, onChange, hint }: AccessPickerProps) {
  const { data: applications = [], isLoading: loadingApps } = useListApplicationsQuery();
  const { data: rolesData, isFetching: loadingRoles } = useListRSRolesQuery(value.applicationId, { skip: !value.applicationId });
  const roles = rolesData?.roles ?? [];
  const role = roles.find((r) => r.id === value.roleId);
  const app = applications.find((a) => a.id === value.applicationId);

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-5 text-(--color-text-muted)">{hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wz-app">Application</Label>
          <Select value={value.applicationId} onValueChange={(applicationId) => onChange({ applicationId, roleId: "" })} disabled={loadingApps}>
            <SelectTrigger id="wz-app">
              <SelectValue placeholder={loadingApps ? "Loading…" : "Choose an application"} />
            </SelectTrigger>
            <SelectContent>
              {applications.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wz-role">Role</Label>
          <Select value={value.roleId} onValueChange={(roleId) => onChange({ ...value, roleId })} disabled={!value.applicationId || loadingRoles}>
            <SelectTrigger id="wz-role">
              <SelectValue placeholder={!value.applicationId ? "Choose an application first" : loadingRoles ? "Loading…" : "Choose a role"} />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                  {r.is_default ? " (default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {role && app ? (
        <div className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface-subtle) px-4 py-3">
          <p className="text-[13px] font-medium text-(--color-text)">
            Can call {app.name} as <span className="font-semibold">{role.name}</span>
          </p>
          {role.description ? <p className="mt-0.5 text-[12px] text-(--color-text-muted)">{role.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(role.scopes ?? []).length ? (
              (role.scopes ?? []).map((s) => (
                <span key={s} className="rounded-md border border-(--color-border-subtle) bg-(--color-surface-raised) px-1.5 py-0.5 font-mono text-[11px] text-(--color-text)">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-(--color-text-muted)">This role grants no scopes yet.</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
