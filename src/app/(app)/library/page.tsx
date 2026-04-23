"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const mockVideos = [
  {
    id: "1",
    title: "Vocito Launch v07 EN",
    status: "completed",
    date: "Today, 14:32",
    duration: "0:33",
  },
  {
    id: "2",
    title: "Feature Announcement Q2",
    status: "processing",
    date: "Today, 11:15",
    duration: "—",
  },
  {
    id: "3",
    title: "Tandarts Marketing Video",
    status: "completed",
    date: "Yesterday, 16:40",
    duration: "0:28",
  },
  {
    id: "4",
    title: "Makelaar Pitch Video",
    status: "draft",
    date: "Apr 20, 2026",
    duration: "—",
  },
];

export default function LibraryPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif-italic text-4xl mb-2">Library</h1>
            <p className="text-foreground-muted">
              All your generated videos, organized and searchable.
            </p>
          </div>
          <Button variant="secondary" size="md">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>

        <div className="grid gap-3">
          {mockVideos.map((video) => (
            <Link key={video.id} href={`/video/${video.id}`}>
              <Card className="hover:border-border-hover transition-colors">
                <CardContent className="p-5 flex items-center gap-5">
                  <div className="w-32 h-20 rounded-lg bg-ui shrink-0 flex items-center justify-center overflow-hidden">
                    <Sparkles className="h-5 w-5 text-foreground-subtle" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base truncate">
                      {video.title}
                    </p>
                    <p className="text-sm text-foreground-muted font-mono mt-1">
                      {video.date} · {video.duration}
                    </p>
                  </div>
                  <Badge
                    variant={
                      video.status === "completed"
                        ? "success"
                        : video.status === "processing"
                          ? "accent"
                          : "default"
                    }
                  >
                    {video.status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
