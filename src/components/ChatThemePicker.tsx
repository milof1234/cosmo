import React, { useRef } from 'react';
import { ChatTheme, Message, User } from '../types';
import {
  Palette,
  RotateCcw,
  Check,
  Sparkles,
  X,
  Image as ImageIcon,
  Upload,
  Trash2,
  Download,
  FileText,
  FileJson,
  BarChart3
} from 'lucide-react';
import { ChatAnalyticsPanel } from './ChatAnalyticsPanel';

export interface BubbleColorPreset {
  id: string;
  label: string;
  fromHex: string;
  toHex: string;
  previewClass: string;
}

export interface BgGradientPreset {
  id: string;
  label: string;
  cssBackground: string;
  fromHex: string;
  toHex: string;
}

export interface WallpaperPreset {
  id: string;
  label: string;
  url: string;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'starfield',
    label: 'Звёздный космос',
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <radialGradient id="neb1" cx="25%" cy="30%" r="60%">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.45"/>
            <stop offset="50%" stop-color="#1e1b4b" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#070b19" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="neb2" cx="80%" cy="70%" r="55%">
            <stop offset="0%" stop-color="#ec4899" stop-opacity="0.35"/>
            <stop offset="55%" stop-color="#311042" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#070b19" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill="#070b19"/>
        <rect width="800" height="600" fill="url(#neb1)"/>
        <rect width="800" height="600" fill="url(#neb2)"/>
        <g fill="#ffffff">
          <circle cx="80" cy="70" r="1.5" opacity="0.8"/>
          <circle cx="160" cy="180" r="1" opacity="0.5"/>
          <circle cx="240" cy="90" r="2" opacity="0.9"/>
          <circle cx="350" cy="140" r="1.2" opacity="0.7"/>
          <circle cx="480" cy="60" r="1.8" opacity="0.85"/>
          <circle cx="620" cy="110" r="1" opacity="0.6"/>
          <circle cx="720" cy="80" r="2.2" opacity="0.9"/>
          <circle cx="120" cy="310" r="1.4" opacity="0.75"/>
          <circle cx="290" cy="260" r="2.1" opacity="0.85"/>
          <circle cx="430" cy="320" r="1.3" opacity="0.65"/>
          <circle cx="570" cy="240" r="1.9" opacity="0.9"/>
          <circle cx="690" cy="300" r="1.2" opacity="0.7"/>
          <circle cx="95" cy="480" r="2" opacity="0.85"/>
          <circle cx="210" cy="420" r="1.1" opacity="0.6"/>
          <circle cx="380" cy="500" r="1.7" opacity="0.8"/>
          <circle cx="520" cy="440" r="2.3" opacity="0.95"/>
          <circle cx="650" cy="510" r="1.5" opacity="0.75"/>
          <circle cx="745" cy="430" r="1.2" opacity="0.65"/>
        </g>
      </svg>
    `)
  },
  {
    id: 'planet_horizon',
    label: 'Орбита планеты',
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#050814"/>
            <stop offset="55%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
          <radialGradient id="planet" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="45%" stop-color="#4f46e5"/>
            <stop offset="100%" stop-color="#090d16"/>
          </radialGradient>
        </defs>
        <rect width="800" height="600" fill="url(#sky)"/>
        <circle cx="650" cy="140" r="95" fill="url(#planet)" opacity="0.85"/>
        <ellipse cx="650" cy="140" rx="170" ry="32" fill="none" stroke="#818cf8" stroke-width="4" opacity="0.45" transform="rotate(-18 650 140)"/>
        <ellipse cx="650" cy="140" rx="145" ry="24" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.55" transform="rotate(-18 650 140)"/>
        <path d="M-100,600 Q400,430 900,600 Z" fill="#090d1a" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
      </svg>
    `)
  },
  {
    id: 'aurora_waves',
    label: 'Северное сияние',
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#041f1e"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#090d16"/>
          </linearGradient>
          <linearGradient id="wave1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.3"/>
          </linearGradient>
          <linearGradient id="wave2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.3"/>
            <stop offset="50%" stop-color="#14b8a6" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.25"/>
          </linearGradient>
        </defs>
        <rect width="800" height="600" fill="url(#bg)"/>
        <path d="M0,180 C220,90 420,280 800,140 L800,360 C520,440 280,260 0,380 Z" fill="url(#wave1)"/>
        <path d="M0,320 C260,220 510,430 800,290 L800,520 C480,580 260,410 0,510 Z" fill="url(#wave2)"/>
      </svg>
    `)
  },
  {
    id: 'cyber_grid',
    label: 'Неоновая сетка',
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <defs>
          <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1a0b2e"/>
            <stop offset="55%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#090d16"/>
          </linearGradient>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ec4899" stroke-width="1" stroke-opacity="0.18"/>
          </pattern>
        </defs>
        <rect width="800" height="600" fill="url(#cbg)"/>
        <rect width="800" height="600" fill="url(#grid)"/>
        <circle cx="400" cy="280" r="120" fill="#f43f5e" opacity="0.18"/>
        <circle cx="400" cy="280" r="80" fill="#a855f7" opacity="0.22"/>
      </svg>
    `)
  },
  {
    id: 'constellation',
    label: 'Созвездия',
    url: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="800" height="600" fill="#0b1121"/>
        <g stroke="#6366f1" stroke-width="1.2" stroke-opacity="0.35" fill="none">
          <polyline points="110,120 210,80 290,160 190,230 110,120"/>
          <polyline points="480,100 590,70 680,150 610,250 480,100"/>
          <polyline points="160,410 280,360 390,440 310,530"/>
          <polyline points="520,380 640,330 720,440 600,510 520,380"/>
        </g>
        <g fill="#a5b4fc">
          <circle cx="110" cy="120" r="3"/>
          <circle cx="210" cy="80" r="3.5"/>
          <circle cx="290" cy="160" r="3"/>
          <circle cx="190" cy="230" r="2.5"/>
          <circle cx="480" cy="100" r="3"/>
          <circle cx="590" cy="70" r="3.5"/>
          <circle cx="680" cy="150" r="3"/>
          <circle cx="610" cy="250" r="2.5"/>
          <circle cx="160" cy="410" r="3"/>
          <circle cx="280" cy="360" r="3.5"/>
          <circle cx="390" cy="440" r="3"/>
          <circle cx="310" cy="530" r="2.5"/>
          <circle cx="520" cy="380" r="3"/>
          <circle cx="640" cy="330" r="3.5"/>
          <circle cx="720" cy="440" r="3"/>
          <circle cx="600" cy="510" r="2.5"/>
        </g>
      </svg>
    `)
  }
];

function compressWallpaperFile(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const BUBBLE_COLOR_PRESETS: BubbleColorPreset[] = [
  {
    id: 'indigo',
    label: 'Индиго',
    fromHex: '#4f46e5',
    toHex: '#6366f1',
    previewClass: 'bg-gradient-to-br from-indigo-600 to-indigo-500'
  },
  {
    id: 'emerald',
    label: 'Изумруд',
    fromHex: '#059669',
    toHex: '#14b8a6',
    previewClass: 'bg-gradient-to-br from-emerald-600 to-teal-500'
  },
  {
    id: 'rose',
    label: 'Неоновая роза',
    fromHex: '#e11d48',
    toHex: '#ec4899',
    previewClass: 'bg-gradient-to-br from-rose-600 to-pink-500'
  },
  {
    id: 'sky',
    label: 'Океан',
    fromHex: '#0284c7',
    toHex: '#06b6d4',
    previewClass: 'bg-gradient-to-br from-sky-600 to-cyan-500'
  },
  {
    id: 'violet',
    label: 'Аметист',
    fromHex: '#7c3aed',
    toHex: '#a855f7',
    previewClass: 'bg-gradient-to-br from-violet-600 to-purple-500'
  },
  {
    id: 'amber',
    label: 'Янтарь',
    fromHex: '#d97706',
    toHex: '#f97316',
    previewClass: 'bg-gradient-to-br from-amber-600 to-orange-500'
  },
  {
    id: 'fuchsia',
    label: 'Фуксия',
    fromHex: '#c026d3',
    toHex: '#db2777',
    previewClass: 'bg-gradient-to-br from-fuchsia-600 to-pink-600'
  },
  {
    id: 'slate',
    label: 'Графит',
    fromHex: '#334155',
    toHex: '#475569',
    previewClass: 'bg-gradient-to-br from-slate-700 to-slate-600'
  }
];

export const BG_GRADIENT_PRESETS: BgGradientPreset[] = [
  {
    id: 'default',
    label: 'Космическая ночь',
    cssBackground: 'linear-gradient(180deg, #0b1121 0%, #0b1121 100%)',
    fromHex: '#0b1121',
    toHex: '#0b1121'
  },
  {
    id: 'nebula',
    label: 'Туманность',
    cssBackground: 'linear-gradient(135deg, #130f33 0%, #1e1b4b 50%, #090d18 100%)',
    fromHex: '#130f33',
    toHex: '#1e1b4b'
  },
  {
    id: 'aurora',
    label: 'Северное сияние',
    cssBackground: 'linear-gradient(135deg, #042f2e 0%, #0f172a 55%, #1e1b4b 100%)',
    fromHex: '#042f2e',
    toHex: '#1e1b4b'
  },
  {
    id: 'sunset',
    label: 'Марсианский закат',
    cssBackground: 'linear-gradient(135deg, #2d0b1e 0%, #1c102b 55%, #0b1121 100%)',
    fromHex: '#2d0b1e',
    toHex: '#0b1121'
  },
  {
    id: 'deepsea',
    label: 'Глубокий океан',
    cssBackground: 'linear-gradient(135deg, #082f49 0%, #0f172a 55%, #020617 100%)',
    fromHex: '#082f49',
    toHex: '#020617'
  },
  {
    id: 'cyber',
    label: 'Киберпанк',
    cssBackground: 'linear-gradient(135deg, #2e1065 0%, #090d16 50%, #083344 100%)',
    fromHex: '#2e1065',
    toHex: '#083344'
  },
  {
    id: 'forest',
    label: 'Изумрудный лес',
    cssBackground: 'linear-gradient(135deg, #052e16 0%, #0f172a 60%, #020617 100%)',
    fromHex: '#052e16',
    toHex: '#020617'
  },
  {
    id: 'royal',
    label: 'Королевский пурпур',
    cssBackground: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 55%, #090d16 100%)',
    fromHex: '#3b0764',
    toHex: '#090d16'
  }
];

export function getChatBubbleStyle(theme?: ChatTheme | null): React.CSSProperties {
  if (!theme) {
    return {
      backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)'
    };
  }
  if (theme.bubbleColorId === 'custom' && theme.customBubbleHex) {
    return {
      backgroundImage: `linear-gradient(135deg, ${theme.customBubbleHex} 0%, ${theme.customBubbleHex}dd 100%)`
    };
  }
  const preset = BUBBLE_COLOR_PRESETS.find((p) => p.id === theme.bubbleColorId) || BUBBLE_COLOR_PRESETS[0];
  return {
    backgroundImage: `linear-gradient(135deg, ${preset.fromHex} 0%, ${preset.toHex} 100%)`
  };
}

export function getResolvedWallpaperUrl(theme?: ChatTheme | null): string | null {
  if (!theme) return null;
  if (theme.wallpaperId === 'none') return null;
  if (theme.wallpaperUrl) return theme.wallpaperUrl;
  if (theme.wallpaperId) {
    const preset = WALLPAPER_PRESETS.find((w) => w.id === theme.wallpaperId);
    if (preset) return preset.url;
  }
  return null;
}

export function getChatBackgroundStyle(theme?: ChatTheme | null): React.CSSProperties {
  if (!theme) {
    return {
      background: '#0b1121'
    };
  }

  const wallpaperUrl = getResolvedWallpaperUrl(theme);
  if (wallpaperUrl) {
    const dimPercent = typeof theme.wallpaperDimming === 'number' ? theme.wallpaperDimming : 40;
    const alpha = Math.min(0.9, Math.max(0, dimPercent / 100));
    return {
      backgroundImage: `linear-gradient(rgba(11, 17, 33, ${alpha}), rgba(11, 17, 33, ${alpha})), url("${wallpaperUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };
  }

  if (theme.bgGradientId === 'custom' && (theme.customBgHexFrom || theme.customBgHexTo)) {
    const from = theme.customBgHexFrom || '#0b1121';
    const to = theme.customBgHexTo || '#1e1b4b';
    return {
      backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
    };
  }
  const preset = BG_GRADIENT_PRESETS.find((p) => p.id === theme.bgGradientId) || BG_GRADIENT_PRESETS[0];
  return {
    backgroundImage: preset.cssBackground
  };
}

interface ChatThemePickerProps {
  value?: ChatTheme | null;
  onChange: (nextTheme: ChatTheme) => void;
  compact?: boolean;
}

export const ChatThemePicker: React.FC<ChatThemePickerProps> = ({
  value,
  onChange,
  compact = false
}) => {
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const currentTheme: ChatTheme = {
    bubbleColorId: value?.bubbleColorId || 'indigo',
    customBubbleHex: value?.customBubbleHex || '#4f46e5',
    bgGradientId: value?.bgGradientId || 'default',
    customBgHexFrom: value?.customBgHexFrom || '#0f172a',
    customBgHexTo: value?.customBgHexTo || '#1e1b4b',
    wallpaperId: value?.wallpaperId || 'none',
    wallpaperUrl: value?.wallpaperUrl || '',
    wallpaperDimming: typeof value?.wallpaperDimming === 'number' ? value.wallpaperDimming : 40
  };

  const activeWallpaperUrl = getResolvedWallpaperUrl(currentTheme);

  const handleSelectBubblePreset = (preset: BubbleColorPreset) => {
    onChange({
      ...currentTheme,
      bubbleColorId: preset.id,
      customBubbleHex: preset.fromHex
    });
  };

  const handleCustomBubbleColor = (hex: string) => {
    onChange({
      ...currentTheme,
      bubbleColorId: 'custom',
      customBubbleHex: hex
    });
  };

  const handleSelectBgPreset = (preset: BgGradientPreset) => {
    onChange({
      ...currentTheme,
      bgGradientId: preset.id,
      customBgHexFrom: preset.fromHex,
      customBgHexTo: preset.toHex,
      wallpaperId: 'none',
      wallpaperUrl: ''
    });
  };

  const handleCustomBgFrom = (hex: string) => {
    onChange({
      ...currentTheme,
      bgGradientId: 'custom',
      customBgHexFrom: hex,
      wallpaperId: 'none',
      wallpaperUrl: ''
    });
  };

  const handleCustomBgTo = (hex: string) => {
    onChange({
      ...currentTheme,
      bgGradientId: 'custom',
      customBgHexTo: hex,
      wallpaperId: 'none',
      wallpaperUrl: ''
    });
  };

  const handleSelectWallpaperPreset = (preset: WallpaperPreset) => {
    onChange({
      ...currentTheme,
      wallpaperId: preset.id,
      wallpaperUrl: preset.url
    });
  };

  const handleClearWallpaper = () => {
    onChange({
      ...currentTheme,
      wallpaperId: 'none',
      wallpaperUrl: ''
    });
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения');
      return;
    }
    try {
      const compressedDataUrl = await compressWallpaperFile(file);
      onChange({
        ...currentTheme,
        wallpaperId: 'custom',
        wallpaperUrl: compressedDataUrl
      });
    } catch {
      alert('Не удалось загрузить изображение обоев.');
    }
    e.target.value = '';
  };

  const handleDimmingChange = (dimming: number) => {
    onChange({
      ...currentTheme,
      wallpaperDimming: dimming
    });
  };

  const handleReset = () => {
    onChange({
      bubbleColorId: 'indigo',
      customBubbleHex: '#4f46e5',
      bgGradientId: 'default',
      customBgHexFrom: '#0b1121',
      customBgHexTo: '#0b1121',
      wallpaperId: 'none',
      wallpaperUrl: '',
      wallpaperDimming: 40
    });
  };

  return (
    <div className="space-y-4">
      {/* Live Preview */}
      <div
        className="rounded-xl p-3 border border-slate-700/80 shadow-inner transition-all space-y-2"
        style={getChatBackgroundStyle(currentTheme)}
      >
        <div className="flex items-center justify-between text-[10px] text-slate-300 uppercase tracking-wider font-semibold mb-1 bg-slate-950/50 px-2 py-1 rounded-lg backdrop-blur-xs">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Предпросмотр чата
          </span>
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors normal-case"
            title="Сбросить к стандартной теме"
          >
            <RotateCcw className="w-3 h-3" /> Сбросить всё
          </button>
        </div>

        <div className="flex justify-start">
          <div className="bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-2xl rounded-bl-none px-3 py-1.5 text-xs max-w-[75%] shadow-xs">
            Привет! Как тебе новые обои и цвета чата?
          </div>
        </div>

        <div className="flex justify-end">
          <div
            className="text-white rounded-2xl rounded-br-none px-3 py-1.5 text-xs max-w-[75%] shadow-sm"
            style={getChatBubbleStyle(currentTheme)}
          >
            Супер! Обои сохраняются отдельно для этого чата.
          </div>
        </div>
      </div>

      {/* Wallpaper / Background Image Section */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>Обои чата (фоновое фото)</span>
          </label>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => wallpaperInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-sky-200 bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 rounded-lg border border-sky-500/30 cursor-pointer transition-colors font-medium"
              title="Загрузить свое изображение для фона чата"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Загрузить фото</span>
            </button>

            {activeWallpaperUrl && (
              <button
                type="button"
                onClick={handleClearWallpaper}
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/20 cursor-pointer transition-colors"
                title="Убрать обои"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Убрать</span>
              </button>
            )}

            <input
              ref={wallpaperInputRef}
              type="file"
              accept="image/*"
              onChange={handleWallpaperUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Built-in Wallpaper Thumbnails */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={handleClearWallpaper}
            className={`h-14 rounded-xl border text-[10px] font-medium flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-slate-900/80 ${
              !activeWallpaperUrl
                ? 'border-indigo-400 ring-1 ring-indigo-400 text-white'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            <span>Без обоев</span>
          </button>

          {WALLPAPER_PRESETS.map((wp) => {
            const isSelected = currentTheme.wallpaperId === wp.id && Boolean(activeWallpaperUrl);
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => handleSelectWallpaperPreset(wp)}
                style={{
                  backgroundImage: `linear-gradient(rgba(11,17,33,0.25), rgba(11,17,33,0.55)), url("${wp.url}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
                className={`h-14 rounded-xl border p-1.5 flex flex-col justify-end text-left cursor-pointer transition-all relative overflow-hidden ${
                  isSelected
                    ? 'border-sky-400 ring-2 ring-sky-400/70 scale-[1.02] shadow-md'
                    : 'border-slate-700/80 hover:border-slate-500 opacity-85 hover:opacity-100'
                }`}
                title={wp.label}
              >
                {isSelected && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center shadow">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
                <span className="text-[9px] font-semibold text-white leading-tight truncate drop-shadow">
                  {wp.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom uploaded indicator & Dimming slider when wallpaper is active */}
        {activeWallpaperUrl && (
          <div className="pt-1 flex items-center justify-between gap-3 text-xs">
            <span className="text-[11px] text-slate-400 shrink-0">
              Затемнение фона: <strong className="text-slate-200">{currentTheme.wallpaperDimming ?? 40}%</strong>
            </span>
            <input
              type="range"
              min={0}
              max={85}
              step={5}
              value={currentTheme.wallpaperDimming ?? 40}
              onChange={(e) => handleDimmingChange(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Bubble Color Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Цвет сообщений (пузырей)
          </label>
          <label
            className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 cursor-pointer bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
            title="Выбрать произвольный цвет сообщений"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span>Свой цвет</span>
            <input
              type="color"
              value={currentTheme.customBubbleHex || '#4f46e5'}
              onChange={(e) => handleCustomBubbleColor(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
            />
          </label>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {BUBBLE_COLOR_PRESETS.map((preset) => {
            const isSelected = currentTheme.bubbleColorId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.label}
                onClick={() => handleSelectBubblePreset(preset)}
                className={`h-8 rounded-xl flex items-center justify-center text-white cursor-pointer transition-all ${preset.previewClass} ${
                  isSelected
                    ? 'ring-2 ring-white scale-105 shadow-md'
                    : 'opacity-75 hover:opacity-100'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 drop-shadow" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Background Gradient Section */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Градиент фона чата
          </label>
          <div className="flex items-center gap-1.5">
            <label
              className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
              title="Начальный цвет градиента фона"
            >
              <span>От</span>
              <input
                type="color"
                value={currentTheme.customBgHexFrom || '#0b1121'}
                onChange={(e) => handleCustomBgFrom(e.target.value)}
                className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </label>
            <label
              className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 cursor-pointer"
              title="Конечный цвет градиента фона"
            >
              <span>До</span>
              <input
                type="color"
                value={currentTheme.customBgHexTo || '#1e1b4b'}
                onChange={(e) => handleCustomBgTo(e.target.value)}
                className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </label>
          </div>
        </div>

        <div className={`grid ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
          {BG_GRADIENT_PRESETS.map((preset) => {
            const isSelected = currentTheme.bgGradientId === preset.id && !activeWallpaperUrl;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectBgPreset(preset)}
                style={{ backgroundImage: preset.cssBackground }}
                className={`px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1 ${
                  isSelected
                    ? 'border-indigo-400 ring-1 ring-indigo-400 text-white shadow-md'
                    : 'border-slate-700/80 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-[11px] font-medium truncate">{preset.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export function exportChatHistory(params: {
  chatTitle: string;
  isGroup: boolean;
  messages: Message[];
  usersMap?: Record<string, User>;
  format: 'txt' | 'json';
}) {
  const { chatTitle, isGroup, messages, usersMap = {}, format } = params;
  const safeSlug =
    (chatTitle || 'chat')
      .toLowerCase()
      .replace(/[^a-zа-яё0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'chat';
  const dateStamp = new Date().toISOString().slice(0, 10);

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  const resolveSenderName = (msg: Message) => {
    const user = usersMap[msg.senderId];
    return user?.name || msg.senderName || msg.senderId || 'Пользователь';
  };

  let content = '';
  let mimeType = 'text/plain;charset=utf-8';
  let extension = 'txt';

  if (format === 'json') {
    mimeType = 'application/json;charset=utf-8';
    extension = 'json';
    const payload = {
      chatTitle,
      chatType: isGroup ? 'group' : 'direct',
      exportedAt: new Date().toISOString(),
      messageCount: sortedMessages.length,
      messages: sortedMessages.map((m) => ({
        id: m.id,
        time: m.time,
        editedAt: m.editedAt || null,
        senderId: m.senderId,
        senderName: resolveSenderName(m),
        type: m.type,
        text: m.text || null,
        poll: m.poll || null,
        summary: m.summary || null,
        duration: m.duration || null,
        hasImage: Boolean(m.imageUrl),
        hasAudio: Boolean(m.audioUrl),
        replyTo: m.replyTo || null,
        forwardedFrom: m.forwardedFrom || null
      }))
    };
    content = JSON.stringify(payload, null, 2);
  } else {
    const headerLines = [
      `==================================================`,
      `CosmoChat — Архив переписки`,
      `Чат: ${chatTitle} (${isGroup ? 'Группа' : 'Личный диалог'})`,
      `Дата экспорта: ${new Date().toLocaleString('ru-RU')}`,
      `Всего сообщений: ${sortedMessages.length}`,
      `==================================================`,
      ``
    ];

    const bodyLines = sortedMessages.map((m) => {
      const timeFormatted = new Date(m.time).toLocaleString('ru-RU');
      const sender = resolveSenderName(m);
      const parts: string[] = [];

      if (m.forwardedFrom) {
        parts.push(`[Переслано от ${m.forwardedFrom.senderName}]`);
      }
      if (m.replyTo) {
        parts.push(`[В ответ на ${m.replyTo.senderName}: "${m.replyTo.text || m.replyTo.type || ''}"]`);
      }
      if (m.type === 'voice') {
        parts.push(
          `[Голосовое сообщение${m.duration ? `, ${m.duration} сек.` : ''}]${
            m.summary ? ` (Сводка: ${m.summary})` : ''
          }`
        );
      } else if (m.type === 'image') {
        parts.push(`[Изображение]${m.text ? ` ${m.text}` : ''}`);
      } else if (m.type === 'poll' && m.poll) {
        const opts = (m.poll.options || []).map((o) => o.text).join(' | ');
        parts.push(`[Опрос: ${m.poll.question} (${opts})]`);
      } else {
        parts.push(`${m.text || ''}${m.editedAt ? ' (изм.)' : ''}`);
      }

      return `[${timeFormatted}] ${sender}: ${parts.join(' ')}`;
    });

    content = [...headerLines, ...bodyLines].join('\n');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cosmochat_${safeSlug}_${dateStamp}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface ChatThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatTitle: string;
  isGroup: boolean;
  currentTheme?: ChatTheme | null;
  onSaveTheme: (theme: ChatTheme) => Promise<void>;
  messages?: Message[];
  usersMap?: Record<string, User>;
  initialTab?: 'settings' | 'analytics';
}

export const ChatThemeModal: React.FC<ChatThemeModalProps> = ({
  isOpen,
  onClose,
  chatTitle,
  isGroup,
  currentTheme,
  onSaveTheme,
  messages = [],
  usersMap = {},
  initialTab = 'settings'
}) => {
  const [activeModalTab, setActiveModalTab] = React.useState<'settings' | 'analytics'>(initialTab);
  const [draftTheme, setDraftTheme] = React.useState<ChatTheme>(
    currentTheme || {
      bubbleColorId: 'indigo',
      customBubbleHex: '#4f46e5',
      bgGradientId: 'default',
      customBgHexFrom: '#0b1121',
      customBgHexTo: '#0b1121',
      wallpaperId: 'none',
      wallpaperUrl: '',
      wallpaperDimming: 40
    }
  );
  const [exportFormat, setExportFormat] = React.useState<'txt' | 'json'>('txt');
  const [exportSuccess, setExportSuccess] = React.useState<string>('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab);
      setDraftTheme(
        currentTheme || {
          bubbleColorId: 'indigo',
          customBubbleHex: '#4f46e5',
          bgGradientId: 'default',
          customBgHexFrom: '#0b1121',
          customBgHexTo: '#0b1121',
          wallpaperId: 'none',
          wallpaperUrl: '',
          wallpaperDimming: 40
        }
      );
      setExportSuccess('');
    }
  }, [isOpen, currentTheme, initialTab]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveTheme(draftTheme);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportChat = (fmt: 'txt' | 'json' = exportFormat) => {
    exportChatHistory({
      chatTitle,
      isGroup,
      messages,
      usersMap,
      format: fmt
    });
    setExportSuccess(`История чата экспортирована в .${fmt.toUpperCase()}`);
    setTimeout(() => setExportSuccess(''), 3500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            {activeModalTab === 'analytics' ? (
              <BarChart3 className="w-6 h-6" />
            ) : (
              <Palette className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate">
              {activeModalTab === 'analytics'
                ? 'Analytics — Статистика чата'
                : 'Настройки, тема и экспорт чата'}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {isGroup ? `Группа «${chatTitle}»` : `Индивидуальный чат с ${chatTitle}`}
            </p>
          </div>
        </div>

        {/* Settings vs Analytics Tab Switcher */}
        <div className="flex items-center bg-slate-800/70 p-1 rounded-xl border border-slate-700/80 mb-5 text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveModalTab('settings')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeModalTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Оформление и Экспорт</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('analytics')}
            className={`flex-1 py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeModalTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics ({messages.length})</span>
          </button>
        </div>

        {activeModalTab === 'analytics' ? (
          <ChatAnalyticsPanel
            messages={messages}
            usersMap={usersMap}
            chatTitle={chatTitle}
            isGroup={isGroup}
          />
        ) : (
          <>
            <ChatThemePicker value={draftTheme} onChange={setDraftTheme} />

            {/* Export Chat Section */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Архивация и экспорт переписки</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Сообщений для выгрузки: <span className="text-white font-semibold">{messages.length}</span>
                    </p>
                  </div>

                  {/* Format Switcher */}
                  <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setExportFormat('txt')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        exportFormat === 'txt'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span>TXT</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                        exportFormat === 'json'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileJson className="w-3 h-3" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportChat(exportFormat)}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Chat (.{exportFormat.toUpperCase()})</span>
                  </button>
                </div>

                {exportSuccess && (
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{exportSuccess}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-2 pt-5 mt-5 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить настройки чата'}
          </button>
        </div>
      </div>
    </div>
  );
};
