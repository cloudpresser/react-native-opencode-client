import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  border: '#e0e0e0',
  borderMuted: '#f0f0f0',
  text: '#333333',
  textMuted: '#666666',
  textSubtle: '#999999',
  primary: '#007AFF',
  primaryPressed: '#0056b3',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  info: '#5ac8fa',
  overlay: 'rgba(0,0,0,0.5)',
  cardShadow: 'rgba(0,0,0,0.1)',
} as const;

const darkColors = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceElevated: '#2a2a2a',
  border: '#333333',
  borderMuted: '#222222',
  text: '#f0f0f0',
  textMuted: '#a0a0a0',
  textSubtle: '#666666',
  primary: '#0a84ff',
  primaryPressed: '#409cff',
  danger: '#ff453a',
  success: '#30d158',
  warning: '#ff9f0a',
  info: '#64d2ff',
  overlay: 'rgba(0,0,0,0.7)',
  cardShadow: 'rgba(0,0,0,0.3)',
} as const;

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkColors : lightColors;
}
