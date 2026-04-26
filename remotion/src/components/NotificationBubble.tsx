import { interpolate, useVideoConfig, Easing } from "remotion";
import { SATOSHI_FAMILY } from "../fonts";

type Props = {
  content: string;
  showFromFrame: number;
  showUntilFrame: number;
  index: number;
  globalFrame: number;
};

export const NotificationBubble: React.FC<Props> = ({
  content, showFromFrame, showUntilFrame, index, globalFrame,
}) => {
  if (globalFrame < showFromFrame || globalFrame > showUntilFrame) return null;

  const localFrame = globalFrame - showFromFrame;
  const totalDuration = showUntilFrame - showFromFrame;

  const slideY = interpolate(localFrame, [0, 18], [-40, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const fadeIn = interpolate(localFrame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [totalDuration - 12, totalDuration], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <div style={{
      position: "absolute",
      top: 180 + index * 110,
      left: "50%",
      transform: `translate(-50%, ${slideY}px)`,
      opacity: Math.min(fadeIn, fadeOut),
      zIndex: 100,
      background: "rgba(15,18,28,0.85)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 18,
      padding: "18px 28px",
      fontFamily: `'${SATOSHI_FAMILY}', system-ui, sans-serif`,
      fontSize: 28,
      fontWeight: 500,
      color: "rgba(255,255,255,0.92)",
      letterSpacing: "-0.01em",
      boxShadow: "0 16px 48px -12px rgba(0,0,0,0.5)",
      minWidth: 380,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
      <span>{content}</span>
    </div>
  );
};
