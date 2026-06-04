import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { buildWizardSteps, todayLocalISO, formatPriceCents, type WizardStepId } from "~/lib/wizard-steps";

const STEP_LABELS: Record<WizardStepId, string> = {
  property: "Property",
  services: "Services",
  schedule: "Schedule",
  team: "Team",
};

const PROPERTY_TYPES = [
  { value: "single_family", label: "Single Family" },
  { value: "multi_unit", label: "Multi-Unit" },
  { value: "commercial", label: "Commercial" },
] as const;

export interface WizardTemplate {
  id: string;
  name: string;
  itemCount?: number;
}

export interface WizardService {
  id: string;
  name: string;
  price?: number | null;
}

export interface WizardTeamMember {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NewInspectionWizard({
  open,
  onClose,
  templates = [],
  services: serviceCatalog = [],
  teamMembers = [],
}: {
  open: boolean;
  onClose: () => void;
  templates?: WizardTemplate[];
  services?: WizardService[];
  /** B-21 — when empty (solo workspace) the Team step is skipped entirely. */
  teamMembers?: WizardTeamMember[];
}) {
  const fetcher = useFetcher();
  const [stepIdx, setStepIdx] = useState(0);
  const [propertyType, setPropertyType] = useState("single_family");
  const [address, setAddress] = useState("");
  const [templateId, setTemplateId] = useState("");
  // Stores selected service IDs (matched against the tenant's services table).
  const [services, setServices] = useState<Set<string>>(new Set());
  // B-21: on-site creation is overwhelmingly same-day — default to today.
  const [date, setDate] = useState(() => todayLocalISO());
  const [time, setTime] = useState("09:00");
  const [soloMode, setSoloMode] = useState(true);
  const [inspectorId, setInspectorId] = useState("");

  const hasServiceCatalog = serviceCatalog.length > 0;

  // B-21 — steps with nothing to decide are skipped instead of rendered as
  // empty placeholders ("No services configured" + a mandatory Next click).
  const steps = useMemo(
    () =>
      buildWizardSteps({
        hasServiceCatalog,
        hasTeamChoices: teamMembers.length > 0,
      }),
    [hasServiceCatalog, teamMembers.length],
  );
  const step: WizardStepId = steps[Math.min(stepIdx, steps.length - 1)];

  // Typeahead filter for the template picker (B-6).
  const [templateQuery, setTemplateQuery] = useState("");
  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, templateQuery]);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );

  // B-21 — when the search narrows to exactly one template, select it; the
  // search box and dropdown previously acted as two disconnected controls.
  useEffect(() => {
    if (templateQuery.trim() && filteredTemplates.length === 1) {
      setTemplateId(filteredTemplates[0].id);
    }
  }, [templateQuery, filteredTemplates]);

  useEffect(() => {
    if (open) return;
    setStepIdx(0);
    setPropertyType("single_family");
    setAddress("");
    setTemplateId("");
    setTemplateQuery("");
    setServices(new Set());
    setDate(todayLocalISO());
    setTime("09:00");
    setSoloMode(true);
    setInspectorId("");
  }, [open]);

  if (!open) return null;

  const toggleService = (id: string) =>
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const canNext =
    // propertyAddress has a min(5) server constraint — enforce it here so the
    // wizard cannot advance into an inevitable 400.
    step === "property" ? address.trim().length >= 5 && templateId.length > 0 :
    step === "services" ? services.size > 0 :
    step === "schedule" ? date.length > 0 :
    true;

  // B-21 — the backdrop used to discard a half-filled wizard on a stray
  // click. Once the form is dirty, only Cancel / × close it (no native
  // confirm dialogs per project convention).
  const dirty = address.trim().length > 0 || templateId.length > 0 || services.size > 0;
  const handleBackdrop = () => {
    if (!dirty) onClose();
  };

  function handleSubmit() {
    fetcher.submit(
      {
        intent: "create",
        propertyType,
        address,
        templateId,
        serviceIds: [...services].join(","),
        date,
        time,
        soloMode: String(soloMode),
        inspectorId,
      },
      { method: "post", action: "/dashboard" },
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.4)] backdrop-blur-sm" onClick={handleBackdrop}>
      <div className="w-full max-w-lg bg-ih-bg-card rounded-xl shadow-ih-popover" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ih-border">
          <h2 className="text-[16px] font-bold">New Inspection</h2>
          <button onClick={onClose} className="text-ih-fg-4 hover:text-ih-fg-2 text-lg leading-none">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 pt-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i <= stepIdx ? "bg-ih-primary text-white" : "bg-ih-bg-muted text-ih-fg-4"}`}>{i + 1}</div>
              <span className={`text-[11px] font-medium hidden sm:inline ${i <= stepIdx ? "text-ih-primary" : "text-ih-fg-4"}`}>{STEP_LABELS[s]}</span>
              {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${i < stepIdx ? "bg-ih-primary" : "bg-ih-bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[220px]">
          {step === "property" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Property Type</label>
                <div className="flex gap-2">
                  {PROPERTY_TYPES.map((pt) => (
                    <button key={pt.value} onClick={() => setPropertyType(pt.value)}
                      className={`flex-1 py-2 rounded-md text-[12px] font-bold border transition-colors ${propertyType === pt.value ? "border-ih-primary bg-ih-primary-tint text-ih-primary" : "border-ih-border text-ih-fg-3"}`}
                    >{pt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Template</label>
                {templates.length === 0 ? (
                  <p className="text-[12px] text-ih-fg-4 px-1 py-2">
                    No templates yet — create one under Templates first.
                  </p>
                ) : (
                  <>
                    {templates.length > 6 && (
                      <input
                        value={templateQuery}
                        onChange={(e) => setTemplateQuery(e.target.value)}
                        placeholder="Type to filter templates…"
                        className="w-full h-9 px-3 mb-2 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none placeholder:text-ih-fg-4"
                      />
                    )}
                    <select
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none"
                    >
                      <option value="">Select a template…</option>
                      {filteredTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {typeof t.itemCount === "number" ? ` (${t.itemCount} item${t.itemCount === 1 ? "" : "s"})` : ""}
                        </option>
                      ))}
                    </select>
                    {templateQuery && filteredTemplates.length === 0 && (
                      <p className="text-[12px] text-ih-fg-4 mt-1">No templates match “{templateQuery}”.</p>
                    )}
                    {selectedTemplate && (
                      <p className="text-[12px] text-ih-fg-4 mt-1">
                        Selected: {selectedTemplate.name}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === "services" && (
            <div className="space-y-2">
              <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Select Services</label>
              <div className="grid grid-cols-2 gap-2">
                {serviceCatalog.map((s) => (
                  <button key={s.id} onClick={() => toggleService(s.id)}
                    className={`text-left px-3 py-2 rounded-md text-[12px] font-medium border transition-colors ${services.has(s.id) ? "border-ih-primary bg-ih-primary-tint text-ih-primary" : "border-ih-border text-ih-fg-3"}`}
                  >
                    {services.has(s.id) ? "✓ " : ""}{s.name}
                    {typeof s.price === "number" && s.price > 0 ? (
                      // FE-7: price is stored in cents — "$400.00", not "$40000"
                      <span className="ml-1 text-ih-fg-4">{formatPriceCents(s.price)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "schedule" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none" />
              </div>
            </div>
          )}

          {step === "team" && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Team Mode</label>
                <div className="flex gap-2">
                  <button onClick={() => setSoloMode(true)} className={`flex-1 py-2 rounded-md text-[12px] font-bold border transition-colors ${soloMode ? "border-ih-primary bg-ih-primary-tint text-ih-primary" : "border-ih-border text-ih-fg-3"}`}>Solo</button>
                  <button onClick={() => setSoloMode(false)} className={`flex-1 py-2 rounded-md text-[12px] font-bold border transition-colors ${!soloMode ? "border-ih-primary bg-ih-primary-tint text-ih-primary" : "border-ih-border text-ih-fg-3"}`}>Team</button>
                </div>
              </div>
              {!soloMode && (
                <div>
                  <label className="block text-[12px] font-bold text-ih-fg-3 mb-1.5">Inspector</label>
                  {teamMembers.length > 0 ? (
                    <select
                      value={inspectorId}
                      onChange={(e) => setInspectorId(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none"
                    >
                      <option value="">Select an inspector…</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={inspectorId} onChange={(e) => setInspectorId(e.target.value)} placeholder="Inspector ID or name" className="w-full h-9 px-3 rounded-md border border-ih-border bg-ih-bg-card text-[13px] focus:shadow-ih-focus outline-none" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ih-border">
          <button onClick={() => stepIdx > 0 ? setStepIdx(stepIdx - 1) : onClose()} className="h-8 px-4 rounded-md border border-ih-border text-[13px] font-medium text-ih-fg-3 hover:bg-ih-bg-muted">
            {stepIdx > 0 ? "Back" : "Cancel"}
          </button>
          {stepIdx < steps.length - 1 ? (
            <button disabled={!canNext} onClick={() => setStepIdx(stepIdx + 1)} className="h-8 px-4 rounded-md bg-ih-primary text-white font-bold text-[13px] hover:bg-ih-primary-600 disabled:opacity-40 disabled:cursor-not-allowed">
              Next
            </button>
          ) : (
            <button disabled={!canNext} onClick={handleSubmit} className="h-8 px-4 rounded-md bg-ih-primary text-white font-bold text-[13px] hover:bg-ih-primary-600 disabled:opacity-40 disabled:cursor-not-allowed">
              Create Inspection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
