import { interpolate, spring, useVideoConfig } from "remotion";

type Props = {
  content: string;
  showFromFrame: number;
  showUntilFrame: number;
  yOffset?: number;
  localFrame: number;
};

export const NotificationBubble: React.FC<Props> = ({
  content, showFromFrame, showUntilFrame, yOffset = 0, localFrame,
}) => {
  const { fps } = useVideoConfig();
  if (localFrame < showFromFrame || localFrame > showUntilFrame) return null;

  const f = localFrame - showFromFrame;
  const slideIn = spring({ frame: f, fps, from: -100, to: 0, config: { damping: 200 } });
  const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{
      position: "absolute", top: 120 + yOffset, left: "50%",
      transform: `translateX(calc(-50% + ${slideIn}px))`,
      opacity, background: "rgba(255,255,255,0.08)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 16, padding: "16px 24px",
      fontFamily: "system-ui, sans-serif", fontSize: 24,
      color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em",
    }}>
      {content}
    </div>
  );
};
