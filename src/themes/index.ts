export type Theme = {
  name: string;
  slug: string;
  author?: string;
  base00: string;
  base01: string;
  base02: string;
  base03: string;
  base04: string;
  base05: string;
  base06: string;
  base07: string;
  base08: string;
  base09: string;
  base0A: string;
  base0B: string;
  base0C: string;
  base0D: string;
  base0E: string;
  base0F: string;
};

const themes: Record<string, Theme> = {
  'tokyo-night-dark': require('./tokyo-night-dark.json'),
  'catppuccin-mocha': require('./catppuccin-mocha.json'),
  'nord': require('./nord.json'),
  'dracula': require('./dracula.json'),
  'gruvbox-dark-hard': require('./gruvbox-dark-hard.json'),
  'onedark': require('./onedark.json'),
  'solarized-dark': require('./solarized-dark.json'),
  'nordic': require('./nordic.json'),
};

export const themeList = Object.keys(themes);
export default themes;