import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

type Props = { copy: any };

const FONT: Record<string, string> = {
  serif_italic: "Georgia, serif",
  sans_display: "system-ui, sans-serif",
  mono_label: "monospace",
};
const SIZE: Record<string, number> = { sm: 36, md: 56, lg: 84, xl: 120 };
const POS: Record<string, React.CSSProperties> = {
  center: { alignItems: "center", justifyContent: "center" },
  top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 180 },
  bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 180 },
};

export const SceneCopy: React.FC<Props> = ({ copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!copy) return null;

  const dur = Math.round((copy.animationDurationMs || 800) / 1000 * fps);
  let opacity = 1, y = 0, sc = 1;

  if (copy.animation === "fade_up") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp" });
    y = interpolate(frame, [0, dur], [40, 0], { extrapolateRight: "clamp" });
  } else if (copy.animation === "fade_in") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp" });
  } else if (copy.animation === "split_reveal") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp" });
    sc = spring({ frame, fps, from: 0.92, to: 1.0, config: { damping: 200, mass: 0.8 } });
  }

  return (
    <AbsoluteFill style={{ display: "flex", padding: 120, ...(POS[copy.position] || POS.center) }}>
      <div style={{
        fontFamily: FONT[copy.style] || FONT.sans_display,
        fontStyle: copy.style === "serif_italic" ? "italic" : "normal",
        fontSize: SIZE[copy.size] || 56,
        fontWeight: copy.style === "sans_display" ? 600 : 400,
        color: "#f0f4ff", textAlign: "center", maxWidth: 1500,
        lineHeight: 1.15, letterSpacing: "-0.02em",
        opacity, transform: `translateY(${y}px) scale(${sc})`,
      }}>
        {copy.text}
      </div>
    </AbsoluteFill>
  );
};
