/**
 * Audio mix levels — hardcoded, supersedes scenePlan.audio.mixLevels.
 * Linear amplitude (0.0–1.0), not dB.
 */
export const AUDIO_MIX = {
  music: {
    base: 0.30,           // was 0.45 — softer bed, less limiter pressure
    duckedDuringVO: 0.08, // was 0.10 — deeper duck for VO clarity
    fadeOut: 0.03,         // was 0.05
  },
  vo: {
    main: 1.0,
    boost: 1.20,  // was 1.15 — stronger scene 4 hero lift
  },
  sfx: {
    globalMultiplier: 0.30, // was 0.35
    duringVO: 0.15,         // was 0.20
  },
};

// Frames where VO is actively speaking
export const VO_ACTIVE_FRAME_RANGES: [number, number][] = [
  [90, 180],   // Scene 2
  [180, 270],  // Scene 3
  [270, 450],  // Scene 4
  [450, 570],  // Scene 5
  [570, 690],  // Scene 6
  [690, 870],  // Scene 7
  [870, 990],  // Scene 8
];

export const SCENE_8_VO_END = 990;
export const MUSIC_DUCK_FADE_FRAMES = 10;
