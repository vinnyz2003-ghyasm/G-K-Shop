"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ScanLine, Boxes, Truck,
  Receipt, BookText, Settings, Store, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos",       label: "New Sale",  icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/purchases", label: "Purchases", icon: Truck },
  { href: "/expenses",  label: "Expenses",  icon: Receipt },
  { href: "/udhaar",    label: "Udhaar",    icon: BookText },
  { href: "/settings",  label: "Settings",  icon: Settings },
] as const;

const MOBILE_PRIMARY_HREFS = ["/dashboard", "/pos", "/inventory", "/udhaar", "/settings"];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        {/* Logo area */}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
            <Store className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold tracking-tight text-foreground">G&K Shop Tracker</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout button */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
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
                  "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "drop-shadow-sm")} />
                {item.label}
                {active && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
