"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Loader2,
  ChevronDown,
  ChevronUp,
  Music,
  Mic,
  Volume2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { ScenePlan } from "@/types/scenePlan";

type PlanRecord = {
  id: string;
  raw_prompt: string;
  language: string;
  scene_plan: ScenePlan | null;
  status: string;
  review_feedback: string | null;
  created_at: string;
};

export function PlanReviewContent({ plan }: { plan: PlanRecord }) {
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const scenePlan = plan.scene_plan;

  if (!scenePlan) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-foreground-muted">
          Plan not generated yet or failed.
        </p>
      </div>
    );
  }

  const isReviewed = plan.status !== "plan_ready";

  const handleReview = async (decision: "approve" | "reject") => {
    setSubmitting(true);

    try {
      const res = await fetch(`/api/plan/${plan.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          feedback: decision === "reject" ? feedback : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit review");

      if (decision === "approve") {
        router.push("/library");
      } else {
        router.push("/new");
      }
    } catch (err) {
      setSubmitting(false);
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          href="/new"
          className="inline-flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New prompt
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="font-display text-4xl">
              Scene <span className="font-serif-italic">Plan</span>
            </h1>
            <Badge
              variant={
                plan.status === "plan_approved"
                  ? "success"
                  : plan.status === "plan_rejected"
                    ? "destructive"
                    : "accent"
              }
            >
              {plan.status.replace("plan_", "")}
            </Badge>
          </div>
          <p className="text-foreground-muted">
            Review Claude&apos;s interpretation before rendering.
          </p>
        </div>

        {/* Original prompt */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="label-mono mb-2">ORIGINAL PROMPT</p>
            <p className="text-base mb-3">{plan.raw_prompt}</p>
            <p className="label-mono">INTERPRETED INTENT</p>
            <p className="text-sm text-foreground-muted mt-1 italic">
              {scenePlan.meta.interpretedIntent}
            </p>
          </CardContent>
        </Card>

        {/* Audio overview */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Music className="h-4 w-4 text-foreground-muted" />
                  <p className="label-mono">MUSIC</p>
                </div>
                <p className="text-sm mb-1">
                  <span className="text-foreground-muted">Mood:</span>{" "}
                  <span className="font-medium">
                    {scenePlan.audio.music.mood}
                  </span>
                </p>
                <p className="text-sm mb-1">
                  <span className="text-foreground-muted">Energy:</span>{" "}
                  <span className="font-mono tabular-nums">
                    {scenePlan.audio.music.energyStart} →{" "}
                    {scenePlan.audio.music.energyEnd}
                  </span>
                </p>
                <p className="text-xs text-foreground-subtle mt-2 font-mono">
                  &quot;{scenePlan.audio.music.searchQuery}&quot;
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="h-4 w-4 text-foreground-muted" />
                  <p className="label-mono">VOICEOVER</p>
                </div>
                <p className="text-sm mb-1">
                  <span className="text-foreground-muted">Language:</span>{" "}
                  <span className="font-medium">
                    {scenePlan.meta.language.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm mb-1">
                  <span className="text-foreground-muted">Speed:</span>{" "}
                  <span className="font-mono tabular-nums">
                    {scenePlan.audio.voiceover.speed}x
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-foreground-muted">Est. duration:</span>{" "}
                  <span className="font-mono tabular-nums">
                    {scenePlan.audio.voiceover.estimatedDurationSeconds}s
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* VO script */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="label-mono mb-3">FULL VO SCRIPT</p>
            <p className="text-sm font-mono whitespace-pre-wrap leading-relaxed text-foreground-muted">
              {scenePlan.audio.voiceover.fullScript}
            </p>
          </CardContent>
        </Card>

        {/* Scenes timeline */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-2xl">
              Scenes{" "}
              <span className="label-mono align-middle ml-2">
                {scenePlan.scenes.length}/8
              </span>
            </h2>
            <button
              onClick={() => {
                if (expandedScenes.size === scenePlan.scenes.length) {
                  setExpandedScenes(new Set());
                } else {
                  setExpandedScenes(new Set(scenePlan.scenes.map((s) => s.id)));
                }
              }}
              className="text-xs text-foreground-muted hover:text-foreground transition-colors font-mono"
            >
              {expandedScenes.size === scenePlan.scenes.length
                ? "Collapse all"
                : "Expand all"}
            </button>
          </div>
          <div className="space-y-2">
            {scenePlan.scenes.map((scene) => {
              const isExpanded = expandedScenes.has(scene.id);
              return (
                <Card
                  key={scene.id}
                  className="cursor-pointer transition-colors hover:border-border-hover"
                  onClick={() => {
                    const next = new Set(expandedScenes);
                    if (isExpanded) {
                      next.delete(scene.id);
                    } else {
                      next.add(scene.id);
                    }
                    setExpandedScenes(next);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-ui flex items-center justify-center shrink-0">
                        <span className="font-mono text-sm tabular-nums">
                          {scene.order}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">
                            {scene.id.replace(/_/g, " ")}
                          </p>
                          <Badge variant="default" className="text-xs">
                            {scene.audio.voEmotion}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground-muted font-mono tabular-nums">
                          Frame {scene.frameStart}–{scene.frameEnd} ·{" "}
                          {scene.durationSeconds}s
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-foreground-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-foreground-muted" />
                      )}
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="pt-4 mt-4 border-t border-border space-y-4">
                            {scene.audio.voText && (
                              <div>
                                <p className="label-mono mb-1">VOICE-OVER</p>
                                <p className="text-sm italic">
                                  &quot;{scene.audio.voText}&quot;
                                </p>
                              </div>
                            )}

                            <div>
                              <p className="label-mono mb-2">VISUAL</p>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                {scene.visual.blob && (
                                  <div>
                                    <p className="text-foreground-muted text-xs mb-1">
                                      Blob
                                    </p>
                                    <p>
                                      {scene.visual.blob.state} ·{" "}
                                      {scene.visual.blob.position}
                                    </p>
                                    <p className="font-mono text-xs text-foreground-subtle tabular-nums">
                                      scale {scene.visual.blob.scale} · opacity{" "}
                                      {scene.visual.blob.opacity}
                                    </p>
                                  </div>
                                )}
                                {scene.visual.copy && (
                                  <div>
                                    <p className="text-foreground-muted text-xs mb-1">
                                      On-screen text
                                    </p>
                                    <p>
                                      &quot;{scene.visual.copy.text}&quot;
                                    </p>
                                    <p className="font-mono text-xs text-foreground-subtle">
                                      {scene.visual.copy.style} ·{" "}
                                      {scene.visual.copy.animation}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {scene.visual.uiElements &&
                                scene.visual.uiElements.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-foreground-muted text-xs mb-1">
                                      UI Elements
                                    </p>
                                    <div className="space-y-1">
                                      {scene.visual.uiElements.map((el, i) => (
                                        <p
                                          key={i}
                                          className="text-xs font-mono text-foreground-muted"
                                        >
                                          {el.type}: &quot;{el.content}&quot;
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>

                            {scene.audio.sfxRequests &&
                              scene.audio.sfxRequests.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Volume2 className="h-3.5 w-3.5 text-foreground-muted" />
                                    <p className="label-mono">SOUND EFFECTS</p>
                                  </div>
                                  <div className="space-y-1">
                                    {scene.audio.sfxRequests.map((sfx, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="font-mono text-foreground-muted">
                                          &quot;{sfx.searchTerm}&quot;
                                        </span>
                                        <span className="text-foreground-subtle">
                                          {" "}
                                          — {sfx.purpose}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                            <div className="pt-3 border-t border-border">
                              <p className="label-mono mb-1">REASONING</p>
                              <p className="text-sm text-foreground-muted italic">
                                {scene.reasoning}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Review actions */}
        {!isReviewed && (
          <Card className="sticky bottom-6 bg-ui-elevated border-accent/20 shadow-2xl">
            <CardContent className="p-5">
              {!showRejectForm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium mb-1">Does this plan work?</p>
                    <p className="text-sm text-foreground-muted">
                      Approve to proceed to render, or reject with feedback.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setShowRejectForm(true)}
                      disabled={submitting}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      variant="accent"
                      onClick={() => handleReview("approve")}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ThumbsUp className="h-4 w-4" />
                          Approve plan
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-2">
                    What should be different?
                  </p>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="E.g., The pain scenes should feel more urgent. The VO is too long. Music mood should be cinematic, not corporate."
                    className="mb-3"
                    rows={4}
                    disabled={submitting}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowRejectForm(false);
                        setFeedback("");
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview("reject")}
                      disabled={submitting || feedback.length < 5}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Reject with feedback"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isReviewed && plan.status === "plan_rejected" && (
          <Card>
            <CardContent className="p-5">
              <div className="mb-4">
                <p className="font-medium mb-2">You rejected this plan</p>
                {plan.review_feedback && (
                  <p className="text-sm text-foreground-muted italic">
                    &quot;{plan.review_feedback}&quot;
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end">
                <Button
                  variant="accent"
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const res = await fetch(
                        `/api/plan/${plan.id}/regenerate`,
                        { method: "POST" }
                      );
                      const data = await res.json();
                      if (res.ok) {
                        router.push(`/plan/${data.promptId}`);
                      } else {
                        setSubmitting(false);
                        console.error("Regenerate failed:", data.error);
                      }
                    } catch (e) {
                      setSubmitting(false);
                      console.error("Error:", e);
                    }
                  }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Regenerate with this feedback
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isReviewed && plan.status === "plan_approved" && (
          <Card>
            <CardContent className="p-5 text-center">
              <p className="text-sm text-foreground-muted">
                This plan was approved. Ready for rendering (coming in B3).
              </p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}
