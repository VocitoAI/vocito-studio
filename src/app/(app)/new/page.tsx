"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TEMPLATE_LIST } from "@/lib/templates/registry";

const examplePrompts = [
  {
    text: "Launch video voor onze nieuwe spam filter feature",
    lang: "nl" as const,
    template: "launch_v1",
  },
  {
    text: "Marketing video voor tandartspraktijken — Vocito beantwoordt gemiste calls automatisch",
    lang: "nl" as const,
    template: "marketing_niche",
  },
  {
    text: "Launch announcement for our voicemail-to-text feature, premium tone like Apple",
    lang: "en" as const,
    template: "launch_v1",
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
  const [template, setTemplate] = useState("universal");
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
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
        body: JSON.stringify({ rawPrompt: prompt, language, template, extraFields }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.issues) setDebugIssues(data.issues);
        throw new Error(data.error || "Failed to create plan");
      }

      router.push(`/plan/${data.promptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  };

  const selectedTemplateSpec = TEMPLATE_LIST.find(t => t.id === template);

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
            Pick a template, describe your video, and AI will turn it into a
            plan for review.
          </p>
        </div>

        {/* Template selector */}
        <div className="mb-6">
          <p className="label-mono mb-3">TEMPLATE</p>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATE_LIST.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTemplate(t.id);
                  setExtraFields({});
                }}
                disabled={loading}
                className={`p-4 rounded-lg border text-left transition-all ${
                  template === t.id
                    ? "border-accent bg-accent-subtle"
                    : "border-border hover:border-border-hover"
                }`}
              >
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {t.durationSeconds}s · {t.aspectRatio} · {t.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Template-specific extra fields */}
        {template === "marketing_niche" && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <p className="label-mono">NICHE DETAILS</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Niche</label>
                  <select
                    value={extraFields.niche || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, niche: e.target.value })}
                    className="editor-select"
                    disabled={loading}
                  >
                    <option value="">Select niche...</option>
                    <option value="dental">Dental practice</option>
                    <option value="real_estate">Real estate</option>
                    <option value="moving">Moving company</option>
                    <option value="clinic">Medical clinic</option>
                    <option value="legal">Legal office</option>
                    <option value="salon">Hair salon / beauty</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">CTA text</label>
                  <input
                    type="text"
                    value={extraFields.cta || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, cta: e.target.value })}
                    placeholder="Try free"
                    className="editor-input"
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {template === "testimonial" && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <p className="label-mono">CUSTOMER DETAILS</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Name</label>
                  <input
                    type="text"
                    value={extraFields.customerName || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, customerName: e.target.value })}
                    placeholder="Sarah"
                    className="editor-input"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Role</label>
                  <input
                    type="text"
                    value={extraFields.customerRole || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, customerRole: e.target.value })}
                    placeholder="Office manager"
                    className="editor-input"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Company</label>
                  <input
                    type="text"
                    value={extraFields.customerCompany || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, customerCompany: e.target.value })}
                    placeholder="Smile Practice"
                    className="editor-input"
                    disabled={loading}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {template === "ad_short" && (
          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <p className="label-mono">AD SETTINGS</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">CTA URL</label>
                  <input
                    type="text"
                    value={extraFields.cta_url || ""}
                    onChange={(e) => setExtraFields({ ...extraFields, cta_url: e.target.value })}
                    placeholder="https://vocito.ai/start"
                    className="editor-input"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="text-xs text-foreground-muted block mb-1">Urgency</label>
                  <select
                    value={extraFields.urgency_level || "medium"}
                    onChange={(e) => setExtraFields({ ...extraFields, urgency_level: e.target.value })}
                    className="editor-select"
                    disabled={loading}
                  >
                    <option value="soft">Soft</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="p-6">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                template === "ad_short"
                  ? "E.g., Vertical ad for TikTok — hook: missed calls cost you money. Fast, urgent."
                  : "E.g., A launch video for our new voicemail feature. Show how Vocito handles missed calls automatically. Premium feel."
              }
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
                        : "text-foreground-muted hover:text-foreground hover:bg-ui-elevated/50"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-xs text-foreground-subtle font-mono tabular-nums">
                {prompt.length} characters · {selectedTemplateSpec?.name} · {selectedTemplateSpec?.durationSeconds}s
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
                  setTemplate(example.template);
                }}
                disabled={loading}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-border-hover hover:bg-ui-elevated/50 transition-all text-sm text-foreground-muted hover:text-foreground disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span>{example.text}</span>
                  <span className="label-mono text-foreground-subtle">
                    {example.lang.toUpperCase()} · {example.template}
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
