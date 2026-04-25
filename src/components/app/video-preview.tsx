"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScenePlan } from "@/types/scenePlan";

interface VideoPreviewProps {
  scenePlan: ScenePlan;
  assetUrls: Record<string, string>;
}

const TOTAL_FRAMES = 990;
const FPS = 30;
const TOTAL_DURATION = TOTAL_FRAMES / FPS;

export function VideoPreview({ scenePlan, assetUrls }: VideoPreviewProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
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

  const startPlayback = useCallback(
    (from = 0) => {
      setPlaying(true);
      startTimeRef.current = performance.now() - from * 1000;

      if (musicRef.current && assetUrls.music_main) {
        musicRef.current.currentTime = from;
        musicRef.current.volume = scenePlan.audio.mixLevels.musicBase;
        musicRef.current.play().catch(() => {});
      }

      if (voRef.current && assetUrls.vo_main) {
        const voDelay = 3;
        if (from < voDelay) {
          setTimeout(() => {
            if (voRef.current) {
              voRef.current.currentTime = 0;
              voRef.current.volume = scenePlan.audio.mixLevels.voVolume;
              voRef.current.play().catch(() => {});
            }
          }, (voDelay - from) * 1000);
        } else {
          voRef.current.currentTime = from - voDelay;
          voRef.current.volume = scenePlan.audio.mixLevels.voVolume;
          voRef.current.play().catch(() => {});
        }
      }

      scenePlan.scenes.forEach((scene) => {
        (scene.audio.sfxRequests || []).forEach((sfx, idx) => {
          const key = `sfx_${scene.id}_${idx}`;
          const url = assetUrls[key];
          if (!url) return;
          const sfxTime = (scene.frameStart + (sfx.frameOffset || 0)) / FPS;
          const delay = sfxTime - from;
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
    },
    [assetUrls, scenePlan, tick]
  );

  const handlePlay = () => {
    if (playing) {
      stopAll();
      return;
    }
    const from = currentTime >= TOTAL_DURATION ? 0 : currentTime;
    if (from === 0) {
      setCurrentTime(0);
      setCurrentFrame(0);
    }
    startPlayback(from);
  };

  const handleReset = () => {
    stopAll();
    setCurrentTime(0);
    setCurrentFrame(0);
    if (musicRef.current) musicRef.current.currentTime = 0;
    if (voRef.current) voRef.current.currentTime = 0;
  };

  // Download: record canvas + audio as WebM
  const handleDownload = async () => {
    if (recording) return;
    stopAll();
    handleReset();
    setRecording(true);
    setRecordProgress(0);

    const W = 1920, H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Load + mix audio via Web Audio API
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();

    async function loadBuf(url: string) {
      try {
        const r = await fetch(url);
        return await audioCtx.decodeAudioData(await r.arrayBuffer());
      } catch { return null; }
    }

    const musicBuf = assetUrls.music_main ? await loadBuf(assetUrls.music_main) : null;
    const voBuf = assetUrls.vo_main ? await loadBuf(assetUrls.vo_main) : null;

    if (musicBuf) {
      const s = audioCtx.createBufferSource();
      s.buffer = musicBuf;
      const g = audioCtx.createGain();
      g.gain.value = scenePlan.audio.mixLevels.musicDuckedDuringVO;
      s.connect(g).connect(dest);
      s.start(0);
    }
    if (voBuf) {
      const s = audioCtx.createBufferSource();
      s.buffer = voBuf;
      const g = audioCtx.createGain();
      g.gain.value = scenePlan.audio.mixLevels.voVolume;
      s.connect(g).connect(dest);
      s.start(audioCtx.currentTime + 3);
    }
    for (const scene of scenePlan.scenes) {
      for (let i = 0; i < (scene.audio.sfxRequests?.length || 0); i++) {
        const sfx = scene.audio.sfxRequests![i];
        const url = assetUrls[`sfx_${scene.id}_${i}`];
        if (!url) continue;
        const buf = await loadBuf(url);
        if (!buf) continue;
        const s = audioCtx.createBufferSource();
        s.buffer = buf;
        const g = audioCtx.createGain();
        g.gain.value = sfx.volume;
        s.connect(g).connect(dest);
        s.start(audioCtx.currentTime + (scene.frameStart + (sfx.frameOffset || 0)) / FPS);
      }
    }

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
      a.download = "vocito-video.webm";
      a.click();
      URL.revokeObjectURL(a.href);
      audioCtx.close();
      setRecording(false);
      setRecordProgress(0);
    };
    recorder.start();

    const startT = performance.now();
    const renderFrame = () => {
      const elapsed = (performance.now() - startT) / 1000;
      if (elapsed >= TOTAL_DURATION) { recorder.stop(); return; }
      setRecordProgress(elapsed / TOTAL_DURATION);
      const frame = Math.floor(elapsed * FPS);
      const sc = scenePlan.scenes.find((s) => frame >= s.frameStart && frame < s.frameEnd);
      const sp = sc ? (frame - sc.frameStart) / (sc.frameEnd - sc.frameStart) : 0;

      // Background
      ctx.fillStyle = "#05060a";
      ctx.fillRect(0, 0, W, H);

      // Blob
      if (sc?.visual.blob) {
        const b = sc.visual.blob;
        let op = b.opacity, scl = b.scale;
        if (b.state === "materializing") op *= sp;
        if (b.state === "fading") op *= 1 - sp * 0.7;
        if (b.state === "pulsing") scl += Math.sin(frame / 15) * 0.04;
        else scl += Math.sin(frame / 30) * 0.02;

        const r = 300 * scl;
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

      // Text
      if (sc?.visual.copy) {
        const c = sc.visual.copy;
        const animP = Math.min(1, sp / (c.animationDurationMs / 1000 / sc.durationSeconds));
        const fs = c.size === "xl" ? 72 : c.size === "lg" ? 56 : c.size === "md" ? 42 : 32;
        ctx.font = `${c.style === "serif_italic" ? "italic " : ""}${fs}px ${c.style === "serif_italic" ? "Georgia, serif" : "system-ui, sans-serif"}`;
        ctx.fillStyle = `rgba(240,244,255,${animP})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const yOff = c.animation === "fade_up" ? 30 * (1 - animP) : 0;
        const words = c.text.split(" ");
        const lines: string[] = [];
        let line = "";
        for (const w of words) {
          const t = line ? line + " " + w : w;
          if (ctx.measureText(t).width > W * 0.75) { lines.push(line); line = w; }
          else line = t;
        }
        if (line) lines.push(line);
        const lh = fs * 1.3;
        const sy = H / 2 - ((lines.length - 1) * lh) / 2 + yOff;
        lines.forEach((l, i) => ctx.fillText(l, W / 2, sy + i * lh));
      }

      requestAnimationFrame(renderFrame);
    };
    requestAnimationFrame(renderFrame);
  };

  // Duck music during VO
  useEffect(() => {
    if (!musicRef.current || !playing) return;
    musicRef.current.volume =
      currentFrame >= 90 && currentFrame < 870
        ? scenePlan.audio.mixLevels.musicDuckedDuringVO
        : scenePlan.audio.mixLevels.musicBase;
  }, [currentFrame, playing, scenePlan.audio.mixLevels]);

  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), []);

  // Blob visuals
  const blob = currentScene?.visual.blob;
  const sceneProgress = currentScene
    ? (currentFrame - currentScene.frameStart) / (currentScene.frameEnd - currentScene.frameStart)
    : 0;
  let blobOpacity = blob?.opacity ?? 0;
  let blobScale = blob?.scale ?? 1;
  if (blob?.state === "materializing") blobOpacity *= sceneProgress;
  if (blob?.state === "fading") blobOpacity *= 1 - sceneProgress * 0.7;
  if (blob?.state === "pulsing") blobScale += Math.sin(currentFrame / 15) * 0.04;
  else blobScale += Math.sin(currentFrame / 30) * 0.02;

  const copy = currentScene?.visual.copy;
  const copyOpacity = copy
    ? Math.min(1, sceneProgress / (copy.animationDurationMs / 1000 / currentScene!.durationSeconds))
    : 0;
  const copyY = copy?.animation === "fade_up" ? 20 * (1 - copyOpacity) : 0;

  return (
    <div>
      {assetUrls.music_main && <audio ref={musicRef} src={assetUrls.music_main} preload="auto" />}
      {assetUrls.vo_main && <audio ref={voRef} src={assetUrls.vo_main} preload="auto" />}

      {/* Preview canvas */}
      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9", background: "#05060a" }}>
        {/* Blob */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{
            width: 300, height: 300, borderRadius: "50%",
            background: "radial-gradient(circle, #a78bff 0%, #5eead4 50%, transparent 100%)",
            filter: "blur(40px)",
            transform: `scale(${blobScale})`,
            opacity: blobOpacity,
            transition: "transform 0.1s",
          }} />
        </div>

        {/* Copy */}
        {copy && copyOpacity > 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-8 md:px-16"
            style={{ opacity: copyOpacity, transform: `translateY(${copyY}px)` }}>
            <p className="text-center leading-tight" style={{
              fontFamily: copy.style === "serif_italic" ? "var(--font-serif), Georgia, serif"
                : copy.style === "mono_label" ? "var(--font-mono), monospace"
                : "var(--font-sans), system-ui",
              fontStyle: copy.style === "serif_italic" ? "italic" : "normal",
              fontSize: copy.size === "xl" ? "clamp(24px, 5vw, 48px)"
                : copy.size === "lg" ? "clamp(20px, 4vw, 36px)"
                : copy.size === "md" ? "clamp(16px, 3vw, 28px)"
                : "clamp(12px, 2vw, 20px)",
              color: "#f0f4ff", letterSpacing: "-0.02em",
            }}>
              {copy.text}
            </p>
          </div>
        )}

        {/* Scene label */}
        <div className="absolute top-3 left-3 text-xs font-mono text-white/30">
          {currentScene?.id.replace(/_/g, " ") || "—"}
        </div>
        <div className="absolute top-3 right-3 text-xs font-mono text-white/30 tabular-nums">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")} / 0:33
        </div>

        {/* Play overlay */}
        {!playing && currentTime === 0 && !recording && (
          <button onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
              <Play className="h-7 w-7 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mt-3">
        <Button variant="secondary" size="icon" onClick={handlePlay} disabled={recording}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={handleReset} disabled={recording}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex-1 h-1.5 bg-ui rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-xs font-mono text-foreground-muted tabular-nums w-12 text-right">
          {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
        </span>
      </div>

      {/* Download */}
      <div className="mt-4 pt-4 border-t border-border">
        {recording ? (
          <div>
            <div className="flex items-center gap-2 text-sm text-foreground-muted mb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Recording video... {Math.round(recordProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-ui rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${recordProgress * 100}%` }} />
            </div>
            <p className="text-xs text-foreground-subtle mt-2">
              Recording the preview with all audio. Takes 33 seconds.
            </p>
          </div>
        ) : (
          <Button variant="accent" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download video
          </Button>
        )}
      </div>
    </div>
  );
}
