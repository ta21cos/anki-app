"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Upload, BarChart3, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "デッキ", icon: BookOpen },
  { href: "/daily", label: "今日", icon: CalendarCheck },
  { href: "/import", label: "インポート", icon: Upload },
  { href: "/stats", label: "統計", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
