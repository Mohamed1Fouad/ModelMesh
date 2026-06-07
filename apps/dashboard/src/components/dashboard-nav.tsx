"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/chat", label: "Chat" },
  { href: "/providers", label: "Providers" },
  { href: "/routing", label: "Routing" },
  { href: "/usage", label: "Usage" },
  { href: "/api-keys", label: "API Keys" },
  // { href: "/teams", label: "Teams" },
  // { href: "/marketplace", label: "Marketplace" },
  { href: "/audit-logs", label: "Logs" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-md px-3 py-1.5 transition-colors",
            pathname === item.href
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
