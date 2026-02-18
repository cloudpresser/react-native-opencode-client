import { themeColors, type ThemeColors } from '../generated/theme';

export type { ThemeColors };

export function useThemeColors(): ThemeColors {
  return themeColors;
}
