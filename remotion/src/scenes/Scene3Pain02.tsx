import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Blob } from "../components/Blob";
import { NotificationBubble } from "../components/NotificationBubble";

export const Scene3Pain02: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const globalFrame = frame + scene.frameStart;

  return (
    <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
      {scene.visual.blob && (
        <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
      )}
      {(scene.visual.uiElements || []).map((el: any, idx: number) => (
        el.type === "notification" ? (
          <NotificationBubble
            key={idx}
            content={el.content}
            showFromFrame={el.showFromFrame}
            showUntilFrame={el.showUntilFrame}
            index={idx}
            globalFrame={globalFrame}
          />
        ) : null
      ))}
    </AbsoluteFill>
  );
};
