"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HealthChecks {
  database: boolean;
  anthropic: boolean;
  fish_audio: boolean;
  epidemic_sound: boolean;
  worker: boolean;
}

interface SettingsContentProps {
  checks: HealthChecks;
}

const integrations = [
  { key: "anthropic" as const, label: "Anthropic Claude" },
  { key: "fish_audio" as const, label: "Fish Audio" },
  { key: "epidemic_sound" as const, label: "Epidemic Sound" },
  { key: "database" as const, label: "Supabase" },
  { key: "worker" as const, label: "Railway Worker" },
];

export function SettingsContent({ checks }: SettingsContentProps) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-8">
          <h1 className="font-display text-5xl mb-2">Settings</h1>
          <p className="text-foreground-muted">
            Configure Studio and your workflow preferences.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>
                Your Vocito workspace identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Brand name
                </label>
                <Input defaultValue="Vocito" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Default language
                </label>
                <Input defaultValue="English" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Integrations</CardTitle>
              <CardDescription>
                Live status of external services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm">
              {integrations.map((item, i) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-2 ${
                    i < integrations.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <span className="text-foreground-muted">{item.label}</span>
                  <span
                    className={
                      checks[item.key] ? "text-success" : "text-destructive"
                    }
                  >
                    {checks[item.key] ? "Connected" : "Disconnected"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" size="sm">
                Clear all generated videos
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
