import { AbsoluteFill, useCurrentFrame } from "remotion";

export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.035 }) => {
  const frame = useCurrentFrame();
  const seed = frame % 12;

  return (
    <AbsoluteFill style={{
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${0.9 + seed * 0.01}' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>")`,
      opacity,
      mixBlendMode: "overlay",
      pointerEvents: "none",
    }} />
  );
};
