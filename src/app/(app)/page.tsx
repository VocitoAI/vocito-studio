"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Clock, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  // Mock data - wordt vervangen in Deel B
  const recentVideos = [
    {
      id: "placeholder-1",
      title: "Vocito Launch v07 EN",
      status: "completed" as const,
      createdAt: "2 hours ago",
      duration: "0:33",
    },
    {
      id: "placeholder-2",
      title: "Feature Announcement Q2",
      status: "processing" as const,
      createdAt: "5 hours ago",
      duration: "—",
    },
  ];

  const stats = [
    { label: "Total videos", value: "12", icon: Sparkles },
    { label: "This month", value: "8", icon: Clock },
    { label: "Approved", value: "7", icon: CheckCircle2 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-serif-italic text-5xl mb-3">Welcome back.</h1>
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
        <div className="grid grid-cols-3 gap-4 mb-10">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-1.5 rounded bg-ui">
                      <Icon className="h-3.5 w-3.5 text-foreground-muted" />
                    </div>
                    <p className="text-xs text-foreground-muted uppercase tracking-wider font-mono">
                      {stat.label}
                    </p>
                  </div>
                  <p className="text-3xl font-medium">{stat.value}</p>
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
                      <p className="font-medium truncate">{video.title}</p>
                      <p className="text-sm text-foreground-muted font-mono">
                        {video.createdAt} · {video.duration}
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
        </div>
      </motion.div>
    </div>
  );
}
