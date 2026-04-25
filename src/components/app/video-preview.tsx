"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Download, Loader2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScenePlan } from "@/types/scenePlan";

interface AssetUrls {
  [key: string]: string;
}

interface VideoPreviewProps {
  scenePlan: ScenePlan;
  assetUrls: AssetUrls;
}

const TOTAL_FRAMES = 990;
const FPS = 30;
const TOTAL_DURATION = TOTAL_FRAMES / FPS; // 33s

export function VideoPreview({ scenePlan, assetUrls }: VideoPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voRef = useRef<HTMLAudioElement | null>(null);
  const sfxRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const currentScene = scenePlan.scenes.find(
    (s) => currentFrame >= s.frameStart && currentFrame < s.frameEnd
  );

  const progress = currentTime / TOTAL_DURATION;

  const stopAll = useCallback(() => {
    setPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
    musicRef.current?.pause();
    voRef.current?.pause();
    sfxRefs.current.forEach((a) => a.pause());
  }, []);

  const tick = useCallback(() => {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    if (elapsed >= TOTAL_DURATION) {
      stopAll();
      setCurrentTime(TOTAL_DURATION);
      setCurrentFrame(TOTAL_FRAMES);
      return;
    }
    setCurrentTime(elapsed);
    setCurrentFrame(Math.floor(elapsed * FPS));
    animFrameRef.current = requestAnimationFrame(tick);
  }, [stopAll]);

  const handlePlay = () => {
    if (playing) {
      stopAll();
      return;
    }

    // Reset if at end
    const startFrom = currentTime >= TOTAL_DURATION ? 0 : currentTime;
    if (startFrom === 0) {
      setCurrentTime(0);
      setCurrentFrame(0);
    }

    setPlaying(true);
    startTimeRef.current = performance.now() - startFrom * 1000;

    // Start music
    if (musicRef.current && assetUrls.music_main) {
      musicRef.current.currentTime = startFrom;
      musicRef.current.volume = scenePlan.audio.mixLevels.musicBase;
      musicRef.current.play().catch(() => {});
    }

    // Start VO (slight delay for scene 1 silence)
    if (voRef.current && assetUrls.vo_main) {
      const voDelay = 3; // Scene 1 is music-only (3s)
      if (startFrom < voDelay) {
        setTimeout(() => {
          if (voRef.current) {
            voRef.current.currentTime = 0;
            voRef.current.volume = scenePlan.audio.mixLevels.voVolume;
            voRef.current.play().catch(() => {});
          }
        }, (voDelay - startFrom) * 1000);
      } else {
        voRef.current.currentTime = startFrom - voDelay;
        voRef.current.volume = scenePlan.audio.mixLevels.voVolume;
        voRef.current.play().catch(() => {});
      }
    }

    // Schedule SFX
    scenePlan.scenes.forEach((scene) => {
      (scene.audio.sfxRequests || []).forEach((sfx, idx) => {
        const key = `sfx_${scene.id}_${idx}`;
        const url = assetUrls[key];
        if (!url) return;

        const sfxTime = (scene.frameStart + (sfx.frameOffset || 0)) / FPS;
        const delay = sfxTime - startFrom;
        if (delay < 0) return;

        setTimeout(() => {
          let audio = sfxRefs.current.get(key);
          if (!audio) {
            audio = new Audio(url);
            sfxRefs.current.set(key, audio);
          }
          audio.currentTime = 0;
          audio.volume = sfx.volume;
          audio.play().catch(() => {});
        }, delay * 1000);
      });
    });

    animFrameRef.current = requestAnimationFrame(tick);
  };

  const handleReset = () => {
    stopAll();
    setCurrentTime(0);
    setCurrentFrame(0);
    if (musicRef.current) musicRef.current.currentTime = 0;
    if (voRef.current) voRef.current.currentTime = 0;
  };

  // Duck music during VO
  useEffect(() => {
    if (!musicRef.current || !playing) return;
    const isVOScene = currentFrame >= 90 && currentFrame < 870;
    musicRef.current.volume = isVOScene
      ? scenePlan.audio.mixLevels.musicDuckedDuringVO
      : scenePlan.audio.mixLevels.musicBase;
  }, [currentFrame, playing, scenePlan.audio.mixLevels]);

  const handleDownload = async (key: string, label: string) => {
    const url = assetUrls[key];
    if (!url) return;
    setDownloading(true);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vocito-${label}.mp3`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Download failed:", e);
    }
    setDownloading(false);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    for (const [key, url] of Object.entries(assetUrls)) {
      if (!url) continue;
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `vocito-${key}.mp3`;
        a.click();
        URL.revokeObjectURL(a.href);
        // Small delay between downloads
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.error(`Download failed for ${key}:`, e);
      }
    }
    setDownloading(false);
  };

  const handleRecordVideo = async () => {
    if (recording) return;
    stopAll();
    handleReset();
    setRecording(true);
    setRecordProgress(0);

    const W = 1920;
    const H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Audio context for mixing
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();

    // Load audio buffers
    async function loadAudio(url: string): Promise<AudioBuffer | null> {
      try {
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        return await audioCtx.decodeAudioData(buf);
      } catch { return null; }
    }

    const musicBuf = assetUrls.music_main ? await loadAudio(assetUrls.music_main) : null;
    const voBuf = assetUrls.vo_main ? await loadAudio(assetUrls.vo_main) : null;

    // Start audio sources
    if (musicBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = musicBuf;
      const gain = audioCtx.createGain();
      gain.gain.value = scenePlan.audio.mixLevels.musicDuckedDuringVO;
      src.connect(gain).connect(dest);
      src.start(0);
    }
    if (voBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = voBuf;
      const gain = audioCtx.createGain();
      gain.gain.value = scenePlan.audio.mixLevels.voVolume;
      src.connect(gain).connect(dest);
      src.start(audioCtx.currentTime + 3); // 3s delay for scene 1
    }

    // SFX
    for (const scene of scenePlan.scenes) {
      for (let idx = 0; idx < (scene.audio.sfxRequests?.length || 0); idx++) {
        const sfx = scene.audio.sfxRequests![idx];
        const key = `sfx_${scene.id}_${idx}`;
        if (!assetUrls[key]) continue;
        const buf = await loadAudio(assetUrls[key]);
        if (!buf) continue;
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        gain.gain.value = sfx.volume;
        src.connect(gain).connect(dest);
        const sfxTime = (scene.frameStart + (sfx.frameOffset || 0)) / FPS;
        src.start(audioCtx.currentTime + sfxTime);
      }
    }

    // Combine canvas video + audio
    const videoStream = canvas.captureStream(30);
    const audioTrack = dest.stream.getAudioTracks()[0];
    if (audioTrack) videoStream.addTrack(audioTrack);

    const recorder = new MediaRecorder(videoStream, {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 5000000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "vocito-preview.webm";
      a.click();
      URL.revokeObjectURL(a.href);
      audioCtx.close();
      setRecording(false);
      setRecordProgress(0);
    };

    recorder.start();

    // Render loop
    const startT = performance.now();
    const renderFrame = () => {
      const elapsed = (performance.now() - startT) / 1000;
      if (elapsed >= TOTAL_DURATION) {
        recorder.stop();
        return;
      }

      setRecordProgress(elapsed / TOTAL_DURATION);
      const frame = Math.floor(elapsed * FPS);
      const scene = scenePlan.scenes.find(
        (s) => frame >= s.frameStart && frame < s.frameEnd
      );

      // Draw background
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);

      // Draw blob
      if (scene?.visual.blob) {
        const b = scene.visual.blob;
        const sp = scene ? (frame - scene.frameStart) / (scene.frameEnd - scene.frameStart) : 0;
        let op = b.opacity;
        let sc = b.scale;
        if (b.state === "materializing") op = b.opacity * sp;
        if (b.state === "pulsing") sc += Math.sin(frame / 15) * 0.04;
        else sc += Math.sin(frame / 30) * 0.02;
        if (b.state === "fading") op = b.opacity * (1 - sp * 0.7);

        const r = 300 * sc;
        const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
        grad.addColorStop(0, `rgba(167,139,255,${op})`);
        grad.addColorStop(0.5, `rgba(94,234,212,${op * 0.6})`);
        grad.addColorStop(1, "rgba(5,6,10,0)");
        ctx.filter = "blur(40px)";
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.filter = "none";
      }

      // Draw copy
      if (scene?.visual.copy) {
        const c = scene.visual.copy;
        const sp = (frame - scene.frameStart) / (scene.frameEnd - scene.frameStart);
        const animP = Math.min(1, sp / (c.animationDurationMs / 1000 / scene.durationSeconds));
        const fontSize = c.size === "xl" ? 72 : c.size === "lg" ? 56 : c.size === "md" ? 42 : 32;
        ctx.font = `${c.style === "serif_italic" ? "italic " : ""}${fontSize}px ${c.style === "serif_italic" ? "Georgia, serif" : "system-ui, sans-serif"}`;
        ctx.fillStyle = `rgba(240,244,255,${animP})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const yOff = c.animation === "fade_up" ? 30 * (1 - animP) : 0;
        // Word wrap
        const words = c.text.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const word of words) {
          const test = line ? line + " " + word : word;
          if (ctx.measureText(test).width > W * 0.75) {
            lines.push(line);
            line = word;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        const lineH = fontSize * 1.3;
        const startY = H / 2 - ((lines.length - 1) * lineH) / 2 + yOff;
        lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineH));
      }

      // Scene label
      ctx.font = "20px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(scene?.id.replace(/_/g, " ") || "", 30, 30);

      // Timecode
      const mm = Math.floor(elapsed / 60);
      const ss = String(Math.floor(elapsed % 60)).padStart(2, "0");
      ctx.textAlign = "right";
      ctx.fillText(`${mm}:${ss} / 0:33`, W - 30, 30);

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Blob animation
  const blobState = currentScene?.visual.blob;
  const blobScale = blobState?.scale ?? 1;
  const blobOpacity = blobState?.opacity ?? 0;
  const isPulsing = blobState?.state === "pulsing";
  const isMaterializing = blobState?.state === "materializing";
  const sceneProgress = currentScene
    ? (currentFrame - currentScene.frameStart) /
      (currentScene.frameEnd - currentScene.frameStart)
    : 0;

  const effectiveOpacity = isMaterializing
    ? blobOpacity * sceneProgress
    : blobOpacity;
  const breathe = Math.sin(currentFrame / 30) * 0.02;
  const effectiveScale =
    blobScale + (isPulsing ? Math.sin(currentFrame / 15) * 0.04 : breathe);

  // Copy animation
  const copy = currentScene?.visual.copy;
  const copyOpacity = copy
    ? Math.min(1, sceneProgress / (copy.animationDurationMs / 1000 / (currentScene!.durationSeconds)))
    : 0;
  const copyY = copy?.animation === "fade_up" ? 20 * (1 - copyOpacity) : 0;

  return (
    <div>
      {/* Hidden audio elements */}
      {assetUrls.music_main && (
        <audio ref={musicRef} src={assetUrls.music_main} preload="auto" />
      )}
      {assetUrls.vo_main && (
        <audio ref={voRef} src={assetUrls.vo_main} preload="auto" />
      )}

      {/* Video canvas */}
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: "16/9", background: "#05060a" }}
      >
        {/* Blob */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transition: "opacity 0.3s" }}
        >
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #a78bff 0%, #5eead4 50%, transparent 100%)",
              filter: "blur(40px)",
              transform: `scale(${effectiveScale})`,
              opacity: effectiveOpacity,
              transition: "transform 0.1s",
            }}
          />
        </div>

        {/* On-screen copy */}
        {copy && copyOpacity > 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center px-8 md:px-16"
            style={{
              opacity: copyOpacity,
              transform: `translateY(${copyY}px)`,
            }}
          >
            <p
              className="text-center leading-tight"
              style={{
                fontFamily:
                  copy.style === "serif_italic"
                    ? "var(--font-serif), Georgia, serif"
                    : copy.style === "mono_label"
                      ? "var(--font-mono), monospace"
                      : "var(--font-sans), system-ui",
                fontStyle:
                  copy.style === "serif_italic" ? "italic" : "normal",
                fontSize:
                  copy.size === "xl"
                    ? "clamp(24px, 5vw, 48px)"
                    : copy.size === "lg"
                      ? "clamp(20px, 4vw, 36px)"
                      : copy.size === "md"
                        ? "clamp(16px, 3vw, 28px)"
                        : "clamp(12px, 2vw, 20px)",
                color: "#f0f4ff",
                letterSpacing: "-0.02em",
              }}
            >
              {copy.text}
            </p>
          </div>
        )}

        {/* Scene indicator */}
        <div className="absolute top-3 left-3 text-xs font-mono text-white/30">
          {currentScene?.id.replace(/_/g, " ") || "—"}
        </div>

        {/* Time */}
        <div className="absolute top-3 right-3 text-xs font-mono text-white/30 tabular-nums">
          {Math.floor(currentTime / 60)}:
          {String(Math.floor(currentTime % 60)).padStart(2, "0")} / 0:33
        </div>

        {/* Play overlay (when not playing and at start) */}
        {!playing && currentTime === 0 && (
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3">
        <Button variant="secondary" size="icon" onClick={handlePlay}>
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-ui rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <span className="text-xs font-mono text-foreground-muted tabular-nums w-12 text-right">
          {Math.floor(currentTime / 60)}:
          {String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </span>
      </div>

      {/* Recording progress */}
      {recording && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-foreground-muted mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Recording video... {Math.round(recordProgress * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-ui rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${recordProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Download buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
        <Button
          variant="accent"
          size="sm"
          onClick={handleRecordVideo}
          disabled={recording || downloading}
        >
          {recording ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Film className="h-3.5 w-3.5" />
          )}
          {recording ? "Recording..." : "Download video"}
        </Button>
        {assetUrls.vo_main && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleDownload("vo_main", "voiceover")}
            disabled={downloading}
          >
            <Download className="h-3.5 w-3.5" />
            VO
          </Button>
        )}
        {assetUrls.music_main && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleDownload("music_main", "music")}
            disabled={downloading}
          >
            <Download className="h-3.5 w-3.5" />
            Music
          </Button>
        )}
      </div>
    </div>
  );
}
