export function EmailPreview({ trigger, subject, blocks }: { trigger: string; subject: string; blocks: Record<string, string> }) {
  // Stub — live preview implemented in the next task.
  void trigger; void blocks;
  return (
    <div className="lg:sticky lg:top-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ih-fg-3 mb-2">Preview</p>
      <div className="rounded-lg border border-ih-border bg-ih-bg-muted h-[560px] flex items-center justify-center text-[12px] text-ih-fg-4">
        Live preview — {subject || "…"}
      </div>
    </div>
  );
}
