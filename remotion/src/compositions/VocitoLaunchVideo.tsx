import { AbsoluteFill, Audio, Sequence } from "remotion";
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

const SCENE_BOUNDARIES = [
  { id: "scene1_materializes", from: 0, duration: 90, Component: Scene1Materializes },
  { id: "scene2_pain_01", from: 90, duration: 90, Component: Scene2Pain01 },
  { id: "scene3_pain_02", from: 180, duration: 90, Component: Scene3Pain02 },
  { id: "scene4_action", from: 270, duration: 180, Component: Scene4Action },
  { id: "scene5_promise_01", from: 450, duration: 120, Component: Scene5Promise01 },
  { id: "scene6_promise_02", from: 570, duration: 120, Component: Scene6Promise02 },
  { id: "scene7_tagline", from: 690, duration: 180, Component: Scene7Tagline },
  { id: "scene8_wordmark", from: 870, duration: 120, Component: Scene8Wordmark },
];

export const VocitoLaunchVideo: React.FC<Props> = ({ scenePlan, assetUrls }) => {
  if (!scenePlan) return null;

  const sceneById = (id: string) => scenePlan.scenes.find((s: any) => s.id === id);

  return (
    <AbsoluteFill style={{ backgroundColor: "#05060a" }}>
      {/* Music — full duration with ducking */}
      {assetUrls.music_main && (
        <Audio
          src={assetUrls.music_main}
          volume={(f) => {
            const base = scenePlan.audio.mixLevels.musicBase ?? 0.55;
            const ducked = scenePlan.audio.mixLevels.musicDuckedDuringVO ?? 0.28;
            if (f < 90 || f >= 870) return base;
            return ducked;
          }}
        />
      )}

      {/* Voiceover — starts at scene 2 */}
      {assetUrls.vo_main && (
        <Sequence from={90} durationInFrames={900}>
          <Audio
            src={assetUrls.vo_main}
            volume={scenePlan.audio.mixLevels.voVolume ?? 1.0}
          />
        </Sequence>
      )}

      {/* SFX per scene */}
      {scenePlan.scenes.map((scene: any) =>
        (scene.audio.sfxRequests || []).map((sfx: any, idx: number) => {
          const key = `sfx_${scene.id}_${idx}`;
          const url = assetUrls[key];
          if (!url) return null;
          return (
            <Sequence
              key={key}
              from={scene.frameStart + (sfx.frameOffset || 0)}
              durationInFrames={150}
            >
              <Audio src={url} volume={sfx.volume ?? 0.35} />
            </Sequence>
          );
        })
      )}

      {/* Scene visuals */}
      {SCENE_BOUNDARIES.map(({ id, from, duration, Component }) => {
        const scene = sceneById(id);
        if (!scene) return null;
        return (
          <Sequence key={id} from={from} durationInFrames={duration}>
            <Component scene={scene} brand={scenePlan.meta.brand} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
