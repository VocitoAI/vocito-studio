"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ThumbsUp, ThumbsDown, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VideoDetailPage() {
  const params = useParams();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to library
        </Link>

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-serif-italic text-4xl">Video {params.id}</h1>
            <Badge variant="success">Completed</Badge>
          </div>
          <p className="text-foreground-muted font-mono text-sm">
            Created today at 14:32 · Duration 0:33 · 1920x1080
          </p>
        </div>

        {/* Video player placeholder */}
        <Card className="mb-6 overflow-hidden">
          <div className="aspect-video bg-ui flex items-center justify-center">
            <p className="text-foreground-subtle font-mono text-sm">
              Video player · coming in brief A3
            </p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="secondary" size="md">
            <Download className="h-4 w-4" />
            Download
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="md">
              <ThumbsUp className="h-4 w-4" />
              Approve
            </Button>
            <Button variant="secondary" size="md">
              <ThumbsDown className="h-4 w-4" />
              Request changes
            </Button>
          </div>
        </div>

        {/* Generation details placeholder */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium mb-4">Generation details</p>
            <p className="text-sm text-foreground-muted font-mono">
              Prompt history, asset selection, and mix parameters will be shown
              here in brief B.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
