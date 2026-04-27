import { useState, useEffect } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender } from "remotion";
import { loadFonts } from "../fonts";
import { waitUntilDone as waitFraunces } from "../fonts/fraunces";
import { calculateMusicVolume, calculateVoVolume, calculateSfxVolume } from "../lib/audio-helpers";
import { FilmGrain } from "../components/FilmGrain";
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

export const VocitoLaunchVideo: React.FC<Props> = ({ scenePlan, assetUrls }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    Promise.all([loadFonts(), waitFraunces()])
      .then(() => { setReady(true); continueRender(handle); })
      .catch(() => { continueRender(handle); });
  }, [handle]);

  if (!scenePlan || !ready) return null;

  const byId = (id: string) => scenePlan.scenes.find((s: any) => s.id === id);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      {/* Background depth */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, #0a0d18 0%, #05060a 70%)" }} />

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

      {/* Scene visuals */}
      {SCENES.map(({ id, from, dur, C }) => {
        const scene = byId(id);
        if (!scene) return null;
        return (
          <Sequence key={id} from={from} durationInFrames={dur}>
            <C scene={scene} brand={scenePlan.meta.brand} />
          </Sequence>
        );
      })}

      {/* Film grain overlay */}
      <FilmGrain opacity={0.035} />
    </AbsoluteFill>
  );
};
