"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, Loader2, Music, Volume2, Palette, Wand2,
  Play, Pause, Trash2, Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Favorite = {
  id: string;
  created_at: string;
  asset_type: string;
  provider: string;
  external_id: string | null;
  name: string;
  metadata: Record<string, any>;
  preview_url: string | null;
  usage_count: number;
  last_used_at: string;
};

type Tab = "music_track" | "sfx" | "visual_style" | "color_palette";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "music_track", label: "Music", icon: Music },
  { id: "sfx", label: "SFX", icon: Volume2 },
  { id: "visual_style", label: "Visual Styles", icon: Wand2 },
  { id: "color_palette", label: "Color Palettes", icon: Palette },
];

export default function FavoritesPage() {
  const [tab, setTab] = useState<Tab>("music_track");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addProvider, setAddProvider] = useState("epidemic_sound");
  const [addExternalId, setAddExternalId] = useState("");
  const [addMeta, setAddMeta] = useState("");
  const [addPreview, setAddPreview] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/favorites?type=${tab}`);
    const data = await res.json();
    setFavorites(data.favorites || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const removeFavorite = async (id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/favorites?id=${id}`, { method: "DELETE" });
  };

  const addFavorite = async () => {
    if (!addName.trim()) return;
    setAdding(true);
    let metadata = {};
    try { if (addMeta.trim()) metadata = JSON.parse(addMeta); } catch { /* ignore */ }

    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_type: tab,
        provider: addProvider,
        external_id: addExternalId || null,
        name: addName,
        metadata,
        preview_url: addPreview || null,
      }),
    });

    setAddName(""); setAddExternalId(""); setAddMeta(""); setAddPreview("");
    setShowAdd(false); setAdding(false);
    fetchFavorites();
  };

  const stopAudio = () => { audioRef.current?.pause(); setPlayingId(null); };

  const playUrl = (url: string, id: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    const a = new Audio(url); a.onended = () => setPlayingId(null); a.play();
    audioRef.current = a; setPlayingId(id);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium">Favorites</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Je gelikete assets worden automatisch als voorkeur gebruikt bij video generatie.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 transition-all"
        >
          <Plus className="h-4 w-4" /> Toevoegen
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const count = tab === t.id ? favorites.length : 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.id ? "border-accent text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl border border-border bg-ui p-5 space-y-3">
          <h3 className="text-sm font-medium">Nieuwe {tab.replace("_", " ")} favoriet</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Naam *</label>
              <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)}
                placeholder="Bijv: Cinematic Ambient Piano" className="editor-input w-full" />
            </div>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Provider</label>
              <select value={addProvider} onChange={(e) => setAddProvider(e.target.value)} className="editor-select w-full">
                <option value="epidemic_sound">Epidemic Sound</option>
                <option value="user_defined">Custom / User defined</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">External ID</label>
              <input type="text" value={addExternalId} onChange={(e) => setAddExternalId(e.target.value)}
                placeholder="ES track ID (optioneel)" className="editor-input w-full" />
            </div>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Preview URL</label>
              <input type="text" value={addPreview} onChange={(e) => setAddPreview(e.target.value)}
                placeholder="Audio preview URL (optioneel)" className="editor-input w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs text-foreground-muted block mb-1">
              Metadata (JSON — bijv: {tab === "music_track" ? '{"mood": "cinematic", "bpm": 120}' : tab === "color_palette" ? '{"accent": "#a78bff", "success": "#5eead4"}' : '{"style": "minimal"}'})
            </label>
            <input type="text" value={addMeta} onChange={(e) => setAddMeta(e.target.value)}
              placeholder="{}" className="editor-input w-full font-mono text-xs" />
          </div>
          <div className="flex gap-2">
            <button onClick={addFavorite} disabled={adding || !addName.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
              Opslaan
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg bg-ui-elevated border border-border text-sm text-foreground-muted">
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Favorites list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Laden...
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center text-foreground-subtle py-12">
          <Heart className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Geen {tab.replace("_", " ")} favorites.</p>
          <p className="text-xs mt-1">Klik "Toevoegen" om je eerste voorkeur op te slaan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((fav) => (
            <div key={fav.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-ui hover:border-accent/30 transition-all">
              {/* Play button (for music/sfx with preview) */}
              {fav.preview_url && (tab === "music_track" || tab === "sfx") ? (
                <button onClick={() => playUrl(fav.preview_url!, fav.id)}
                  className={cn("shrink-0 p-2.5 rounded-lg transition-all",
                    playingId === fav.id ? "bg-accent text-background" : "bg-ui-elevated border border-border"
                  )}>
                  {playingId === fav.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
              ) : (
                <div className="shrink-0 p-2.5 rounded-lg bg-ui-elevated border border-border">
                  <Heart className="h-4 w-4 text-accent fill-accent" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{fav.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px] text-foreground-subtle font-mono">{fav.provider}</span>
                  {fav.external_id && <span className="text-[10px] text-foreground-subtle font-mono">ID: {fav.external_id}</span>}
                  <span className="text-[10px] text-foreground-subtle">{fav.usage_count}x gebruikt</span>
                </div>
                {/* Metadata tags */}
                {Object.keys(fav.metadata || {}).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(fav.metadata).map(([k, v]) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                        {k}: {typeof v === "string" ? v : JSON.stringify(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Remove */}
              <button onClick={() => removeFavorite(fav.id)}
                className="shrink-0 p-2 rounded-lg text-foreground-subtle hover:text-destructive hover:bg-destructive-subtle transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
