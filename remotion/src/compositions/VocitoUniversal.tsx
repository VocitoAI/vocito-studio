/**
 * VocitoUniversal: Dynamic composition that renders ANY scene plan.
 * Scene count, durations, and component types are all defined by the plan.
 * Replaces the need for per-template compositions.
 */
import { useState, useEffect } from "react";
import {
  AbsoluteFill, Audio, Sequence, useCurrentFrame,
  interpolate, Easing, continueRender, delayRender,
} from "remotion";
import { loadFonts } from "../fonts";
import { waitUntilDone as waitFraunces } from "../fonts/fraunces";
import { renderScene } from "../lib/componentFactory";
import { FilmGrain } from "../components/FilmGrain";
import { Particles } from "../components/Particles";
import { MoodOverlay } from "../components/MoodOverlay";

type Props = {
  scenePlan: any;
  assetUrls: Record<string, string>;
};

const CROSSFADE_FRAMES = 10;

/* ─── Dynamic audio volume calculators ─── */

function createMusicVolumeCalc(scenes: any[], totalFrames: number, mixLevels: any) {
  const base = mixLevels?.musicBase ?? 0.30;
  const ducked = mixLevels?.musicDuckedDuringVO ?? 0.08;
  const fadeOut = 0.03;
  const fade = 10;

  // VO-active ranges: scenes that have voText
  const voRanges: [number, number][] = scenes
    .filter((s) => s.audio?.voText?.trim())
    .map((s) => [s.frameStart, s.frameEnd]);

  return (frame: number): number => {
    // Intro build (first 3 seconds)
    if (frame < 30) {
      return interpolate(frame, [0, 30], [0.0, 0.02], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
    if (frame < 90) {
      return interpolate(frame, [30, 90], [0.02, base], {
        easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: "clamp",
      });
    }

    // Outro fade (last 2 seconds)
    const outroStart = totalFrames - 60;
    if (frame > outroStart) {
      return interpolate(frame, [outroStart, totalFrames], [base, fadeOut], {
        easing: Easing.bezier(0.4, 0, 0.6, 1), extrapolateRight: "clamp",
      });
    }

    // Duck during VO
    const activeRange = voRanges.find(([s, e]) => frame >= s && frame < e);
    if (activeRange) {
      const [s, e] = activeRange;
      if (frame < s + fade) return interpolate(frame, [s, s + fade], [base, ducked], { easing: Easing.bezier(0.4, 0, 0.6, 1) });
      if (frame > e - fade) return interpolate(frame, [e - fade, e], [ducked, base], { easing: Easing.bezier(0.4, 0, 0.6, 1) });
      return ducked;
    }

    // Approaching VO
    const upcoming = voRanges.find(([s]) => frame < s && frame >= s - fade);
    if (upcoming) {
      return interpolate(frame, [upcoming[0] - fade, upcoming[0]], [base, ducked], { easing: Easing.bezier(0.4, 0, 0.6, 1) });
    }

    return base;
  };
}

function createVoVolumeCalc(scenes: any[]) {
  // Find the "hero" scene (longest scene or scene with role "action")
  const heroScene = scenes.find((s) => s.role === "action" || s.role === "hero");
  const heroStart = heroScene?.frameStart ?? -1;
  const heroEnd = heroScene?.frameEnd ?? -1;

  return (frame: number): number => {
    if (frame >= heroStart && frame < heroEnd) return 1.20; // Hero boost
    return 1.0;
  };
}

function createSfxVolumeCalc(voRanges: [number, number][]) {
  return (sfxStart: number, baseVol: number): number => {
    const inVo = voRanges.some(([s, e]) => sfxStart >= s && sfxStart < e);
    return baseVol * (inVo ? 0.15 : 0.30);
  };
}

/* ─── Crossfade wrapper ─── */

const SceneCrossfade: React.FC<{
  from: number; dur: number; globalFrame: number;
  isFirst?: boolean; isLast?: boolean; children: React.ReactNode;
}> = ({ from, dur, globalFrame, isFirst, isLast, children }) => {
  const fadeIn = isFirst ? 1 : interpolate(
    globalFrame, [from, from + CROSSFADE_FRAMES], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) }
  );
  const fadeOut = isLast ? 1 : interpolate(
    globalFrame, [from + dur - CROSSFADE_FRAMES, from + dur], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) }
  );
  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

/* ─── Main Composition ─── */

export const VocitoUniversal: React.FC<Props> = ({ scenePlan, assetUrls }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  const globalFrame = useCurrentFrame();

  useEffect(() => {
    Promise.all([loadFonts(), waitFraunces()])
      .then(() => { setReady(true); continueRender(handle); })
      .catch((err) => { console.error("[fonts]", err); setReady(true); continueRender(handle); });
  }, [handle]);

  if (!scenePlan || !ready) return null;

  const scenes: any[] = scenePlan.scenes || [];
  const totalFrames = scenePlan.meta?.totalFrames || scenes[scenes.length - 1]?.frameEnd || 900;
  const brand = scenePlan.meta?.brand || {
    name: "Vocito",
    accentColor: "#a78bff",
    successColor: "#5eead4",
    backgroundColor: "#05060a",
  };
  const mixLevels = scenePlan.audio?.mixLevels;
  const mood = scenePlan.audio?.music?.mood || "cinematic";

  // Dynamic audio calculators
  const musicVolume = createMusicVolumeCalc(scenes, totalFrames, mixLevels);
  const voVolume = createVoVolumeCalc(scenes);
  const voRanges: [number, number][] = scenes
    .filter((s: any) => s.audio?.voText?.trim())
    .map((s: any) => [s.frameStart, s.frameEnd]);
  const sfxVolume = createSfxVolumeCalc(voRanges);

  return (
    <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
      {/* Background depth */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #0a0d18 0%, #05060a 70%)" }} />

      {/* Particles */}
      <Particles intensity={0.6} />

      {/* Music */}
      {assetUrls.music_main && (
        <Audio src={assetUrls.music_main} volume={(f) => musicVolume(f)} />
      )}

      {/* VO */}
      {assetUrls.vo_main && (
        <Audio src={assetUrls.vo_main} volume={(f) => voVolume(f)} />
      )}

      {/* SFX per scene */}
      {scenes.map((scene: any) =>
        (scene.audio?.sfxRequests || []).map((sfx: any, idx: number) => {
          const key = `sfx_${scene.id}_${idx}`;
          if (!assetUrls[key]) return null;
          const sfxStart = (scene.frameStart || 0) + (sfx.frameOffset || 0);
          const vol = sfxVolume(sfxStart, sfx.volume ?? 0.35);
          return (
            <Sequence key={key} from={sfxStart} durationInFrames={150}>
              <Audio src={assetUrls[key]} volume={vol} />
            </Sequence>
          );
        })
      )}

      {/* Scene visuals with crossfades */}
      {scenes.map((scene: any, idx: number) => {
        const from = scene.frameStart || 0;
        const dur = (scene.frameEnd || 0) - from;
        if (dur <= 0) return null;

        return (
          <Sequence
            key={scene.id || idx}
            from={Math.max(0, from - CROSSFADE_FRAMES)}
            durationInFrames={dur + CROSSFADE_FRAMES * 2}
          >
            <SceneCrossfade
              from={from}
              dur={dur}
              globalFrame={globalFrame}
              isFirst={idx === 0}
              isLast={idx === scenes.length - 1}
            >
              {renderScene({ scene, brand, globalFrame })}
            </SceneCrossfade>
          </Sequence>
        );
      })}

      {/* Mood overlay + film grain */}
      <MoodOverlay mood={mood} />
      <FilmGrain opacity={0.035} />
    </AbsoluteFill>
  );
};
