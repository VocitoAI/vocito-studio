import { interpolate, Easing } from "remotion";
import {
  AUDIO_MIX,
  VO_ACTIVE_FRAME_RANGES,
  SCENE_8_VO_END,
  MUSIC_DUCK_FADE_FRAMES,
} from "./audio-constants";

const EASE = Easing.bezier(0.4, 0, 0.6, 1);

export function calculateMusicVolume(frame: number): number {
  const base = AUDIO_MIX.music.base;
  const ducked = AUDIO_MIX.music.duckedDuringVO;
  const fade = MUSIC_DUCK_FADE_FRAMES;

  // Scene 1: true silence first 1 sec, then atmospheric build
  if (frame < 30) {
    return interpolate(frame, [0, 30], [0.0, 0.02], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  if (frame < 90) {
    return interpolate(frame, [30, 90], [0.02, base], {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateRight: "clamp",
    });
  }

  // Outro fade (930-990)
  if (frame > 930) {
    return interpolate(frame, [930, 990], [base, AUDIO_MIX.music.fadeOut], {
      easing: EASE,
      extrapolateRight: "clamp",
    });
  }

  // All VO ranges (scene 8 now included in VO_ACTIVE_FRAME_RANGES)
  const allRanges = VO_ACTIVE_FRAME_RANGES;

  // Check if in a VO range
  const activeRange = allRanges.find(([s, e]) => frame >= s && frame < e);
  if (activeRange) {
    const [s, e] = activeRange;
    // Fade-in to ducked
    if (frame < s + fade) {
      return interpolate(frame, [s, s + fade], [base, ducked], { easing: EASE });
    }
    // Fade-out from ducked
    if (frame > e - fade) {
      return interpolate(frame, [e - fade, e], [ducked, base], { easing: EASE });
    }
    return ducked;
  }

  // Approaching a VO range
  const upcoming = allRanges.find(([s]) => frame < s && frame >= s - fade);
  if (upcoming) {
    return interpolate(frame, [upcoming[0] - fade, upcoming[0]], [base, ducked], { easing: EASE });
  }

  return base;
}

export function calculateVoVolume(frame: number): number {
  // Scene 4 hero boost
  if (frame >= 270 && frame < 450) return AUDIO_MIX.vo.boost;
  return AUDIO_MIX.vo.main;
}

export function calculateSfxVolume(
  sfxFrameStart: number,
  sfxBaseVolume: number
): number {
  const inVo = VO_ACTIVE_FRAME_RANGES.some(
    ([s, e]) => sfxFrameStart >= s && sfxFrameStart < e
  );
  const mult = inVo ? AUDIO_MIX.sfx.duringVO : AUDIO_MIX.sfx.globalMultiplier;
  return sfxBaseVolume * mult;
}
