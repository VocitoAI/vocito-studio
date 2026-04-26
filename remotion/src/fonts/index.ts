import { continueRender, delayRender, staticFile } from "remotion";

export const SATOSHI_FAMILY = "Satoshi";

let fontsLoaded = false;

export const loadFonts = async (): Promise<void> => {
  if (fontsLoaded) return;

  const handle = delayRender("Loading Satoshi fonts");

  try {
    const weights = [
      { file: "Satoshi-Regular.woff2", weight: "400" },
      { file: "Satoshi-Medium.woff2", weight: "500" },
      { file: "Satoshi-Bold.woff2", weight: "700" },
    ];

    const faces = weights.map(
      ({ file, weight }) =>
        new FontFace(SATOSHI_FAMILY, `url(${staticFile(`fonts/${file}`)})`, {
          weight,
          style: "normal",
        })
    );

    await Promise.all(faces.map((f) => f.load()));
    faces.forEach((f) => document.fonts.add(f));

    fontsLoaded = true;
  } finally {
    continueRender(handle);
  }
};
