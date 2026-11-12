import type { ColorTheme } from './types/ColorTheme';

export const initialZoom = 30;
export const canvasWidth = 1600;
export const canvasHeight = 900;
export const zoomThreshold = 5;
export const STUCK_DELAY = 5000;
export const winnerAreaHeight = 168;

export enum Skills {
  None,
  Impact,
}

export const DefaultEntityColor = {
  box: 'cyan',
  circle: 'yellow',
  polyline: 'white',
} as const;

export const DefaultBloomColor = {
  box: 'cyan',
  circle: 'yellow',
  polyline: 'cyan',
};

// maple-dashboard colours (A design): orange accent, warm greys.
export const Themes: Record<'light' | 'dark', ColorTheme> = {
  light: {
    background: '#FBF8F2',
    marbleLightness: 45,
    marbleWinningBorder: '#1C1A16',
    skillColor: '#F26A22',
    coolTimeIndicator: '#B9B1A3',
    entity: {
      box: { fill: '#F26A22', outline: '#B4440A', bloom: '#F26A22', bloomRadius: 0 },
      circle: { fill: '#FFE3D0', outline: '#F26A22', bloom: '#F26A22', bloomRadius: 0 },
      polyline: { fill: '#625C52', outline: '#625C52', bloom: '#625C52', bloomRadius: 0 },
    },
    rankStroke: '#1C1A16',
    minimapBackground: '#F1EDE5',
    minimapViewport: '#F26A22',
    winnerBackground: 'rgba(255, 255, 255, 0.85)',
    winnerOutline: '',
    winnerText: '#1C1A16',
    goal: '#F26A22',
  },
  dark: {
    background: '#0D0D0B',
    marbleLightness: 70,
    marbleWinningBorder: '#F4F0E8',
    skillColor: '#FF8A4C',
    coolTimeIndicator: '#5A554B',
    entity: {
      box: { fill: '#FF7429', outline: '#FF7429', bloom: '#FF7429', bloomRadius: 10 },
      circle: { fill: '#3A2416', outline: '#FF8A4C', bloom: '#FF7429', bloomRadius: 8 },
      polyline: { fill: '#ABA498', outline: '#ABA498', bloom: '#5A554B', bloomRadius: 6 },
    },
    rankStroke: '',
    minimapBackground: '#1D1C19',
    minimapViewport: '#FF8A4C',
    winnerBackground: 'rgba(13, 13, 11, 0.8)',
    winnerOutline: '',
    winnerText: '#F4F0E8',
    goal: '#FF8A4C',
  },
};
