"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bookmark, Search, Settings } from "lucide-react";

const navItems = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/search", label: "検索", icon: Search },
  { href: "/settings", label: "設定", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      {/* Main content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <ul className="flex h-16 items-center justify-around px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 1.8}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
