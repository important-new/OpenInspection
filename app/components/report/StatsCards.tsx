import { StatCard } from "@core/shared-ui";

interface StatsCardsProps {
  total: number;
  satisfactory: number;
  monitor: number;
  defects: number;
}

export function StatsCards({ total, satisfactory, monitor, defects }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="TOTAL ITEMS" value={total} tone="neutral" />
      <StatCard label="SATISFACTORY" value={satisfactory} tone="sat" />
      <StatCard label="MONITOR" value={monitor} tone="monitor" />
      <StatCard label="DEFECTS" value={defects} tone="defect" />
    </div>
  );
}
