"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, Loader2, Search, Play, Pause, Fish, Mic2,
  Send, Wand2, Upload, X, Check, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
type Voice = {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
  cover_url: string | null;
  provider: "fish_audio" | "elevenlabs";
  tags: string[];
  languages?: string[];
  task_count?: number;
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

type ProviderTab = "fish_audio" | "elevenlabs";
type ToolTab = "browse" | "tts" | "design" | "clone";

type DesignPreview = {
  generated_voice_id: string;
  audio_base64: string;
  media_type: string;
  duration_secs: number;
};

/* ─── Component ─── */
export default function VoicesPage() {
  // Provider & tool tabs
  const [providerTab, setProviderTab] = useState<ProviderTab>("fish_audio");
  const [toolTab, setToolTab] = useState<ToolTab>("browse");

  // Voice lists
  const [fishVoices, setFishVoices] = useState<Voice[]>([]);
  const [elVoices, setElVoices] = useState<Voice[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loadingFish, setLoadingFish] = useState(true);
  const [loadingEl, setLoadingEl] = useState(true);
  const [search, setSearch] = useState("");

  // Audio playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // TTS tool
  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);

  // Voice Design tool
  const [designDesc, setDesignDesc] = useState("");
  const [designPreviewText, setDesignPreviewText] = useState("");
  const [designLoading, setDesignLoading] = useState(false);
  const [designPreviews, setDesignPreviews] = useState<DesignPreview[]>([]);
  const [designSaving, setDesignSaving] = useState(false);
  const [designSaveName, setDesignSaveName] = useState("");

  // Clone tool
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneResult, setCloneResult] = useState<string | null>(null);

  /* ─── Data fetching ─── */
  const fetchFavorites = useCallback(async () => {
    const res = await fetch("/api/voices/favorites");
    const data = await res.json();
    const favs: Favorite[] = data.favorites || [];
    setFavorites(new Set(favs.map((f) => `${f.provider}:${f.voice_id}`)));
  }, []);

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

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  /* ─── Actions ─── */
  const toggleFavorite = async (voice: Voice) => {
    const key = `${voice.provider}:${voice.voice_id}`;
    const wasFav = favorites.has(key);
    setFavorites((prev) => {
      const next = new Set(prev);
      wasFav ? next.delete(key) : next.add(key);
      return next;
    });
    await fetch("/api/voices/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: voice.provider, voice_id: voice.voice_id, name: voice.name,
        preview_url: voice.preview_url,
        language: voice.language || voice.languages?.[0] || null,
        gender: voice.gender || null, accent: voice.accent || null,
        tags: voice.tags || [],
      }),
    });
    fetchFavorites();
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  const playAudioUrl = (url: string, id: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(id);
  };

  const playBase64 = (base64: string, id: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(id);
  };

  /* ─── TTS ─── */
  const handleTts = async () => {
    if (!ttsText.trim() || !ttsVoiceId) return;
    setTtsLoading(true);
    setTtsAudio(null);
    try {
      const res = await fetch("/api/voices/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voice_id: ttsVoiceId, provider: providerTab }),
      });
      const data = await res.json();
      if (data.audio_base64) {
        setTtsAudio(data.audio_base64);
        playBase64(data.audio_base64, "tts-result");
      }
    } catch { /* empty */ }
    setTtsLoading(false);
  };

  /* ─── Voice Design ─── */
  const handleDesignPreview = async () => {
    if (designDesc.length < 20) return;
    setDesignLoading(true);
    setDesignPreviews([]);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          voice_description: designDesc,
          preview_text: designPreviewText || undefined,
        }),
      });
      const data = await res.json();
      setDesignPreviews(data.previews || []);
    } catch { /* empty */ }
    setDesignLoading(false);
  };

  const handleDesignSave = async (generatedId: string) => {
    if (!designSaveName.trim()) return;
    setDesignSaving(true);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          generated_voice_id: generatedId,
          voice_name: designSaveName,
          voice_description_label: designDesc,
        }),
      });
      const data = await res.json();
      if (data.voice_id) {
        // Refresh ElevenLabs voices
        const voicesRes = await fetch("/api/voices/elevenlabs");
        const voicesData = await voicesRes.json();
        setElVoices(voicesData.voices || []);
        setDesignPreviews([]);
        setDesignDesc("");
        setDesignSaveName("");
      }
    } catch { /* empty */ }
    setDesignSaving(false);
  };

  /* ─── Clone ─── */
  const handleClone = async () => {
    if (!cloneName.trim() || cloneFiles.length === 0) return;
    setCloneLoading(true);
    setCloneResult(null);
    try {
      const form = new FormData();
      form.append("name", cloneName);
      if (cloneDesc) form.append("description", cloneDesc);
      for (const f of cloneFiles) form.append("files", f);

      const res = await fetch("/api/voices/clone", { method: "POST", body: form });
      const data = await res.json();
      if (data.voice_id) {
        setCloneResult(data.voice_id);
        // Refresh ElevenLabs voices
        const voicesRes = await fetch("/api/voices/elevenlabs");
        const voicesData = await voicesRes.json();
        setElVoices(voicesData.voices || []);
        setCloneName("");
        setCloneDesc("");
        setCloneFiles([]);
      }
    } catch { /* empty */ }
    setCloneLoading(false);
  };

  /* ─── Filtered & sorted voices ─── */
  const currentVoices = providerTab === "fish_audio" ? fishVoices : elVoices;
  const isLoading = providerTab === "fish_audio" ? loadingFish : loadingEl;

  const filtered = currentVoices.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) ||
      v.tags.some((t) => String(t).toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    const aFav = favorites.has(`${a.provider}:${a.voice_id}`) ? 0 : 1;
    const bFav = favorites.has(`${b.provider}:${b.voice_id}`) ? 0 : 1;
    return aFav - bFav;
  });

  const favCount = (p: ProviderTab) => [...favorites].filter((k) => k.startsWith(p)).length;

  const allVoicesFlat = [...fishVoices, ...elVoices];

  /* ─── Render ─── */
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Voices</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Browse, test, design en clone stemmen. Favorieten worden automatisch gebruikt bij video generatie.
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

      {/* Provider tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setProviderTab("fish_audio")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            providerTab === "fish_audio" ? "border-accent text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
          )}
        >
          <Fish className="h-4 w-4" /> Fish Audio
          {favCount("fish_audio") > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">{favCount("fish_audio")}</span>}
        </button>
        <button
          onClick={() => setProviderTab("elevenlabs")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            providerTab === "elevenlabs" ? "border-accent text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
          )}
        >
          <Mic2 className="h-4 w-4" /> ElevenLabs
          {favCount("elevenlabs") > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">{favCount("elevenlabs")}</span>}
        </button>
      </div>

      {/* Tool tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { id: "browse", label: "Browse", icon: Search },
            { id: "tts", label: "TTS Test", icon: Volume2 },
            ...(providerTab === "elevenlabs"
              ? [
                  { id: "design", label: "Voice Design", icon: Wand2 },
                  { id: "clone", label: "Voice Clone", icon: Upload },
                ]
              : []),
          ] as { id: ToolTab; label: string; icon: any }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setToolTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              toolTab === t.id
                ? "bg-accent text-background"
                : "bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted"
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ BROWSE TAB ═══ */}
      {toolTab === "browse" && (
        <>
          <div className="relative max-w-[400px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Zoek ${providerTab === "fish_audio" ? "Fish Audio" : "ElevenLabs"} stemmen...`}
              className="editor-input pl-9"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-foreground-muted py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Stemmen laden...
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-foreground-subtle py-12">Geen stemmen gevonden.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((voice) => (
                <VoiceCard
                  key={voice.voice_id}
                  voice={voice}
                  isFav={favorites.has(`${voice.provider}:${voice.voice_id}`)}
                  isPlaying={playingId === voice.voice_id}
                  onToggleFav={() => toggleFavorite(voice)}
                  onPlay={() => voice.preview_url && playAudioUrl(voice.preview_url, voice.voice_id)}
                  onSelectForTts={() => { setTtsVoiceId(voice.voice_id); setToolTab("tts"); }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TTS TEST TAB ═══ */}
      {toolTab === "tts" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Text-to-Speech Test</h3>
            <p className="text-xs text-foreground-muted">
              Typ tekst en kies een stem om te horen hoe het klinkt. Werkt met {providerTab === "fish_audio" ? "Fish Audio" : "ElevenLabs"}.
            </p>

            {/* Voice selector */}
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Stem</label>
              <select
                value={ttsVoiceId}
                onChange={(e) => setTtsVoiceId(e.target.value)}
                className="editor-select w-full"
              >
                <option value="">Kies een stem...</option>
                {currentVoices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} {favorites.has(`${v.provider}:${v.voice_id}`) ? "❤️" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Text input */}
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Tekst (max 500 tekens)</label>
              <textarea
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Typ hier je tekst..."
                className="editor-input w-full resize-none"
              />
              <span className="text-[10px] text-foreground-subtle">{ttsText.length}/500</span>
            </div>

            <button
              onClick={handleTts}
              disabled={ttsLoading || !ttsText.trim() || !ttsVoiceId}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {ttsLoading ? "Generating..." : "Generate Audio"}
            </button>

            {/* TTS Result */}
            {ttsAudio && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-ui-elevated border border-border">
                <button
                  onClick={() => playBase64(ttsAudio, "tts-result")}
                  className="shrink-0 p-2 rounded-lg bg-accent text-background"
                >
                  {playingId === "tts-result" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <p className="text-xs font-medium">TTS Result</p>
                  <p className="text-[10px] text-foreground-muted">{providerTab} · {ttsVoiceId.slice(0, 12)}...</p>
                </div>
                <a
                  href={`data:audio/mpeg;base64,${ttsAudio}`}
                  download="tts-preview.mp3"
                  className="text-[10px] text-accent hover:underline"
                >
                  Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ VOICE DESIGN TAB ═══ */}
      {toolTab === "design" && providerTab === "elevenlabs" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Voice Design</h3>
            <p className="text-xs text-foreground-muted">
              Beschrijf hoe je stem moet klinken en ElevenLabs genereert 3 opties. Kies je favoriet en sla op.
            </p>

            <div>
              <label className="text-xs text-foreground-muted block mb-1">Stembeschrijving (min 20 tekens)</label>
              <textarea
                value={designDesc}
                onChange={(e) => setDesignDesc(e.target.value)}
                rows={3}
                placeholder="Bijv: A warm, deep male voice with a slight Dutch accent. Calm and professional, suitable for narration..."
                className="editor-input w-full resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-foreground-muted block mb-1">Preview tekst (optioneel)</label>
              <input
                type="text"
                value={designPreviewText}
                onChange={(e) => setDesignPreviewText(e.target.value)}
                placeholder="Tekst die de stem uitspreekt..."
                className="editor-input w-full"
              />
            </div>

            <button
              onClick={handleDesignPreview}
              disabled={designLoading || designDesc.length < 20}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              {designLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {designLoading ? "Generating 3 previews..." : "Generate Previews"}
            </button>

            {/* Design previews */}
            {designPreviews.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-medium">Kies een stem:</p>
                {designPreviews.map((preview, idx) => (
                  <div key={preview.generated_voice_id} className="flex items-center gap-3 p-3 rounded-lg bg-ui-elevated border border-border">
                    <button
                      onClick={() => playBase64(preview.audio_base64, `design-${idx}`)}
                      className="shrink-0 p-2 rounded-lg bg-accent/20 text-accent"
                    >
                      {playingId === `design-${idx}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <div className="flex-1">
                      <p className="text-xs font-medium">Optie {idx + 1}</p>
                      <p className="text-[10px] text-foreground-muted">{preview.duration_secs?.toFixed(1)}s</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Naam..."
                        value={designSaveName}
                        onChange={(e) => setDesignSaveName(e.target.value)}
                        className="editor-input w-28 h-7 text-xs"
                      />
                      <button
                        onClick={() => handleDesignSave(preview.generated_voice_id)}
                        disabled={designSaving || !designSaveName.trim()}
                        className="shrink-0 p-1.5 rounded-lg bg-accent text-background disabled:opacity-50"
                      >
                        {designSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CLONE TAB ═══ */}
      {toolTab === "clone" && providerTab === "elevenlabs" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Instant Voice Clone</h3>
            <p className="text-xs text-foreground-muted">
              Upload audio (MP3/WAV/M4A) om een stem te clonen via ElevenLabs. Min 30 seconden aanbevolen.
            </p>

            <div>
              <label className="text-xs text-foreground-muted block mb-1">Naam</label>
              <input
                type="text" value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Naam van de stem..."
                className="editor-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-foreground-muted block mb-1">Beschrijving (optioneel)</label>
              <input
                type="text" value={cloneDesc}
                onChange={(e) => setCloneDesc(e.target.value)}
                placeholder="Bijv: CEO voice for marketing videos..."
                className="editor-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-foreground-muted block mb-1">Audio bestanden</label>
              <div className="border border-dashed border-border rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => setCloneFiles(Array.from(e.target.files || []))}
                  className="hidden"
                  id="clone-upload"
                />
                <label htmlFor="clone-upload" className="cursor-pointer">
                  <Upload className="h-6 w-6 mx-auto text-foreground-subtle mb-2" />
                  <p className="text-xs text-foreground-muted">Klik om audio te uploaden</p>
                  <p className="text-[10px] text-foreground-subtle">MP3, WAV, M4A · max 50MB totaal</p>
                </label>
              </div>
              {cloneFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {cloneFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-foreground-muted">
                      <Volume2 className="h-3 w-3" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-foreground-subtle">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button onClick={() => setCloneFiles((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3 text-foreground-subtle hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleClone}
              disabled={cloneLoading || !cloneName.trim() || cloneFiles.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
            >
              {cloneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {cloneLoading ? "Cloning..." : "Clone Voice"}
            </button>

            {cloneResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-subtle border border-accent/20">
                <Check className="h-4 w-4 text-accent" />
                <span className="text-xs text-accent">Voice gecloned! ID: {cloneResult}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Voice Card Component ─── */
function VoiceCard({
  voice, isFav, isPlaying, onToggleFav, onPlay, onSelectForTts,
}: {
  voice: Voice; isFav: boolean; isPlaying: boolean;
  onToggleFav: () => void; onPlay: () => void; onSelectForTts: () => void;
}) {
  return (
    <div className={cn(
      "relative rounded-xl border p-4 transition-all hover:border-accent/40",
      isFav ? "border-accent/30 bg-accent-subtle/30" : "border-border bg-ui"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate">{voice.name}</h3>
          {voice.description && (
            <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{voice.description}</p>
          )}
        </div>
        <button onClick={onToggleFav} className="shrink-0 p-1.5 rounded-lg hover:bg-ui-elevated transition-colors">
          <Heart className={cn("h-4 w-4 transition-colors", isFav ? "text-red-500 fill-red-500" : "text-foreground-subtle")} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mt-3">
        {voice.gender && <Tag>{voice.gender}</Tag>}
        {voice.accent && <Tag>{voice.accent}</Tag>}
        {voice.language && <Tag>{voice.language}</Tag>}
        {voice.languages?.slice(0, 3).map((l) => <Tag key={l}>{l}</Tag>)}
        {voice.use_case && <Tag>{voice.use_case}</Tag>}
        {voice.task_count != null && voice.task_count > 0 && <Tag>{voice.task_count.toLocaleString()} uses</Tag>}
      </div>

      <div className="flex gap-2 mt-3">
        {voice.preview_url && (
          <button
            onClick={onPlay}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all",
              isPlaying ? "bg-accent text-background" : "bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted"
            )}
          >
            {isPlaying ? <><Pause className="h-3 w-3" /> Afspelen...</> : <><Play className="h-3 w-3" /> Preview</>}
          </button>
        )}
        <button
          onClick={onSelectForTts}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted transition-all"
        >
          <Send className="h-3 w-3" /> TTS
        </button>
      </div>

      <p className="text-[10px] text-foreground-subtle font-mono mt-2 truncate">{voice.voice_id}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-elevated border border-border font-mono">
      {children}
    </span>
  );
}
