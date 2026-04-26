/**
 * Audio mix levels — hardcoded, supersedes scenePlan.audio.mixLevels.
 * Linear amplitude (0.0–1.0), not dB.
 */
export const AUDIO_MIX = {
  music: {
    base: 0.45,           // -7 dB — full in non-VO sections
    duckedDuringVO: 0.10, // -20 dB — heavy duck during VO
    fadeOut: 0.05,
  },
  vo: {
    main: 1.0,
    boost: 1.15,  // +1.2 dB for scene 4 hero
  },
  sfx: {
    globalMultiplier: 0.35,
    duringVO: 0.20,
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
];

export const SCENE_8_VO_END = 960;
export const MUSIC_DUCK_FADE_FRAMES = 10;
