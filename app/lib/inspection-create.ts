/**
 * B-8 fix — map the New Inspection wizard's form fields to the
 * CreateInspectionSchema JSON that POST /api/inspections expects.
 *
 * The wizard posts a separate `date` (YYYY-MM-DD) + `time` (HH:MM); the API
 * wants a single ISO datetime, so we combine them here. `templateId` and
 * `propertyAddress` are required by the schema; `date`/`inspectorId`/
 * `serviceIds` are omitted when absent so the API applies its own defaults.
 *
 * `serviceIds` arrives as a comma-joined string of tenant service IDs (the
 * Services step now lists the tenant's real services, not free-text labels).
 * The service layer matches these against the `services` table and silently
 * ignores unknown IDs, so a stale/empty value is harmless.
 *
 * `inspectorId` is only forwarded when it looks like a UUID — the schema types
 * it as `z.string().uuid()`, and the wizard's free-text "Inspector ID or name"
 * field could otherwise carry a name that would fail validation.
 *
 * IA-1 People step fields:
 * - `clientName/clientEmail/clientPhone` → `client{name,email?,phone?}` only
 *   when `clientName` is non-empty (omitting client entirely when no name).
 * - `agentContactId` → forwarded when it is a UUID (existing contact link).
 * - `newAgentName/newAgentEmail` → `newAgent{name,email?}` when `newAgentName`
 *   is non-empty and `agentContactId` is absent. The two are mutually exclusive
 *   in the UI; we enforce the same here: agentContactId wins if both are sent.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateInspectionJson {
  propertyAddress: string;
  templateId: string;
  date?: string;
  inspectorId?: string;
  serviceIds?: string[];
  // IA-1 People step
  client?: { name: string; email?: string; phone?: string };
  agentContactId?: string;
  newAgent?: { name: string; email?: string };
}

export function buildCreateInspectionJson(formData: FormData): CreateInspectionJson {
  const address = String(formData.get("address") || "");
  const templateId = String(formData.get("templateId") || "");
  const dateStr = String(formData.get("date") || "");
  const time = String(formData.get("time") || "") || "09:00";
  const inspectorId = String(formData.get("inspectorId") || "");
  const serviceIds = String(formData.get("serviceIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // IA-1 People step fields
  const clientName = String(formData.get("clientName") || "").trim();
  const clientEmail = String(formData.get("clientEmail") || "").trim();
  const clientPhone = String(formData.get("clientPhone") || "").trim();
  const agentContactId = String(formData.get("agentContactId") || "").trim();
  const newAgentName = String(formData.get("newAgentName") || "").trim();
  const newAgentEmail = String(formData.get("newAgentEmail") || "").trim();

  // Build client object only when a name is provided.
  let client: CreateInspectionJson["client"] | undefined;
  if (clientName) {
    client = { name: clientName };
    if (clientEmail) client.email = clientEmail;
    if (clientPhone) client.phone = clientPhone;
  }

  // agentContactId wins over newAgent when both are somehow present.
  let agentId: string | undefined;
  let newAgent: CreateInspectionJson["newAgent"] | undefined;
  if (agentContactId && UUID_RE.test(agentContactId)) {
    agentId = agentContactId;
  } else if (newAgentName) {
    newAgent = { name: newAgentName };
    if (newAgentEmail) newAgent.email = newAgentEmail;
  }

  return {
    propertyAddress: address,
    templateId,
    ...(dateStr ? { date: `${dateStr}T${time}:00Z` } : {}),
    ...(inspectorId && UUID_RE.test(inspectorId) ? { inspectorId } : {}),
    ...(serviceIds.length > 0 ? { serviceIds } : {}),
    ...(client ? { client } : {}),
    ...(agentId ? { agentContactId: agentId } : {}),
    ...(newAgent ? { newAgent } : {}),
  };
}
