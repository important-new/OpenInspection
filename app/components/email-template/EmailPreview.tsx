import { useEffect, useRef, useState } from "react";

export function EmailPreview({ trigger, subject, blocks }: { trigger: string; subject: string; blocks: Record<string, string> }) {
  const [html, setHtml] = useState<string>("");
  const [renderedSubject, setRenderedSubject] = useState<string>(subject);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/email-templates/${trigger}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: subject.trim() ? subject : null, blocks }),
        });
        if (res.ok) {
          const body = (await res.json()) as { data: { subject: string; html: string } };
          setHtml(body.data.html);
          setRenderedSubject(body.data.subject);
        }
      } catch {
        /* preview is best-effort */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [trigger, subject, JSON.stringify(blocks)]);

  return (
    <div className="lg:sticky lg:top-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ih-fg-3">Preview</p>
        <span className={`text-[10px] uppercase tracking-widest ${loading ? "text-ih-watch-fg" : "text-ih-fg-4"}`}>{loading ? "Updating…" : "Sample data"}</span>
      </div>
      <div className="rounded-lg border border-ih-border overflow-hidden shadow-sm bg-white">
        <div className="flex items-center gap-1.5 px-3 h-8 bg-ih-bg-muted border-b border-ih-border">
          <span className="h-2.5 w-2.5 rounded-full bg-ih-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-ih-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-ih-border" />
        </div>
        <div className="px-4 py-2.5 border-b border-ih-border bg-white">
          <p className="text-[11px] text-ih-fg-4">To: client@example.com</p>
          <p className="text-[13px] font-semibold text-ih-fg-1 truncate">{renderedSubject || "—"}</p>
        </div>
        <iframe title="Email preview" srcDoc={html} sandbox="" className="w-full h-[520px] bg-white" />
      </div>
    </div>
  );
}
