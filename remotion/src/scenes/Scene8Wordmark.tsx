import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";
import { SceneCopy } from "../components/SceneCopy";

export const Scene8Wordmark: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
    {scene.visual.blob && (
      <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
    )}
    <SceneCopy copy={scene.visual.copy} sceneDurationFrames={scene.frameEnd - scene.frameStart} />
  </AbsoluteFill>
);
