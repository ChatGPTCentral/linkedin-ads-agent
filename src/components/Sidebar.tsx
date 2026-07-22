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
const PlugIcon = () => I(<><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v5" /></>);

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
    title: "Systems",
    items: [{ href: "/connect", label: "Connections", Icon: PlugIcon }],
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
