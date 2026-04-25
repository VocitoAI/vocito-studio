"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "New Video", href: "/new", icon: Sparkles },
  { name: "Library", href: "/library", icon: Library },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border">
        <Link href="/" className="block" onClick={() => setOpen(false)}>
          <h1 className="font-display text-2xl">Vocito</h1>
          <p className="label-mono mt-0.5">STUDIO · BETA</p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative",
                isActive
                  ? "text-foreground bg-ui-elevated"
                  : "text-foreground-muted hover:text-foreground hover:bg-ui-elevated/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full"
                  transition={{ duration: 0.2 }}
                />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={async () => {
            await fetch("/api/auth", { method: "DELETE" });
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-ui-elevated/50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 min-h-screen bg-ui border-r border-border flex-col">
        {nav}
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-ui border border-border"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 w-60 bg-ui border-r border-border flex flex-col z-50">
            {nav}
          </aside>
        </>
      )}
    </>
  );
}
