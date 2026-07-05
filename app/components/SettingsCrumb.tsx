export interface CrumbItem {
  label: string;
  href?: string;
}

interface SettingsCrumbProps {
  items: CrumbItem[];
}

export function SettingsCrumb({ items }: SettingsCrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-ih-fg-3 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            {idx > 0 && (
              <svg className="w-3 h-3 text-ih-fg-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
            {item.href && !isLast ? (
              <a href={item.href} className="hover:text-ih-primary transition-colors">{item.label}</a>
            ) : (
              <span className={isLast ? "text-ih-fg-1 font-bold" : "text-ih-fg-3"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
