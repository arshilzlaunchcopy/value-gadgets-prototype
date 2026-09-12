"use client";

import { Boxes, ChevronLeft, ChevronRight, Image as ImageIcon, ClipboardList, FileText, FolderTree, LayoutDashboard, LayoutTemplate, ListTree, Megaphone, Percent, Search, Settings, Users, UsersRound, LogOut, MessageSquareText, Package, Palette, ShieldAlert, ShoppingCart, SlidersHorizontal, Truck, Warehouse } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { signOutAction } from "@/app/admin/login/actions";

const NAV = [
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/orders/review", label: "Review queue", icon: ShieldAlert, exact: true },
  { href: "/admin/courier", label: "Courier", icon: Truck },
  { href: "/admin/fraud", label: "Fraud rules", icon: ShieldAlert },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/catalog", label: "Categories", icon: FolderTree },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/discounts", label: "Discounts", icon: Percent },
  { href: "/admin/pages", label: "Pages", icon: LayoutTemplate },
  { href: "/admin/landing", label: "Landing pages", icon: Megaphone },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/navigation", label: "Navigation", icon: ListTree },
  { href: "/admin/theme", label: "Theme", icon: Palette },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/seo", label: "SEO Center", icon: Search },
  { href: "/admin/sms", label: "SMS log", icon: MessageSquareText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/staff", label: "Staff", icon: UsersRound },
  { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
  { href: "/demo", label: "Demo panel", icon: SlidersHorizontal, external: true },
];

/** Dark admin shell (BUILD_PROMPT §6.2): ink sidebar, amber active state, collapsible. */
export function AdminShell({ children, storeName, user }: { children: React.ReactNode; storeName: string; user: { email: string; role: string; name: string | null } }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("vgbd-admin-collapsed") === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("vgbd-admin-collapsed", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <div className="bg-paper-soft flex min-h-dvh">
      <aside className={`bg-ink text-paper sticky top-0 flex h-dvh shrink-0 flex-col transition-[width] ${collapsed ? "w-16" : "w-60"}`}>
        <div className="border-ink-line flex items-center gap-2 border-b px-3 py-3">
          <span className="bg-gradient-brand text-ink grid size-8 shrink-0 place-items-center rounded-lg font-bold">%</span>
          {!collapsed && <span className="truncate text-sm font-semibold">{storeName}</span>}
          <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hover:bg-ink-soft ml-auto rounded-lg p-1.5">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Admin">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname.startsWith(n.href) && !(n.href === "/admin/orders" && pathname === "/admin/orders/review");
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                target={n.external ? "_blank" : undefined}
                title={collapsed ? n.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition ${active ? "bg-amber text-ink font-semibold" : "text-paper/80 hover:bg-ink-soft hover:text-paper"}`}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-ink-line border-t p-2">
          {!collapsed && (
            <div className="px-2 pb-2">
              <p className="truncate text-xs font-medium">{user.name ?? user.email}</p>
              <p className="text-paper/50 truncate text-[11px]">{user.email} · {user.role}</p>
            </div>
          )}
          <button type="button" disabled={pending} onClick={() => start(() => signOutAction())} className="text-paper/80 hover:bg-ink-soft hover:text-paper flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm" title="Sign out">
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="bg-paper sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-2 sm:px-6">
          <Link
            href="/admin"
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${pathname === "/admin" ? "bg-amber text-ink font-semibold" : "text-ink hover:bg-paper-soft font-medium"}`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            Dashboard
          </Link>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
      <span className="sr-only">
        <Boxes />
      </span>
    </div>
  );
}
