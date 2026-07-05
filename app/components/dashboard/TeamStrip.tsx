import { useEffect } from "react";
import { useFetcher } from "react-router";
import { Avatar } from "@core/shared-ui";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  online: boolean;
  lastSeenRel?: string;
}

interface TeamStripProps {
  members?: TeamMember[];
}

interface LoaderData { members: TeamMember[]; pendingInvites: unknown[] }

export function TeamStrip({ members: propMembers }: TeamStripProps) {
  const fetcher = useFetcher<LoaderData>();

  useEffect(() => {
    if (!propMembers && fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/resources/team-members");
    }
  }, [propMembers, fetcher]);

  const members: TeamMember[] = propMembers ?? (fetcher.data?.members as TeamMember[] | undefined) ?? [];
  const onlineCount = members.filter((m) => m.online).length;

  if (members.length <= 1) return null;

  return (
    <div className="rounded-xl border border-ih-border bg-ih-bg-card p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-ih-fg-3">Team today</h3>
          <span className="text-xs text-ih-fg-4">
            {onlineCount} online · {members.length} total
          </span>
        </div>
        <a href="/team" className="text-xs font-semibold text-ih-fg-3 hover:text-ih-fg-2">Manage team &rarr;</a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-2 rounded border border-ih-border">
            <Avatar
              name={m.name || m.email}
              size={36}
              variant="flat"
              statusDot={m.online ? "online" : "offline"}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate text-ih-fg-1">{m.name || m.email}</div>
              <div className="text-xs text-ih-fg-4">
                {m.online ? (
                  <span className="text-ih-ok-fg">Online</span>
                ) : m.lastSeenRel ? (
                  <span>last active {m.lastSeenRel}</span>
                ) : (
                  <span>Offline</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
