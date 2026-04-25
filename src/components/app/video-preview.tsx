"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
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
    </div>
  );
}
