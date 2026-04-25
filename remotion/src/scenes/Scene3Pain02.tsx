import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Blob } from "../components/Blob";
import { NotificationBubble } from "../components/NotificationBubble";

export const Scene3Pain02: React.FC<{ scene: any; brand: any }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: brand.backgroundColor }}>
      {scene.visual.blob && (
        <Blob {...scene.visual.blob} accentColor={brand.accentColor} successColor={brand.successColor} />
      )}
      {(scene.visual.uiElements || []).map((el: any, idx: number) => {
        if (el.type === "notification") {
          return (
            <NotificationBubble
              key={idx}
              content={el.content}
              showFromFrame={el.showFromFrame}
              showUntilFrame={el.showUntilFrame}
              yOffset={idx * 90}
              localFrame={frame}
            />
          );
        }
        return null;
      })}
    </AbsoluteFill>
  );
};
