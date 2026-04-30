import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from "remotion";
import { SATOSHI_FAMILY } from "../fonts";
import { FRAUNCES_FAMILY } from "../fonts/fraunces";

type Props = {
  copy: any;
  sceneDurationFrames?: number;
  sceneId?: string;
};

const FONT: Record<string, string> = {
  serif_italic: `'${FRAUNCES_FAMILY}', Georgia, serif`,
  sans_display: `'${SATOSHI_FAMILY}', system-ui, sans-serif`,
  mono_label: "monospace",
};
const SIZE: Record<string, number> = { sm: 36, md: 56, lg: 88, xl: 132 };
const WEIGHT: Record<string, number> = { serif_italic: 500, sans_display: 900, mono_label: 500 };
const SPACING: Record<string, string> = { serif_italic: "-0.02em", sans_display: "-0.04em", mono_label: "0.02em" };
const POS: Record<string, React.CSSProperties> = {
  center: { alignItems: "center", justifyContent: "center" },
  top: { alignItems: "flex-start", justifyContent: "center", paddingTop: 220 },
  bottom: { alignItems: "flex-end", justifyContent: "center", paddingBottom: 220 },
};

export const SceneCopy: React.FC<Props> = ({ copy, sceneDurationFrames, sceneId }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!copy) return null;

  const dur = Math.round((copy.animationDurationMs || 1000) / 1000 * fps);
  const baseStyle: React.CSSProperties = {
    fontFamily: FONT[copy.style] || FONT.sans_display,
    fontStyle: copy.style === "serif_italic" ? "italic" : "normal",
    fontSize: SIZE[copy.size] || 56,
    fontWeight: WEIGHT[copy.style] || 500,
    color: "#ffffff",
    textAlign: "center" as const,
    maxWidth: 1500,
    lineHeight: 1.1,
    letterSpacing: SPACING[copy.style] || "-0.02em",
    textShadow: "0 2px 32px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.3)",
  };

  // Split reveal: show sentences one by one
  if (copy.animation === "split_reveal") {
    const sentences = copy.text.split(/(?<=\.)\s+/).filter((s: string) => s.trim());
    const totalDur = sceneDurationFrames || 180;
    const perSentence = Math.floor(totalDur / Math.max(sentences.length, 1));

    return (
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", gap: 20, padding: 140, ...(POS[copy.position] || POS.center) }}>
        {sentences.map((sentence: string, i: number) => {
          const startFrame = i * perSentence;
          const localFrame = frame - startFrame;
          if (localFrame < 0) return null;

          const fadeIn = interpolate(localFrame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          const slideY = interpolate(localFrame, [0, 20], [30, 0], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          const sc = spring({ frame: localFrame, fps, from: 0.94, to: 1.0, config: { damping: 200, mass: 1.2, stiffness: 80 } });

          return (
            <div key={i} style={{
              ...baseStyle,
              opacity: fadeIn,
              transform: `translateY(${slideY}px) scale(${sc})`,
            }}>
              {sentence}
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }

  // Kinetic letters: letter-by-letter reveal for hero moments
  if (copy.animation === "kinetic_letters") {
    const letters = copy.text.split("");
    const totalRevealFrames = dur;
    const framesPerLetter = totalRevealFrames / letters.length;

    return (
      <AbsoluteFill style={{ display: "flex", padding: 140, ...(POS[copy.position] || POS.center) }}>
        <div style={{ ...baseStyle }}>
          {letters.map((letter: string, idx: number) => {
            const letterStart = idx * framesPerLetter;
            const letterOpacity = interpolate(
              frame, [letterStart, letterStart + 8], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }
            );
            const letterY = interpolate(
              frame, [letterStart, letterStart + 12], [20, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) }
            );

            return (
              <span
                key={idx}
                style={{
                  display: "inline-block",
                  opacity: letterOpacity,
                  transform: `translateY(${letterY}px)`,
                  whiteSpace: letter === " " ? "pre" : "normal",
                }}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // Standard animations
  let opacity = 1, y = 0;

  if (copy.animation === "fade_up") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
    y = interpolate(frame, [0, dur], [50, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  } else if (copy.animation === "fade_in") {
    opacity = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) });
  }

  // Scene 8 wordmark: letterspacing tightens from 0.05em to -0.02em
  const isWordmark = sceneId === "scene8_wordmark";
  const dynamicLetterSpacing = isWordmark
    ? `${interpolate(frame, [0, 60], [0.05, -0.02], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}em`
    : baseStyle.letterSpacing;

  return (
    <AbsoluteFill style={{ display: "flex", padding: 140, ...(POS[copy.position] || POS.center) }}>
      <div style={{
        ...baseStyle,
        letterSpacing: dynamicLetterSpacing,
        opacity,
        transform: `translateY(${y}px)`,
      }}>
        {copy.text}
      </div>
    </AbsoluteFill>
  );
};
