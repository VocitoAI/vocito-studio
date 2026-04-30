"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart, Loader2, Search, Play, Pause, Fish, Mic2,
  Send, Wand2, Upload, X, Check, Volume2, ChevronDown, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
type Voice = {
  voice_id: string;
  name: string;
  description: string;
  preview_url: string | null;
  cover_url?: string | null;
  image_url?: string | null;
  provider: "fish_audio" | "elevenlabs";
  // Fish
  languages?: string[];
  tags?: string[];
  task_count?: number;
  like_count?: number;
  author_name?: string | null;
  // ElevenLabs
  gender?: string | null;
  accent?: string | null;
  age?: string | null;
  language?: string | null;
  category?: string;
  use_case?: string | null;
  usage_count_1y?: number;
  cloned_by_count?: number;
  featured?: boolean;
  free_users_allowed?: boolean;
  public_owner_id?: string;
  is_own?: boolean;
};

type ProviderTab = "fish_audio" | "elevenlabs";
type ToolTab = "browse" | "tts" | "design" | "clone";

type DesignPreview = {
  generated_voice_id: string;
  audio_base64: string;
  media_type: string;
  duration_secs: number;
};

/* ─── Fish Audio Filters ─── */
const FISH_LANGUAGES = [
  { value: "", label: "Alle talen" },
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
  { value: "ru", label: "Русский" },
  { value: "hi", label: "हिन्दी" },
  { value: "tr", label: "Türkçe" },
  { value: "pl", label: "Polski" },
];

const FISH_SORT = [
  { value: "task_count", label: "Most used" },
  { value: "like_count", label: "Most liked" },
  { value: "created_at", label: "Newest" },
];

/* ─── ElevenLabs Filters ─── */
const EL_LANGUAGES = [
  { value: "", label: "Alle talen" },
  { value: "en", label: "English" },
  { value: "nl", label: "Dutch" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
  { value: "hi", label: "Hindi" },
  { value: "pl", label: "Polish" },
  { value: "tr", label: "Turkish" },
  { value: "sv", label: "Swedish" },
];

const EL_GENDERS = [
  { value: "", label: "Alle" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "neutral", label: "Neutral" },
];

const EL_AGES = [
  { value: "", label: "Alle" },
  { value: "young", label: "Young" },
  { value: "middle_aged", label: "Middle aged" },
  { value: "old", label: "Old" },
];

const EL_USE_CASES = [
  { value: "", label: "Alle" },
  { value: "conversational", label: "Conversational" },
  { value: "narration", label: "Narration" },
  { value: "news", label: "News" },
  { value: "characters", label: "Characters" },
  { value: "social_media", label: "Social media" },
  { value: "meditation", label: "Meditation" },
  { value: "audiobook", label: "Audiobook" },
  { value: "asmr", label: "ASMR" },
];

const EL_SORT = [
  { value: "usage_character_count_1y", label: "Most used" },
  { value: "cloned_by_count", label: "Most cloned" },
  { value: "trending", label: "Trending" },
  { value: "created_date", label: "Newest" },
];

const EL_CATEGORIES = [
  { value: "", label: "Alle" },
  { value: "professional", label: "Professional" },
  { value: "high_quality", label: "High quality" },
  { value: "generated", label: "Generated" },
];

/* ─── Component ─── */
export default function VoicesPage() {
  const [providerTab, setProviderTab] = useState<ProviderTab>("fish_audio");
  const [toolTab, setToolTab] = useState<ToolTab>("browse");

  // Voices
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Favorites
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Audio
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fish filters
  const [fishLang, setFishLang] = useState("");
  const [fishSort, setFishSort] = useState("task_count");
  const [fishTag, setFishTag] = useState("");
  const [fishSearch, setFishSearch] = useState("");

  // ElevenLabs filters
  const [elMode, setElMode] = useState<"library" | "my">("library");
  const [elLang, setElLang] = useState("");
  const [elGender, setElGender] = useState("");
  const [elAge, setElAge] = useState("");
  const [elUseCase, setElUseCase] = useState("");
  const [elCategory, setElCategory] = useState("");
  const [elSort, setElSort] = useState("usage_character_count_1y");
  const [elSearch, setElSearch] = useState("");

  // TTS
  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState("");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<string | null>(null);

  // Voice Design
  const [designDesc, setDesignDesc] = useState("");
  const [designPreviewText, setDesignPreviewText] = useState("");
  const [designLoading, setDesignLoading] = useState(false);
  const [designPreviews, setDesignPreviews] = useState<DesignPreview[]>([]);
  const [designSaving, setDesignSaving] = useState(false);
  const [designSaveName, setDesignSaveName] = useState("");

  // Clone
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneResult, setCloneResult] = useState<string | null>(null);

  /* ─── Fetch voices ─── */
  const fetchVoices = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      let url: string;
      if (providerTab === "fish_audio") {
        const qs = new URLSearchParams({
          page_size: "40",
          page_number: String(pageNum),
          sort_by: fishSort,
        });
        if (fishLang) qs.set("language", fishLang);
        if (fishTag) qs.set("tag", fishTag);
        if (fishSearch) qs.set("title", fishSearch);
        url = `/api/voices/fish?${qs}`;
      } else {
        const qs = new URLSearchParams({
          mode: elMode,
          page_size: "40",
          sort: elSort,
        });
        if (elMode === "library") {
          if (elLang) qs.set("language", elLang);
          if (elGender) qs.set("gender", elGender);
          if (elAge) qs.set("age", elAge);
          if (elUseCase) qs.set("use_case", elUseCase);
          if (elCategory) qs.set("category", elCategory);
          if (elSearch) qs.set("search", elSearch);
          if (pageNum > 1) qs.set("page", String(pageNum));
        }
        url = `/api/voices/elevenlabs?${qs}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const newVoices = data.voices || [];

      if (append) {
        setVoices((prev) => [...prev, ...newVoices]);
      } else {
        setVoices(newVoices);
      }
      setTotal(data.total || 0);
      setHasMore(data.has_more ?? false);
    } catch { /* empty */ }
    setLoading(false);
  }, [providerTab, fishLang, fishSort, fishTag, fishSearch, elMode, elLang, elGender, elAge, elUseCase, elCategory, elSort, elSearch]);

  // Reset + fetch on filter/tab change
  useEffect(() => {
    setPage(1);
    setVoices([]);
    fetchVoices(1);
  }, [fetchVoices]);

  // Fetch favorites
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/voices/favorites");
      const data = await res.json();
      setFavorites(new Set((data.favorites || []).map((f: any) => `${f.provider}:${f.voice_id}`)));
    })();
  }, []);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchVoices(next, true);
  };

  /* ─── Actions ─── */
  const toggleFavorite = async (voice: Voice) => {
    const key = `${voice.provider}:${voice.voice_id}`;
    const wasFav = favorites.has(key);
    setFavorites((prev) => { const n = new Set(prev); wasFav ? n.delete(key) : n.add(key); return n; });
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
    // Refetch favorites
    const res = await fetch("/api/voices/favorites");
    const data = await res.json();
    setFavorites(new Set((data.favorites || []).map((f: any) => `${f.provider}:${f.voice_id}`)));
  };

  const stopAudio = () => { audioRef.current?.pause(); setPlayingId(null); };

  const playUrl = (url: string, id: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    const a = new Audio(url); a.onended = () => setPlayingId(null); a.play();
    audioRef.current = a; setPlayingId(id);
  };

  const playB64 = (b64: string, id: string) => {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    const a = new Audio(`data:audio/mpeg;base64,${b64}`); a.onended = () => setPlayingId(null); a.play();
    audioRef.current = a; setPlayingId(id);
  };

  /* ─── TTS ─── */
  const handleTts = async () => {
    if (!ttsText.trim() || !ttsVoiceId) return;
    setTtsLoading(true); setTtsAudio(null);
    try {
      const res = await fetch("/api/voices/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voice_id: ttsVoiceId, provider: providerTab }),
      });
      const data = await res.json();
      if (data.audio_base64) { setTtsAudio(data.audio_base64); playB64(data.audio_base64, "tts"); }
    } catch { /* empty */ }
    setTtsLoading(false);
  };

  /* ─── Voice Design ─── */
  const handleDesignPreview = async () => {
    if (designDesc.length < 20) return;
    setDesignLoading(true); setDesignPreviews([]);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", voice_description: designDesc, preview_text: designPreviewText || undefined }),
      });
      const data = await res.json();
      setDesignPreviews(data.previews || []);
    } catch { /* empty */ }
    setDesignLoading(false);
  };

  const handleDesignSave = async (id: string) => {
    if (!designSaveName.trim()) return;
    setDesignSaving(true);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", generated_voice_id: id, voice_name: designSaveName, voice_description_label: designDesc }),
      });
      if ((await res.json()).voice_id) {
        setDesignPreviews([]); setDesignDesc(""); setDesignSaveName("");
        fetchVoices(1);
      }
    } catch { /* empty */ }
    setDesignSaving(false);
  };

  /* ─── Clone ─── */
  const handleClone = async () => {
    if (!cloneName.trim() || cloneFiles.length === 0) return;
    setCloneLoading(true); setCloneResult(null);
    try {
      const form = new FormData();
      form.append("name", cloneName);
      if (cloneDesc) form.append("description", cloneDesc);
      for (const f of cloneFiles) form.append("files", f);
      const res = await fetch("/api/voices/clone", { method: "POST", body: form });
      const data = await res.json();
      if (data.voice_id) {
        setCloneResult(data.voice_id); setCloneName(""); setCloneDesc(""); setCloneFiles([]);
        fetchVoices(1);
      }
    } catch { /* empty */ }
    setCloneLoading(false);
  };

  const favCount = (p: ProviderTab) => [...favorites].filter((k) => k.startsWith(p)).length;

  const formatNum = (n: number) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  /* ─── Render ─── */
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-medium">Voices</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Browse, test, design en clone stemmen. Favorieten worden automatisch gebruikt bij generatie.
        </p>
      </div>

      {/* Favorites */}
      {favorites.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-subtle border border-accent/20">
          <Heart className="h-4 w-4 text-accent fill-accent" />
          <span className="text-xs font-mono text-accent">{favorites.size} geliked</span>
          <span className="text-xs text-foreground-muted ml-2">Fish: {favCount("fish_audio")} · EL: {favCount("elevenlabs")}</span>
        </div>
      )}

      {/* Provider tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([["fish_audio", "Fish Audio", Fish], ["elevenlabs", "ElevenLabs", Mic2]] as [ProviderTab, string, any][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => { setProviderTab(id); setToolTab("browse"); }}
            className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              providerTab === id ? "border-accent text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
            )}>
            <Icon className="h-4 w-4" /> {label}
            {favCount(id) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-mono">{favCount(id)}</span>}
          </button>
        ))}
      </div>

      {/* Tool tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "browse" as ToolTab, label: "Browse", icon: Search },
          { id: "tts" as ToolTab, label: "TTS Test", icon: Volume2 },
          ...(providerTab === "elevenlabs" ? [
            { id: "design" as ToolTab, label: "Voice Design", icon: Wand2 },
            { id: "clone" as ToolTab, label: "Voice Clone", icon: Upload },
          ] : []),
        ]).map((t) => (
          <button key={t.id} onClick={() => setToolTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              toolTab === t.id ? "bg-accent text-background" : "bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted"
            )}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ BROWSE ═══ */}
      {toolTab === "browse" && (
        <>
          {/* Filters */}
          {providerTab === "fish_audio" ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-subtle" />
                <input type="text" value={fishSearch} onChange={(e) => setFishSearch(e.target.value)}
                  placeholder="Zoek op naam..." className="editor-input pl-9 h-8 text-xs" />
              </div>
              <Select value={fishLang} onChange={setFishLang} options={FISH_LANGUAGES} />
              <Select value={fishSort} onChange={setFishSort} options={FISH_SORT} />
              <input type="text" value={fishTag} onChange={(e) => setFishTag(e.target.value)}
                placeholder="Tag filter..." className="editor-input h-8 text-xs w-28" />
              <span className="text-[10px] text-foreground-subtle font-mono ml-auto">{formatNum(total)} stemmen</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {/* My voices / Library toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button onClick={() => setElMode("library")}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors", elMode === "library" ? "bg-accent text-background" : "bg-ui text-foreground-muted")}>
                  Library
                </button>
                <button onClick={() => setElMode("my")}
                  className={cn("px-3 py-1.5 text-xs font-medium transition-colors", elMode === "my" ? "bg-accent text-background" : "bg-ui text-foreground-muted")}>
                  My voices
                </button>
              </div>
              {elMode === "library" && (
                <>
                  <div className="relative flex-1 min-w-[150px] max-w-[250px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-subtle" />
                    <input type="text" value={elSearch} onChange={(e) => setElSearch(e.target.value)}
                      placeholder="Zoek..." className="editor-input pl-9 h-8 text-xs" />
                  </div>
                  <Select value={elLang} onChange={setElLang} options={EL_LANGUAGES} />
                  <Select value={elGender} onChange={setElGender} options={EL_GENDERS} label="Gender" />
                  <Select value={elAge} onChange={setElAge} options={EL_AGES} label="Age" />
                  <Select value={elUseCase} onChange={setElUseCase} options={EL_USE_CASES} label="Use case" />
                  <Select value={elCategory} onChange={setElCategory} options={EL_CATEGORIES} label="Category" />
                  <Select value={elSort} onChange={(v) => setElSort(v)} options={EL_SORT} />
                </>
              )}
              <span className="text-[10px] text-foreground-subtle font-mono ml-auto">{formatNum(total)} stemmen</span>
            </div>
          )}

          {/* Voice grid */}
          {loading && voices.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-foreground-muted py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Laden...
            </div>
          ) : voices.length === 0 ? (
            <div className="text-center text-foreground-subtle py-12">Geen stemmen gevonden.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {voices.map((v) => (
                  <VoiceCard key={`${v.provider}:${v.voice_id}`} voice={v}
                    isFav={favorites.has(`${v.provider}:${v.voice_id}`)}
                    isPlaying={playingId === v.voice_id}
                    onToggleFav={() => toggleFavorite(v)}
                    onPlay={() => v.preview_url && playUrl(v.preview_url, v.voice_id)}
                    onTts={() => { setTtsVoiceId(v.voice_id); setToolTab("tts"); }}
                    formatNum={formatNum}
                  />
                ))}
              </div>
              {(hasMore || loading) && (
                <div className="flex justify-center pt-4">
                  <button onClick={loadMore} disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-ui-elevated border border-border text-sm font-medium text-foreground-muted hover:text-foreground transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Meer laden
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══ TTS TEST ═══ */}
      {toolTab === "tts" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Text-to-Speech Test</h3>
            <p className="text-xs text-foreground-muted">
              Typ tekst en kies een stem. Werkt met {providerTab === "fish_audio" ? "Fish Audio" : "ElevenLabs"}.
            </p>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Stem</label>
              <select value={ttsVoiceId} onChange={(e) => setTtsVoiceId(e.target.value)} className="editor-select w-full">
                <option value="">Kies een stem...</option>
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name} {favorites.has(`${v.provider}:${v.voice_id}`) ? "♥" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Tekst (max 500)</label>
              <textarea value={ttsText} onChange={(e) => setTtsText(e.target.value.slice(0, 500))} rows={3}
                placeholder="Typ hier je tekst..." className="editor-input w-full resize-none" />
              <span className="text-[10px] text-foreground-subtle">{ttsText.length}/500</span>
            </div>
            <button onClick={handleTts} disabled={ttsLoading || !ttsText.trim() || !ttsVoiceId}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {ttsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {ttsLoading ? "Generating..." : "Generate"}
            </button>
            {ttsAudio && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-ui-elevated border border-border">
                <button onClick={() => playB64(ttsAudio, "tts")} className="shrink-0 p-2 rounded-lg bg-accent text-background">
                  {playingId === "tts" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="flex-1"><p className="text-xs font-medium">Result</p></div>
                <a href={`data:audio/mpeg;base64,${ttsAudio}`} download="tts.mp3" className="text-[10px] text-accent hover:underline">Download</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ VOICE DESIGN ═══ */}
      {toolTab === "design" && providerTab === "elevenlabs" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Voice Design</h3>
            <p className="text-xs text-foreground-muted">Beschrijf een stem → 3 AI previews → sla op.</p>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Beschrijving (min 20 tekens)</label>
              <textarea value={designDesc} onChange={(e) => setDesignDesc(e.target.value)} rows={3}
                placeholder="A warm, deep male voice with a Dutch accent..." className="editor-input w-full resize-none" />
            </div>
            <div>
              <label className="text-xs text-foreground-muted block mb-1">Preview tekst (optioneel)</label>
              <input type="text" value={designPreviewText} onChange={(e) => setDesignPreviewText(e.target.value)}
                placeholder="Tekst die de stem uitspreekt..." className="editor-input w-full" />
            </div>
            <button onClick={handleDesignPreview} disabled={designLoading || designDesc.length < 20}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {designLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {designLoading ? "Generating..." : "Generate Previews"}
            </button>
            {designPreviews.length > 0 && (
              <div className="space-y-3">
                {designPreviews.map((p, i) => (
                  <div key={p.generated_voice_id} className="flex items-center gap-3 p-3 rounded-lg bg-ui-elevated border border-border">
                    <button onClick={() => playB64(p.audio_base64, `d-${i}`)} className="shrink-0 p-2 rounded-lg bg-accent/20 text-accent">
                      {playingId === `d-${i}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <span className="text-xs font-medium">Optie {i + 1}</span>
                    <input type="text" placeholder="Naam..." value={designSaveName} onChange={(e) => setDesignSaveName(e.target.value)}
                      className="editor-input w-28 h-7 text-xs flex-1" />
                    <button onClick={() => handleDesignSave(p.generated_voice_id)} disabled={designSaving || !designSaveName.trim()}
                      className="shrink-0 p-1.5 rounded-lg bg-accent text-background disabled:opacity-50">
                      {designSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ CLONE ═══ */}
      {toolTab === "clone" && providerTab === "elevenlabs" && (
        <div className="max-w-xl space-y-4">
          <div className="rounded-xl border border-border bg-ui p-5 space-y-4">
            <h3 className="text-sm font-medium">Instant Voice Clone</h3>
            <p className="text-xs text-foreground-muted">Upload audio om een stem te clonen. Min 30s aanbevolen.</p>
            <input type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)}
              placeholder="Naam..." className="editor-input w-full" />
            <input type="text" value={cloneDesc} onChange={(e) => setCloneDesc(e.target.value)}
              placeholder="Beschrijving (optioneel)..." className="editor-input w-full" />
            <div className="border border-dashed border-border rounded-lg p-4 text-center">
              <input type="file" accept="audio/*" multiple onChange={(e) => setCloneFiles(Array.from(e.target.files || []))}
                className="hidden" id="clone-upload" />
              <label htmlFor="clone-upload" className="cursor-pointer">
                <Upload className="h-6 w-6 mx-auto text-foreground-subtle mb-2" />
                <p className="text-xs text-foreground-muted">Klik om audio te uploaden</p>
              </label>
            </div>
            {cloneFiles.length > 0 && (
              <div className="space-y-1">
                {cloneFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-foreground-muted">
                    <Volume2 className="h-3 w-3" /> <span className="truncate">{f.name}</span>
                    <span className="text-foreground-subtle">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    <button onClick={() => setCloneFiles((p) => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={handleClone} disabled={cloneLoading || !cloneName.trim() || cloneFiles.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
              {cloneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {cloneLoading ? "Cloning..." : "Clone Voice"}
            </button>
            {cloneResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-subtle border border-accent/20">
                <Check className="h-4 w-4 text-accent" />
                <span className="text-xs text-accent">Gecloned! ID: {cloneResult}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small Components ─── */
function Select({ value, onChange, options, label }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; label?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="editor-select h-8 text-xs w-auto">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function VoiceCard({ voice: v, isFav, isPlaying, onToggleFav, onPlay, onTts, formatNum }: {
  voice: Voice; isFav: boolean; isPlaying: boolean;
  onToggleFav: () => void; onPlay: () => void; onTts: () => void;
  formatNum: (n: number) => string;
}) {
  return (
    <div className={cn(
      "relative rounded-xl border p-3.5 transition-all hover:border-accent/40 group",
      isFav ? "border-accent/30 bg-accent-subtle/30" : "border-border bg-ui"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate">{v.name}</h3>
          {v.author_name && <p className="text-[10px] text-foreground-subtle">{v.author_name}</p>}
          {v.description && <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{v.description}</p>}
        </div>
        <button onClick={onToggleFav} className="shrink-0 p-1.5 rounded-lg hover:bg-ui-elevated transition-colors">
          <Heart className={cn("h-4 w-4", isFav ? "text-red-500 fill-red-500" : "text-foreground-subtle")} />
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mt-2">
        {v.gender && <Tag>{v.gender}</Tag>}
        {v.accent && <Tag>{v.accent}</Tag>}
        {v.language && <Tag>{v.language}</Tag>}
        {v.languages?.slice(0, 3).map((l) => <Tag key={l}>{l}</Tag>)}
        {v.use_case && <Tag>{v.use_case}</Tag>}
        {v.age && <Tag>{v.age}</Tag>}
        {v.category && v.category !== "unknown" && <Tag>{v.category}</Tag>}
        {v.featured && <Tag accent>Featured</Tag>}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-foreground-subtle font-mono">
        {v.task_count != null && v.task_count > 0 && <span>{formatNum(v.task_count)} uses</span>}
        {v.like_count != null && v.like_count > 0 && <span>{formatNum(v.like_count)} likes</span>}
        {v.usage_count_1y != null && v.usage_count_1y > 0 && <span>{formatNum(v.usage_count_1y)} chars/yr</span>}
        {v.cloned_by_count != null && v.cloned_by_count > 0 && <span>{formatNum(v.cloned_by_count)} clones</span>}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 mt-2.5">
        {v.preview_url && (
          <button onClick={onPlay}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
              isPlaying ? "bg-accent text-background" : "bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted"
            )}>
            {isPlaying ? <><Pause className="h-3 w-3" /> Playing</> : <><Play className="h-3 w-3" /> Preview</>}
          </button>
        )}
        <button onClick={onTts}
          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-ui-elevated hover:bg-ui-elevated/80 border border-border text-foreground-muted">
          <Send className="h-3 w-3" /> TTS
        </button>
      </div>
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={cn(
      "text-[10px] px-1.5 py-0.5 rounded font-mono",
      accent ? "bg-accent/10 text-accent border border-accent/20" : "bg-ui-elevated border border-border"
    )}>{children}</span>
  );
}
