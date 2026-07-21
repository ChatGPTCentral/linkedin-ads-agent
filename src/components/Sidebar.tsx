"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactElement } from "react";

// ── Icons (AI Central stroke style) ──
const I = (d: ReactElement) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const HomeIcon = () => I(<><path d="M3 12l9-9 9 9" /><path d="M5 10v10h14V10" /></>);
const MapIcon = () => I(<><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6" /><line x1="8" y1="3" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="21" /></>);
const ChartIcon = () => I(<><line x1="4" y1="20" x2="4" y2="10" /><line x1="10" y1="20" x2="10" y2="4" /><line x1="16" y1="20" x2="16" y2="14" /><line x1="22" y1="20" x2="2" y2="20" /></>);
const UsersIcon = () => I(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>);
const DocIcon = () => I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>);
const PlugIcon = () => I(<><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></>);
const BookIcon = () => I(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>);
const GearIcon = () => I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 9.4l-.33-.33a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 12 4.6h.09A2 2 0 0 1 14 6v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 12v.09z" /></>);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
);
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
);

type NavItem = { href: string; label: string; Icon: () => ReactElement };
type NavGroup = { title: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { href: "/", label: "Cockpit", Icon: HomeIcon },
      { href: "/strategy", label: "Strategy", Icon: MapIcon },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/insights", label: "Conversion Insights", Icon: ChartIcon },
      { href: "/icp", label: "ICP Profile", Icon: UsersIcon },
      { href: "/audiences", label: "Audiences", Icon: UsersIcon },
      { href: "/brief", label: "Campaign Brief", Icon: DocIcon },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/connect", label: "Connections", Icon: PlugIcon },
      { href: "/methodology", label: "Methodology", Icon: BookIcon },
      { href: "/settings", label: "Settings", Icon: GearIcon },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (localStorage.getItem("sb-collapsed") === "1") setCollapsed(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const toggleCollapse = () =>
    setCollapsed((v) => {
      localStorage.setItem("sb-collapsed", v ? "0" : "1");
      return !v;
    });

  const nav = (
    <nav className="sb-nav">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.title ?? `g${gi}`} className="sb-group">
          {group.title && <div className="sb-group-label">{group.title}</div>}
          {group.items.map(({ href, label, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`sb-item${active ? " active" : ""}`}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
              >
                <span className="sb-icon">
                  <Icon />
                </span>
                {!collapsed && <span className="sb-item-label">{label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="mob-bar no-print">
        <button className="mob-menu-btn" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu">
          {mobileOpen ? <XIcon /> : <MenuIcon />}
        </button>
        <span className="mob-brand">AI Central · Ads</span>
      </div>

      {mobileOpen && <div className="sb-overlay no-print" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar no-print${mobileOpen ? " mob-open" : ""}${collapsed ? " collapsed" : ""}`}>
        <div className="sb-brand">
          <div className="sb-logo-img">
            {!collapsed && (
              <Image
                className="sb-logo-full"
                src="/logo-dark.png"
                alt="AI Central"
                width={140}
                height={33}
                style={{ objectFit: "contain", width: "auto", height: 26 }}
                priority
              />
            )}
            <span className="sb-logo-mark">
              <Image src="/brand/logo-square-v2.png" alt="AI Central" width={30} height={30} priority />
            </span>
          </div>
          {!collapsed && (
            <button className="sb-collapse-btn" onClick={toggleCollapse} aria-label="Collapse sidebar" title="Collapse sidebar">
              <ChevronLeft />
            </button>
          )}
        </div>

        {collapsed && (
          <button className="sb-collapse-floating" onClick={toggleCollapse} aria-label="Expand sidebar" title="Expand sidebar">
            <ChevronRight />
          </button>
        )}

        {nav}
      </aside>
    </>
  );
}
