"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
interface RecentVideo {
  id: string;
  created_at: string;
  status: string;
  duration_seconds: number | null;
  output_url: string | null;
  prompt_id: string | null;
  scene_plan: Record<string, unknown>;
}

interface DashboardContentProps {
  stats: { total: number; thisMonth: number; approved: number };
  recentVideos: RecentVideo[];
}

export function DashboardContent({
  stats,
  recentVideos,
}: DashboardContentProps) {
  const statItems = [
    { label: "Total videos", value: String(stats.total), icon: Sparkles },
    { label: "This month", value: String(stats.thisMonth), icon: Clock },
    { label: "Approved", value: String(stats.approved), icon: CheckCircle2 },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-6xl mb-3 tracking-tight">
            Welcome <span className="font-serif-italic">back.</span>
          </h1>
          <p className="text-foreground-muted text-lg">
            Create premium video content with AI. Just describe what you want.
          </p>
        </div>

        {/* Quick action */}
        <Card className="mb-8 bg-gradient-to-br from-ui-elevated via-ui-elevated to-accent-subtle/30 border-accent/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium mb-1">
                Ready to create something new?
              </h3>
              <p className="text-sm text-foreground-muted">
                Start with a prompt in your own words.
              </p>
            </div>
            <Link href="/new">
              <Button variant="accent">
                <Sparkles className="h-4 w-4" />
                New Video
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {statItems.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-1.5 rounded bg-ui">
                      <Icon className="h-3.5 w-3.5 text-foreground-muted" />
                    </div>
                    <p className="label-mono">{stat.label}</p>
                  </div>
                  <p className="text-3xl font-medium tabular-nums">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent videos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Recent videos</h2>
            <Link
              href="/library"
              className="text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          {recentVideos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-foreground-muted">
                  No videos yet. Create your first one!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/video/${video.id}`}
                  className="block"
                >
                  <Card className="hover:border-border-hover transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-20 h-12 rounded bg-ui shrink-0 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-foreground-subtle" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {String(
                            (video.scene_plan as Record<string, unknown>)
                              ?.title ?? `Video ${video.id.slice(0, 8)}`
                          )}
                        </p>
                        <p className="text-sm text-foreground-muted font-mono">
                          {new Date(video.created_at).toLocaleDateString()} ·{" "}
                          {video.duration_seconds
                            ? `${Math.floor(video.duration_seconds / 60)}:${String(Math.floor(video.duration_seconds % 60)).padStart(2, "0")}`
                            : "—"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          video.status === "completed" ? "success" : "accent"
                        }
                      >
                        {video.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
