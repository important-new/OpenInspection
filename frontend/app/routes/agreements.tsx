import { useState } from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/agreements";
import { requireToken } from "~/lib/session.server";
import { apiFetch } from "~/lib/api.server";
import { PageHeader, TabStrip, Card, Pill, Button, EmptyState } from "@core/shared-ui";

export function meta() {
  return [{ title: "Agreements - OpenInspection" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const token = await requireToken(request);
  try {
    const [tplRes, reqRes] = await Promise.all([
      apiFetch("/api/admin/agreements", { token }),
      apiFetch("/api/admin/agreements/requests", { token }),
    ]);
    const tplBody = tplRes.ok ? ((await tplRes.json()) as Record<string, unknown>) : { data: [] };
    const reqBody = reqRes.ok ? ((await reqRes.json()) as Record<string, unknown>) : { data: [] };
    return {
      templates: (tplBody.data ?? []) as unknown[],
      requests: (reqBody.data ?? []) as unknown[],
    };
  } catch {
    return { templates: [], requests: [] };
  }
}

const TABS = [
  { id: "templates", label: "Templates" },
  { id: "signing", label: "Signing" },
];

type StatusTone = "sat" | "gen" | "neutral";
function pillToneFor(status: string): StatusTone {
  if (status === "signed") return "sat";
  if (status === "declined" || status === "expired") return "neutral";
  return "gen";
}
function pillLabelFor(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AgreementsPage() {
  const { templates, requests } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState("templates");

  const showingTemplates = activeTab === "templates";
  const rows = showingTemplates ? templates : requests;

  return (
    <div className="space-y-[18px]">
      <PageHeader
        eyebrow="Library · Agreements"
        title="Agreements"
        meta={`${templates.length} templates · ${requests.length} requests`}
        actions={<Button variant="primary">+ New agreement</Button>}
      />

      <TabStrip tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title={showingTemplates ? "No agreement templates yet" : "No signed agreements yet"}
            description={
              showingTemplates
                ? 'Click "+ New agreement" above to create your first agreement template.'
                : "Signed agreements will appear here after clients complete the signing process."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ih-border">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ih-fg-3">Title</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ih-fg-3">
                  {showingTemplates ? "Last updated" : "Client"}
                </th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ih-fg-3">Status</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ih-fg-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ih-border">
              {showingTemplates
                ? templates.map((t: any) => (
                    <tr key={t.id} className="hover:bg-ih-bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-semibold text-ih-fg-1">
                        {t.name || "Untitled"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ih-fg-3">
                        {t.updatedAt || t.createdAt || "--"}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone="sat">Active</Pill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-[13px] text-ih-primary hover:opacity-80 font-semibold">Edit</button>
                      </td>
                    </tr>
                  ))
                : requests.map((r: any) => (
                    <tr key={r.id} className="hover:bg-ih-bg-muted/50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-semibold text-ih-fg-1">
                        {r.agreementName || "Untitled"}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ih-fg-3">
                        {r.clientName || r.clientEmail || "--"}
                      </td>
                      <td className="px-4 py-3">
                        <Pill tone={pillToneFor(r.status)}>{pillLabelFor(r.status)}</Pill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "signed" ? (
                          <div className="flex justify-end gap-3">
                            <a
                              className="text-[13px] text-ih-primary hover:opacity-80 font-semibold"
                              href={`/api/admin/agreement-requests/${r.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Signed PDF
                            </a>
                            <a
                              className="text-[13px] text-ih-primary hover:opacity-80 font-semibold"
                              href={`/api/admin/agreement-requests/${r.id}/certificate.pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Certificate
                            </a>
                          </div>
                        ) : (
                          <button className="text-[13px] text-ih-fg-3 hover:opacity-80">View</button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
