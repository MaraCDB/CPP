export const uid = (prefix = 'b'): string =>
  `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
