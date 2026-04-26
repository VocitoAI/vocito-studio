import { loadFont } from "@remotion/google-fonts/Fraunces";

export const { fontFamily: FRAUNCES_FAMILY, waitUntilDone } = loadFont("italic", {
  weights: ["400", "500"],
  subsets: ["latin"],
});
