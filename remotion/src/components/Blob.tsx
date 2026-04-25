import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type Props = {
  state: "hidden" | "materializing" | "breathing" | "pulsing" | "fading";
  scale: number;
  opacity: number;
  position: "center" | "top" | "bottom" | "left" | "right";
  accentColor?: string;
  successColor?: string;
};

export const Blob: React.FC<Props> = ({
  state, scale, opacity, position,
  accentColor = "#a78bff", successColor = "#5eead4",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let s = scale;
  let o = opacity;

  if (state === "hidden") { o = 0; s = 0.3; }
  else if (state === "materializing") {
    o = interpolate(frame, [0, 60], [0, opacity], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    s = spring({ frame, fps, from: 0.5, to: scale, config: { damping: 30, mass: 1 } });
  } else if (state === "breathing") {
    s = scale + Math.sin(frame / fps * 1.2) * 0.04;
  } else if (state === "pulsing") {
    s = scale + Math.sin(frame / fps * 2.5) * 0.06;
  } else if (state === "fading") {
    o = interpolate(frame, [0, 60], [opacity, 0.15], { extrapolateRight: "clamp" });
    s = interpolate(frame, [0, 60], [scale, scale * 0.8], { extrapolateRight: "clamp" });
  }

  const pos: Record<string, React.CSSProperties> = {
    center: { alignItems: "center", justifyContent: "center" },
    top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 200 },
    bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 200 },
    left: { alignItems: "center", justifyContent: "flex-start", paddingLeft: 200 },
    right: { alignItems: "center", justifyContent: "flex-end", paddingRight: 200 },
  };

  return (
    <AbsoluteFill style={{ display: "flex", ...pos[position] }}>
      <div style={{
        width: 800, height: 800, borderRadius: "50%",
        background: `radial-gradient(circle, ${accentColor} 0%, ${successColor} 55%, transparent 100%)`,
        filter: "blur(60px)", transform: `scale(${s})`, opacity: o,
      }} />
    </AbsoluteFill>
  );
};
