"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const examplePrompts = [
  {
    text: "Launch video voor onze nieuwe spam filter feature",
    lang: "nl" as const,
  },
  {
    text: "Marketing video voor tandartspraktijken — Vocito beantwoordt gemiste calls automatisch",
    lang: "nl" as const,
  },
  {
    text: "Launch announcement for our voicemail-to-text feature, premium tone like Apple",
    lang: "en" as const,
  },
];

const languages = [
  { value: "en" as const, label: "English" },
  { value: "nl" as const, label: "Nederlands" },
  { value: "de" as const, label: "Deutsch" },
];

export default function NewVideoPage() {
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<"en" | "nl" | "de">("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugIssues, setDebugIssues] = useState<unknown[] | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (prompt.length < 10) return;

    setLoading(true);
    setError("");
    setDebugIssues(null);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPrompt: prompt, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.issues) {
          setDebugIssues(data.issues);
        }
        throw new Error(data.error || "Failed to create plan");
      }

      router.push(`/plan/${data.promptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-8">
          <h1 className="font-display text-5xl mb-2">
            What do you <span className="font-serif-italic">want</span> to
            create?
          </h1>
          <p className="text-foreground-muted">
            Describe your video in your own words. AI will turn it into a plan
            for review.
          </p>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., A launch video for our new voicemail feature. Show how Vocito handles missed calls automatically. Premium feel, like our last launch. 33 seconds."
              className="min-h-[160px] text-base"
              disabled={loading}
            />

            {/* Language selector */}
            <div className="flex items-center gap-2 mt-4">
              <span className="label-mono">LANGUAGE</span>
              <div className="flex items-center gap-1">
                {languages.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => setLanguage(lang.value)}
                    disabled={loading}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      language === lang.value
                        ? "bg-foreground text-background"
                        : "text-foreground-muted hover:text-foreground hover:bg-ui-elevated"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-xs text-foreground-subtle font-mono tabular-nums">
                {prompt.length} characters
              </p>
              <Button
                variant="accent"
                disabled={prompt.length < 10 || loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Create Plan
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive-subtle border border-destructive/30 text-sm text-destructive">
                {error}
              </div>
            )}

            {debugIssues && (
              <div className="mt-4 p-3 rounded-lg bg-ui border border-border">
                <p className="label-mono mb-2">VALIDATION ISSUES</p>
                <pre className="text-xs font-mono text-foreground-muted overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(debugIssues, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <p className="text-sm text-foreground-muted mb-3">
            Or try an example:
          </p>
          <div className="space-y-2">
            {examplePrompts.map((example, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(example.text);
                  setLanguage(example.lang);
                }}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-border-hover hover:bg-ui-elevated/50 transition-all text-sm text-foreground-muted hover:text-foreground disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span>{example.text}</span>
                  <span className="label-mono text-foreground-subtle">
                    {example.lang.toUpperCase()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
