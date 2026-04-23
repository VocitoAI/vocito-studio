"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const examplePrompts = [
  "Launch video voor onze nieuwe spam filter feature",
  "Marketing video voor tandartspraktijken",
  "Testimonial-stijl video voor makelaars",
];

export default function NewVideoPage() {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    // Komt in Brief B — backend integratie
    console.log("Submit:", prompt);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
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
              placeholder="E.g., A launch video for our new voicemail feature. Show how Vocito handles missed calls automatically. Premium feel, like our last launch. 30 seconds, English."
              className="min-h-[160px] text-base"
            />
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-xs text-foreground-subtle font-mono">
                {prompt.length} characters
              </p>
              <Button
                variant="accent"
                disabled={prompt.length < 10}
                onClick={handleSubmit}
              >
                <Sparkles className="h-4 w-4" />
                Create Plan
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
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
                onClick={() => setPrompt(example)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-border-hover hover:bg-ui-elevated/50 transition-all text-sm text-foreground-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
