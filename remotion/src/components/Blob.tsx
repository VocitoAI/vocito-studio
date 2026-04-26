import { AbsoluteFill, useCurrentFrame, interpolate, useVideoConfig } from "remotion";

type Props = {
  state: "hidden" | "materializing" | "breathing" | "pulsing" | "fading";
  scale: number;
  opacity: number;
  position: "center" | "top" | "bottom" | "left" | "right";
  accentColor?: string;
  successColor?: string;
};

const BASE_SIZE = 480;

export const Blob: React.FC<Props> = ({
  state, scale, opacity, position,
  accentColor = "#a78bff", successColor = "#5eead4",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let s = scale;
  let o = opacity * 0.55;
  let blur = 80;

  if (state === "hidden") { o = 0; s = 0.4; }
  else if (state === "materializing") {
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const p = interpolate(frame, [0, 75], [0, 1], { extrapolateRight: "clamp" });
    o = ease(p) * opacity * 0.55;
    s = interpolate(frame, [0, 75], [0.5, scale], { extrapolateRight: "clamp" });
    blur = interpolate(frame, [0, 75], [120, 80], { extrapolateRight: "clamp" });
  } else if (state === "breathing") {
    s = scale + Math.sin(frame / fps * 0.8) * 0.025;
  } else if (state === "pulsing") {
    s = scale + Math.sin(frame / fps * 1.4) * 0.04;
    o = opacity * 0.6;
  } else if (state === "fading") {
    o = interpolate(frame, [0, 90], [opacity * 0.55, opacity * 0.15], { extrapolateRight: "clamp" });
    s = interpolate(frame, [0, 90], [scale, scale * 0.9], { extrapolateRight: "clamp" });
  }

  const pos: Record<string, React.CSSProperties> = {
    center: { alignItems: "center", justifyContent: "center" },
    top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 220 },
    bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 220 },
    left: { alignItems: "center", justifyContent: "flex-start", paddingLeft: 280 },
    right: { alignItems: "center", justifyContent: "flex-end", paddingRight: 280 },
  };

  return (
    <AbsoluteFill style={{ display: "flex", ...pos[position] }}>
      <div style={{
        width: BASE_SIZE, height: BASE_SIZE, borderRadius: "50%",
        background: `radial-gradient(circle, ${accentColor} 0%, ${successColor} 45%, transparent 75%)`,
        filter: `blur(${blur}px)`,
        transform: `scale(${s})`,
        opacity: o,
      }} />
    </AbsoluteFill>
  );
};
