"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, Loader2, Search, Play, Pause, Volume2, Fish, Mic2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Voice = {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
  cover_url: string | null;
  provider: "fish_audio" | "elevenlabs";
  tags: string[];
  // Fish-specific
  languages?: string[];
  task_count?: number;
  // ElevenLabs-specific
  gender?: string | null;
  accent?: string | null;
  age?: string | null;
  language?: string | null;
  category?: string;
  use_case?: string | null;
};

type Favorite = {
  id: string;
  provider: string;
  voice_id: string;
  name: string;
  preview_url: string | null;
  language: string | null;
  gender: string | null;
  accent: string | null;
  tags: string[] | null;
};

type Tab = "fish_audio" | "elevenlabs";

export default function VoicesPage() {
  const [tab, setTab] = useState<Tab>("fish_audio");
  const [fishVoices, setFishVoices] = useState<Voice[]>([]);
  const [elVoices, setElVoices] = useState<Voice[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoritesData, setFavoritesData] = useState<Favorite[]>([]);
  const [loadingFish, setLoadingFish] = useState(true);
  const [loadingEl, setLoadingEl] = useState(true);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    const res = await fetch("/api/voices/favorites");
    const data = await res.json();
    const favs: Favorite[] = data.favorites || [];
    setFavoritesData(favs);
    setFavorites(new Set(favs.map((f) => `${f.provider}:${f.voice_id}`)));
  }, []);

  // Fetch Fish Audio voices
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voices/fish");
        const data = await res.json();
        setFishVoices(data.voices || []);
      } catch { /* empty */ }
      setLoadingFish(false);
    })();
  }, []);

  // Fetch ElevenLabs voices
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/voices/elevenlabs");
        const data = await res.json();
        setElVoices(data.voices || []);
      } catch { /* empty */ }
      setLoadingEl(false);
    })();
  }, []);

  // Fetch favorites
  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const toggleFavorite = async (voice: Voice) => {
    const key = `${voice.provider}:${voice.voice_id}`;
    const wasFavorited = favorites.has(key);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      wasFavorited ? next.delete(key) : next.add(key);
      return next;
    });

    await fetch("/api/voices/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: voice.provider,
        voice_id: voice.voice_id,
        name: voice.name,
        preview_url: voice.preview_url,
        language: voice.language || voice.languages?.[0] || null,
        gender: voice.gender || null,
        accent: voice.accent || null,
        tags: voice.tags || [],
      }),
    });

    fetchFavorites();
  };

  const playPreview = (voice: Voice) => {
    if (!voice.preview_url) return;

    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
  };

  const currentVoices = tab === "fish_audio" ? fishVoices : elVoices;
  const isLoading = tab === "fish_audio" ? loadingFish : loadingEl;

  const filtered = currentVoices.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.tags.some((t) => String(t).toLowerCase().includes(q))
    );
  });

  // Sort: favorites first
  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.has(`${a.provider}:${a.voice_id}`) ? 0 : 1;
    const bFav = favorites.has(`${b.provider}:${b.voice_id}`) ? 0 : 1;
    return aFav - bFav;
  });

  const favCount = (provider: Tab) =>
    [...favorites].filter((k) => k.startsWith(provider)).length;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Voices</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Blader door stemmen en like je favorieten. Het systeem pakt automatisch je voorkeursstemmen bij generatie.
        </p>
      </div>

      {/* Favorites summary */}
      {favorites.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-subtle border border-accent/20">
          <Heart className="h-4 w-4 text-accent fill-accent" />
          <span className="text-xs font-mono text-accent">
            {favorites.size} stem{favorites.size !== 1 ? "men" : ""} geliked
          </span>
          <span className="text-xs text-foreground-muted ml-2">
            Fish: {favCount("fish_audio")} · ElevenLabs: {favCount("elevenlabs")}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setTab("fish_audio")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "fish_audio"
              ? "border-accent text-foreground"
              : "border-transparent text-foreground-muted hover:text-foreground"
          )}
        >
          <Fish className="h-4 w-4" />
          Fish Audio
          {favCount("fish_audio") > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
              {favCount("fish_audio")}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("elevenlabs")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "elevenlabs"
              ? "border-accent text-foreground"
              : "border-transparent text-foreground-muted hover:text-foreground"
          )}
        >
          <Mic2 className="h-4 w-4" />
          ElevenLabs
          {favCount("elevenlabs") > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
              {favCount("elevenlabs")}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Zoek ${tab === "fish_audio" ? "Fish Audio" : "ElevenLabs"} stemmen...`}
          className="editor-input pl-9"
        />
      </div>

      {/* Voice grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Stemmen laden...
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center text-foreground-subtle py-12">
          <p>Geen stemmen gevonden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((voice) => {
            const isFav = favorites.has(`${voice.provider}:${voice.voice_id}`);
            const isPlaying = playingId === voice.voice_id;

            return (
              <div
                key={voice.voice_id}
                className={cn(
                  "relative rounded-xl border p-4 transition-all hover:border-accent/40",
                  isFav
                    ? "border-accent/30 bg-accent-subtle/30"
                    : "border-border bg-ui"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{voice.name}</h3>
                    {voice.description && (
                      <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
                        {voice.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFavorite(voice)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-ui-elevated transition-colors"
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isFav ? "text-red-500 fill-red-500" : "text-foreground-subtle"
                      )}
                    />
                  </button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {voice.gender && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {voice.gender}
                    </span>
                  )}
                  {voice.accent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {voice.accent}
                    </span>
                  )}
                  {voice.language && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {voice.language}
                    </span>
                  )}
                  {voice.languages?.slice(0, 3).map((lang) => (
                    <span key={lang} className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {lang}
                    </span>
                  ))}
                  {voice.use_case && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {voice.use_case}
                    </span>
                  )}
                  {voice.task_count != null && voice.task_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
                      {voice.task_count.toLocaleString()} uses
                    </span>
                  )}
                </div>

                {/* Preview button */}
                {voice.preview_url && (
                  <button
                    onClick={() => playPreview(voice)}
                    className={cn(
                      "mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all",
                      isPlaying
                        ? "bg-accent text-background"
                        : "bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted"
                    )}
                  >
                    {isPlaying ? (
                      <><Pause className="h-3 w-3" /> Afspelen...</>
                    ) : (
                      <><Play className="h-3 w-3" /> Preview</>
                    )}
                  </button>
                )}

                {/* Voice ID */}
                <p className="text-[10px] text-foreground-subtle font-mono mt-2 truncate">
                  {voice.voice_id}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
