import { AbsoluteFill } from "remotion";
import { Blob } from "../components/Blob";

export const Scene1Materializes: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
    {scene.visual.blob && (
      <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
    )}
  </AbsoluteFill>
);
