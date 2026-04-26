"use client";

import { History } from "lucide-react";

type Props = {
  iterations: any[];
  activeRunId: string;
  onSelect: (id: string) => void;
};

const BADGE: Record<string, { text: string; cls: string }> = {
  approved: { text: "FINAL", cls: "bg-success-subtle text-success border-success/20" },
  superseded: { text: "ITERATED", cls: "bg-ui text-foreground-muted border-border" },
  rejected: { text: "REJECTED", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function IterationHistory({ iterations, activeRunId, onSelect }: Props) {
  if (iterations.length <= 1) return null;

  return (
    <div className="rounded-xl border border-border bg-ui-elevated p-5">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-foreground-muted" />
        <p className="label-mono">ITERATIONS</p>
      </div>
      <div className="space-y-1.5">
        {iterations.map((iter) => {
          const active = iter.id === activeRunId;
          const decision = iter.review_decision || iter.status;
          const badge = BADGE[decision];

          return (
            <button key={iter.id} onClick={() => onSelect(iter.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${active ? "bg-accent/10 border border-accent/30" : "border border-border hover:border-border-hover"}`}>
              <span className="font-mono text-sm tabular-nums w-8">{iter.iteration_label || `V${iter.iteration_number}`}</span>
              <div className="flex-1 min-w-0">
                {iter.regeneration_scope?.length > 0 && (
                  <p className="text-xs text-foreground-muted truncate">Changed: {iter.regeneration_scope.join(", ")}</p>
                )}
                <p className="text-xs text-foreground-subtle">
                  {new Date(iter.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {badge && <span className={`text-xs px-2 py-0.5 rounded-md font-mono border ${badge.cls}`}>{badge.text}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
