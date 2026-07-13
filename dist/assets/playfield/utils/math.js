// Cubic easing helpers keep supply motes and swirl launches smooth and consistent with tower bursts.
export const easeInCubic = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * clamped;
};

export const easeOutCubic = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  const inverted = 1 - clamped;
  return 1 - inverted * inverted * inverted;
};
