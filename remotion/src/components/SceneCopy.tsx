import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from "remotion";
import { SATOSHI_FAMILY } from "../fonts";
import { FRAUNCES_FAMILY } from "../fonts/fraunces";

type Props = { copy: any };

const FONT: Record<string, string> = {
  serif_italic: `'${FRAUNCES_FAMILY}', Georgia, serif`,
  sans_display: `'${SATOSHI_FAMILY}', system-ui, sans-serif`,
  mono_label: "monospace",
};
const SIZE: Record<string, number> = { sm: 36, md: 56, lg: 88, xl: 132 };
const WEIGHT: Record<string, number> = { serif_italic: 500, sans_display: 700, mono_label: 500 };
const SPACING: Record<string, string> = { serif_italic: "-0.02em", sans_display: "-0.04em", mono_label: "0.02em" };
const POS: Record<string, React.CSSProperties> = {
  center: { alignItems: "center", justifyContent: "center" },
  top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 220 },
  bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 220 },
};

export const SceneCopy: React.FC<Props> = ({ copy }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!copy) return null;

  const dur = Math.round((copy.animationDurationMs || 1000) / 1000 * fps);
  let opacity = 1, y = 0, sc = 1;

  if (copy.animation === "fade_up") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    y = interpolate(frame, [0, dur], [50, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  } else if (copy.animation === "fade_in") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  } else if (copy.animation === "split_reveal") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    sc = spring({ frame, fps, from: 0.94, to: 1.0, config: { damping: 200, mass: 1.2, stiffness: 80 } });
  }

  return (
    <AbsoluteFill style={{ display: "flex", padding: 140, ...(POS[copy.position] || POS.center) }}>
      <div style={{
        fontFamily: FONT[copy.style] || FONT.sans_display,
        fontStyle: copy.style === "serif_italic" ? "italic" : "normal",
        fontSize: SIZE[copy.size] || 56,
        fontWeight: WEIGHT[copy.style] || 500,
        color: "#ffffff",
        textAlign: "center",
        maxWidth: 1500,
        lineHeight: 1.1,
        letterSpacing: SPACING[copy.style] || "-0.02em",
        opacity,
        transform: `translateY(${y}px) scale(${sc})`,
        textShadow: "0 2px 32px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.3)",
      }}>
        {copy.text}
      </div>
    </AbsoluteFill>
  );
};
