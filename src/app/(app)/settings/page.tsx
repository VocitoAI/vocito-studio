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

export default function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-8">
          <h1 className="font-serif-italic text-4xl mb-2">Settings</h1>
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
                Status of external services.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground-muted">Anthropic Claude</span>
                <span className="text-success">Connected</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground-muted">Fish Audio</span>
                <span className="text-success">Connected</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground-muted">Epidemic Sound</span>
                <span className="text-success">Connected</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-foreground-muted">Supabase</span>
                <span className="text-foreground-subtle">
                  Pending (brief A3)
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-foreground-muted">Remotion</span>
                <span className="text-foreground-subtle">
                  Pending (brief A3)
                </span>
              </div>
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
