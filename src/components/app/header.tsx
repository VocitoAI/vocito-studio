"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/new": "Create New Video",
  "/library": "Video Library",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const title =
    titles[pathname] ||
    (pathname.startsWith("/plan/") ? "Plan Review" : "Studio");

  return (
    <header className="h-14 border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-30 flex items-center px-4 md:px-8">
      {/* Spacer for mobile hamburger */}
      <div className="w-10 md:hidden" />
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-foreground-subtle font-mono">
          v0.1.0
        </span>
      </div>
    </header>
  );
}
