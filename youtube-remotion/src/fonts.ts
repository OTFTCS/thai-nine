import { loadFont } from "@remotion/google-fonts/Sarabun";

export const { fontFamily, waitUntilDone } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
});
