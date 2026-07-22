"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ScanLine, Boxes, Truck, Receipt, BookText, Settings, Store } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "New Sale", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/udhaar", label: "Udhaar", icon: BookText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Bottom bar only has room for the items used most while standing at the counter.
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/pos", "/inventory", "/udhaar", "/settings"];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 px-4 py-5">
          <Store className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">G&amp;K Shop Tracker</span>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <main className="flex-1 px-4 py-5 pb-24 md:pb-8">{children}</main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 backdrop-blur md:hidden">
          {NAV_ITEMS.filter((i) => MOBILE_PRIMARY_HREFS.includes(i.href)).map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
