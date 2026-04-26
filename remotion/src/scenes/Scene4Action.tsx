import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { Blob } from "../components/Blob";
import { SceneCopy } from "../components/SceneCopy";

export const Scene4Action: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 60, 180], [0, 0.15, 0.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
      {scene.visual.blob && (
        <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
      )}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(167,139,255,${glow}) 100%)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }} />
      <SceneCopy copy={scene.visual.copy} />
    </AbsoluteFill>
  );
};
