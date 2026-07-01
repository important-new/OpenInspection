import type { TemplateItem, TemplateSection } from "./types";

export interface ItemCommentsPanelProps {
  selectedItem: TemplateItem;
  activeSection: number;
  editingItem: string | null;
  updateSections: (fn: (s: TemplateSection[]) => TemplateSection[]) => void;
  addCannedToItem: (tab: "information" | "limitations" | "defects") => void;
  removeCannedFromItem: (tab: "information" | "limitations" | "defects", idx: number) => void;
}

export function ItemCommentsPanel({ selectedItem, activeSection, editingItem, updateSections, addCannedToItem, removeCannedFromItem }: ItemCommentsPanelProps) {
  return (
    <>
      {(["information", "limitations", "defects"] as const).map((tab) => (
        <div key={tab}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ih-fg-4 capitalize">{tab}</span>
            <button onClick={() => addCannedToItem(tab)} className="text-[10px] font-bold text-ih-primary hover:text-ih-primary">+ Add</button>
          </div>
          {(selectedItem.tabs?.[tab] || []).map((c, ci, arr) => (
            <div key={c.id} className="flex items-start gap-1 mb-1.5">
              <div className="flex flex-col gap-0.5 pt-0.5">
                <button
                  aria-label="Move up"
                  disabled={ci === 0}
                  onClick={() => updateSections((s) => {
                    const it = s[activeSection].items.find((i) => i.id === editingItem);
                    const a = it?.tabs?.[tab];
                    if (a && ci > 0) { const [m] = a.splice(ci, 1); a.splice(ci - 1, 0, m); }
                    return s;
                  })}
                  className="text-[10px] text-ih-fg-4 hover:text-ih-fg-2 disabled:opacity-30"
                >▲</button>
                <button
                  aria-label="Move down"
                  disabled={ci === arr.length - 1}
                  onClick={() => updateSections((s) => {
                    const it = s[activeSection].items.find((i) => i.id === editingItem);
                    const a = it?.tabs?.[tab];
                    if (a && ci < a.length - 1) { const [m] = a.splice(ci, 1); a.splice(ci + 1, 0, m); }
                    return s;
                  })}
                  className="text-[10px] text-ih-fg-4 hover:text-ih-fg-2 disabled:opacity-30"
                >▼</button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-0.5">
                  <input
                    value={c.title}
                    onChange={(e) => {
                      updateSections((s) => {
                        const it = s[activeSection].items.find((i) => i.id === editingItem);
                        if (it?.tabs?.[tab]?.[ci]) it.tabs[tab][ci].title = e.target.value;
                        return s;
                      });
                    }}
                    placeholder="Title"
                    className="flex-1 text-[11px] font-bold bg-transparent border-b border-ih-border outline-none text-ih-fg-2"
                  />
                  <input
                    value={c.abbrev ?? ""}
                    onChange={(e) => {
                      updateSections((s) => {
                        const it = s[activeSection].items.find((i) => i.id === editingItem);
                        if (it?.tabs?.[tab]?.[ci]) it.tabs[tab][ci].abbrev = e.target.value.slice(0, 12);
                        return s;
                      });
                    }}
                    placeholder="abbr"
                    maxLength={12}
                    title="Shortcode — type this in the report to fill this comment"
                    className="w-16 text-[10px] font-mono bg-transparent border-b border-ih-border outline-none text-ih-fg-3"
                  />
                </div>
                <textarea
                  value={c.comment}
                  onChange={(e) => {
                    updateSections((s) => {
                      const it = s[activeSection].items.find((i) => i.id === editingItem);
                      if (it?.tabs?.[tab]?.[ci]) it.tabs[tab][ci].comment = e.target.value;
                      return s;
                    });
                  }}
                  placeholder="Comment text..."
                  rows={2}
                  className="w-full text-[11px] bg-transparent border border-ih-border rounded px-1 py-0.5 outline-none text-ih-fg-3"
                />
              </div>
              <button onClick={() => removeCannedFromItem(tab, ci)} className="text-ih-fg-4 hover:text-ih-bad-fg text-[10px] mt-1">&times;</button>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
