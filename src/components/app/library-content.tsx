"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PromptRow {
  id: string;
  raw_prompt: string;
  language: string;
  status: string;
  created_at: string;
  review_feedback: string | null;
  notes: string | null;
}

function statusBadgeVariant(
  status: string
): "success" | "accent" | "destructive" | "default" {
  switch (status) {
    case "plan_approved":
      return "success";
    case "plan_ready":
      return "accent";
    case "plan_rejected":
      return "destructive";
    default:
      return "default";
  }
}

function statusLabel(status: string): string {
  return status.replace("plan_", "").replace("_", " ");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRegeneratedFromId(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(
    /Regenerated from rejected plan ([0-9a-f-]{36})/
  );
  return match ? match[1] : null;
}

export function LibraryContent({ prompts }: { prompts: PromptRow[] }) {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-5xl mb-2">Library</h1>
            <p className="text-foreground-muted">
              {prompts.length} plan{prompts.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <Link
            href="/new"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            + New video
          </Link>
        </div>

        {prompts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-foreground-muted mb-4">
                No plans yet. Create your first one!
              </p>
              <Link
                href="/new"
                className="text-sm text-accent hover:underline"
              >
                Go to New Video →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {prompts.map((prompt) => {
              const regeneratedFrom = getRegeneratedFromId(prompt.notes);

              return (
                <Link key={prompt.id} href={`/plan/${prompt.id}`}>
                  <Card
                    className={`hover:border-border-hover transition-colors ${
                      prompt.status === "plan_rejected" ? "opacity-50" : ""
                    }`}
                  >
                    <CardContent className="p-5 flex items-center gap-5">
                      <div className="w-12 h-12 rounded-lg bg-ui shrink-0 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-foreground-subtle" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-base truncate">
                          {prompt.raw_prompt}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-foreground-muted font-mono">
                            {formatDate(prompt.created_at)} ·{" "}
                            {prompt.language.toUpperCase()}
                          </p>
                          {regeneratedFrom && (
                            <span className="inline-flex items-center gap-1 text-xs text-foreground-subtle">
                              <RefreshCw className="h-3 w-3" />
                              regenerated
                            </span>
                          )}
                        </div>
                        {prompt.status === "plan_rejected" &&
                          prompt.review_feedback && (
                            <p className="text-xs text-foreground-subtle mt-1 truncate italic">
                              &quot;
                              {prompt.review_feedback.length > 80
                                ? prompt.review_feedback.slice(0, 80) + "…"
                                : prompt.review_feedback}
                              &quot;
                            </p>
                          )}
                      </div>
                      <Badge variant={statusBadgeVariant(prompt.status)}>
                        {statusLabel(prompt.status)}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
