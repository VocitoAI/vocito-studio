"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const CATEGORIES = [
  { id: "visuals", label: "Visuals", desc: "Blob, animations, layout, copy styling" },
  { id: "vo", label: "Voice-over", desc: "VO emotion, pacing, voice quality" },
  { id: "text", label: "Tekst / Copy", desc: "Wat er gezegd of getoond wordt" },
  { id: "music", label: "Music", desc: "Mood, volume, ducking, track choice" },
  { id: "sfx", label: "Sound effects", desc: "SFX timing, volumes, choices" },
];

const SCENES = [
  { id: "scene1_materializes", label: "Scene 1 — Opener" },
  { id: "scene2_pain_01", label: "Scene 2 — Pain 01" },
  { id: "scene3_pain_02", label: "Scene 3 — Pain 02" },
  { id: "scene4_action", label: "Scene 4 — Action" },
  { id: "scene5_promise_01", label: "Scene 5 — Promise 01" },
  { id: "scene6_promise_02", label: "Scene 6 — Promise 02" },
  { id: "scene7_tagline", label: "Scene 7 — Tagline" },
  { id: "scene8_wordmark", label: "Scene 8 — Wordmark" },
];

type Props = {
  run: { id: string; review_decision: string | null };
  onApproved: () => void;
  onRejected: () => void;
};

export function RenderReview({ run, onApproved, onRejected }: Props) {
  const [mode, setMode] = useState("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [globalFb, setGlobalFb] = useState("");
  const [fbMode, setFbMode] = useState<"global" | "per_scene">("global");
  const [perScene, setPerScene] = useState<Record<string, { categories: string[]; feedback: string }>>({});
  const [activeScenes, setActiveScenes] = useState<string[]>([]);

  if (run.review_decision === "approved") {
    return (
      <div className="rounded-xl border border-success/20 bg-success-subtle/30 p-5">
        <div className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Approved as final version</span>
        </div>
      </div>
    );
  }

  if (run.review_decision === "superseded") {
    return (
      <div className="rounded-xl border border-border bg-ui-elevated p-5">
        <p className="text-sm text-foreground-muted">A newer iteration was generated.</p>
      </div>
    );
  }

  const toggleCat = (c: string) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const toggleScene = (s: string) => {
    setActiveScenes((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
    if (!perScene[s]) setPerScene({ ...perScene, [s]: { categories: [], feedback: "" } });
  };
  const togglePerSceneCat = (s: string, c: string) => {
    const cur = perScene[s]?.categories || [];
    setPerScene({ ...perScene, [s]: { ...perScene[s], categories: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] } });
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    await fetch(`/api/render/${run.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });
    onApproved();
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const allCats = new Set(cats);
    Object.values(perScene).forEach((s) => s.categories.forEach((c) => allCats.add(c)));

    await fetch(`/api/render/${run.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "rejected",
        feedback: { categories: Array.from(allCats), globalFeedback: globalFb, perScene },
      }),
    });
    onRejected();
    setIsSubmitting(false);
    setMode("idle");
  };

  return (
    <div className="rounded-xl border border-border bg-ui-elevated p-5">
      <p className="label-mono mb-4">REVIEW</p>

      {mode === "idle" && (
        <div className="flex gap-3">
          <button onClick={handleApprove} className="inline-flex items-center gap-2 rounded-lg bg-success text-background hover:bg-success/90 h-10 px-5 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" /> Approve as final
          </button>
          <button onClick={() => setMode("rejecting")} className="inline-flex items-center gap-2 rounded-lg border border-border hover:border-border-hover bg-ui h-10 px-5 text-sm font-medium">
            <AlertCircle className="h-4 w-4" /> Needs changes
          </button>
        </div>
      )}

      {mode === "rejecting" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["global", "per_scene"] as const).map((m) => (
              <button key={m} onClick={() => setFbMode(m)} className={`text-xs font-mono px-3 py-1.5 rounded-md ${fbMode === m ? "bg-accent text-background" : "bg-ui text-foreground-muted"}`}>
                {m === "global" ? "Hele video" : "Per scene"}
              </button>
            ))}
          </div>

          {fbMode === "global" && (
            <>
              <div className="space-y-2">
                {CATEGORIES.map((c) => (
                  <label key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-border-hover cursor-pointer">
                    <input type="checkbox" checked={cats.includes(c.id)} onChange={() => toggleCat(c.id)} className="mt-0.5" />
                    <div><p className="text-sm font-medium">{c.label}</p><p className="text-xs text-foreground-subtle">{c.desc}</p></div>
                  </label>
                ))}
              </div>
              <textarea value={globalFb} onChange={(e) => setGlobalFb(e.target.value)} placeholder="Beschrijf wat je wilt veranderen..." rows={4} className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono resize-none focus:outline-none focus:border-accent/40" />
            </>
          )}

          {fbMode === "per_scene" && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {SCENES.map((scene) => (
                <div key={scene.id} className={`rounded-lg border ${activeScenes.includes(scene.id) ? "border-accent/30 bg-accent/5" : "border-border"}`}>
                  <button onClick={() => toggleScene(scene.id)} className="w-full flex items-center gap-3 p-3 text-left">
                    <input type="checkbox" checked={activeScenes.includes(scene.id)} readOnly />
                    <span className="text-sm font-medium">{scene.label}</span>
                  </button>
                  {activeScenes.includes(scene.id) && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((c) => (
                          <button key={c.id} onClick={() => togglePerSceneCat(scene.id, c.id)} className={`text-xs px-2 py-1 rounded-md font-mono ${perScene[scene.id]?.categories.includes(c.id) ? "bg-accent text-background" : "bg-ui text-foreground-muted"}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <textarea value={perScene[scene.id]?.feedback || ""} onChange={(e) => setPerScene({ ...perScene, [scene.id]: { ...perScene[scene.id], feedback: e.target.value } })} placeholder={`Wat moet anders?`} rows={2} className="w-full rounded-lg border border-border bg-background p-2 text-sm font-mono resize-none focus:outline-none" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={isSubmitting || (cats.length === 0 && activeScenes.length === 0)} className="inline-flex items-center gap-2 rounded-lg bg-accent text-background hover:bg-accent/90 disabled:opacity-40 h-10 px-5 text-sm font-medium">
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : "Generate new iteration"}
            </button>
            <button onClick={() => setMode("idle")} className="rounded-lg border border-border hover:border-border-hover bg-ui h-10 px-5 text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
