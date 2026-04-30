import { useState, useEffect } from "react";
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, Easing, continueRender, delayRender } from "remotion";
import { loadFonts } from "../fonts";
import { waitUntilDone as waitFraunces } from "../fonts/fraunces";
import { calculateMusicVolume, calculateVoVolume, calculateSfxVolume } from "../lib/audio-helpers";
import { FilmGrain } from "../components/FilmGrain";
import { Particles } from "../components/Particles";
import { MoodOverlay } from "../components/MoodOverlay";
import { Scene1Materializes } from "../scenes/Scene1Materializes";
import { Scene2Pain01 } from "../scenes/Scene2Pain01";
import { Scene3Pain02 } from "../scenes/Scene3Pain02";
import { Scene4Action } from "../scenes/Scene4Action";
import { Scene5Promise01 } from "../scenes/Scene5Promise01";
import { Scene6Promise02 } from "../scenes/Scene6Promise02";
import { Scene7Tagline } from "../scenes/Scene7Tagline";
import { Scene8Wordmark } from "../scenes/Scene8Wordmark";

type Props = {
  scenePlan: any;
  assetUrls: Record<string, string>;
};

const SCENES = [
  { id: "scene1_materializes", from: 0, dur: 90, C: Scene1Materializes },
  { id: "scene2_pain_01", from: 90, dur: 90, C: Scene2Pain01 },
  { id: "scene3_pain_02", from: 180, dur: 90, C: Scene3Pain02 },
  { id: "scene4_action", from: 270, dur: 180, C: Scene4Action },
  { id: "scene5_promise_01", from: 450, dur: 120, C: Scene5Promise01 },
  { id: "scene6_promise_02", from: 570, dur: 120, C: Scene6Promise02 },
  { id: "scene7_tagline", from: 690, dur: 180, C: Scene7Tagline },
  { id: "scene8_wordmark", from: 870, dur: 120, C: Scene8Wordmark },
];

const CROSSFADE_FRAMES = 10;

const SceneCrossfade: React.FC<{
  from: number;
  dur: number;
  globalFrame: number;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}> = ({ from, dur, globalFrame, isFirst, isLast, children }) => {
  const fadeIn = isFirst ? 1 : interpolate(
    globalFrame, [from, from + CROSSFADE_FRAMES], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) }
  );
  const fadeOut = isLast ? 1 : interpolate(
    globalFrame, [from + dur - CROSSFADE_FRAMES, from + dur], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) }
  );

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

export const VocitoLaunchVideo: React.FC<Props> = ({ scenePlan, assetUrls }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  const globalFrame = useCurrentFrame();

  useEffect(() => {
    Promise.all([loadFonts(), waitFraunces()])
      .then(() => { setReady(true); continueRender(handle); })
      .catch((err) => { console.error("[fonts] Failed to load:", err); setReady(true); continueRender(handle); });
  }, [handle]);

  if (!scenePlan || !ready) return null;

  const byId = (id: string) => scenePlan.scenes.find((s: any) => s.id === id);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      {/* Background depth */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #0a0d18 0%, #05060a 70%)" }} />

      {/* Subtle particles */}
      <Particles intensity={0.6} />

      {/* Music — smooth ducking via hardcoded mix constants */}
      {assetUrls.music_main && (
        <Audio src={assetUrls.music_main} volume={(f) => calculateMusicVolume(f)} />
      )}

      {/* VO — single concatenated file with scene-aligned silence gaps */}
      {assetUrls.vo_main && (
        <Audio src={assetUrls.vo_main} volume={(f) => calculateVoVolume(f)} />
      )}

      {/* SFX — globally reduced + ducked during VO */}
      {scenePlan.scenes.map((scene: any) =>
        (scene.audio.sfxRequests || []).map((sfx: any, idx: number) => {
          const key = `sfx_${scene.id}_${idx}`;
          if (!assetUrls[key]) return null;
          const sfxStart = scene.frameStart + (sfx.frameOffset || 0);
          const vol = calculateSfxVolume(sfxStart, sfx.volume ?? 0.35);
          return (
            <Sequence key={key} from={sfxStart} durationInFrames={150}>
              <Audio src={assetUrls[key]} volume={vol} />
            </Sequence>
          );
        })
      )}

      {/* Scene visuals with crossfades */}
      {SCENES.map(({ id, from, dur, C }, idx) => {
        const scene = byId(id);
        if (!scene) return null;
        return (
          <Sequence key={id} from={Math.max(0, from - CROSSFADE_FRAMES)} durationInFrames={dur + CROSSFADE_FRAMES * 2}>
            <SceneCrossfade
              from={from}
              dur={dur}
              globalFrame={globalFrame}
              isFirst={idx === 0}
              isLast={idx === SCENES.length - 1}
            >
              <C scene={scene} brand={scenePlan.meta.brand} />
            </SceneCrossfade>
          </Sequence>
        );
      })}

      {/* Mood overlay + vignette */}
      <MoodOverlay mood={scenePlan.audio?.music?.mood || "cinematic"} />

      {/* Film grain overlay */}
      <FilmGrain opacity={0.035} />
    </AbsoluteFill>
  );
};
