// Utility to extract dominant colors from game banners for the spin wheel

interface ColorCacheEntry {
  colors: string[];
  timestamp: number;
}

const COLOR_CACHE_KEY = "suggestme_banner_colors";
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_LUMINANCE = 0.15; // Minimum luminance for visibility against dark background

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rClamped = Math.max(0, Math.min(255, Math.round(r)));
  const gClamped = Math.max(0, Math.min(255, Math.round(g)));
  const bClamped = Math.max(0, Math.min(255, Math.round(b)));
  return `#${rClamped.toString(16).padStart(2, "0")}${gClamped.toString(16).padStart(2, "0")}${bClamped.toString(16).padStart(2, "0")}`;
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const { r, g, b } = rgb;
  const rsRGB = r / 255;
  const gsRGB = g / 255;
  const bsRGB = b / 255;
  const rLinear = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const gLinear = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const bLinear = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

function lightenColor(hex: string, targetLuminance: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  let { r, g, b } = rgb;
  let currentLuminance = getLuminance(hex);
  
  // Iteratively lighten until we reach target luminance
  let iterations = 0;
  while (currentLuminance < targetLuminance && iterations < 20) {
    const factor = 1.15; // Lighten by 15% each iteration
    r = Math.min(255, r * factor + 20);
    g = Math.min(255, g * factor + 20);
    b = Math.min(255, b * factor + 20);
    currentLuminance = getLuminance(rgbToHex(r, g, b));
    iterations++;
  }
  
  return rgbToHex(r, g, b);
}

function ensureMinLuminance(hex: string): string {
  const luminance = getLuminance(hex);
  if (luminance < MIN_LUMINANCE) {
    return lightenColor(hex, MIN_LUMINANCE);
  }
  return hex;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

export function getHue(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return rgbToHsl(rgb.r, rgb.g, rgb.b).h;
}

interface BannerColorCache {
  [appid: number]: ColorCacheEntry;
}

function getColorCache(): BannerColorCache {
  try {
    const cached = localStorage.getItem(COLOR_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore cache errors
  }
  return {};
}

function saveColorCache(cache: BannerColorCache): void {
  try {
    localStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // Ignore cache errors
  }
}

function isCacheValid(entry: ColorCacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_EXPIRY_MS;
}

/**
 * Extract dominant colors from an image using canvas
 * Sample pixels and find most common colors
 */
async function extractColorsFromImage(imageUrl: string, count: number = 3): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve([]);
          return;
        }

        // Resize for faster processing
        const maxSize = 150;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Sample pixels at grid points
        const colorMap = new Map<string, number>();
        const sampleStep = 5;

        for (let y = 0; y < canvas.height; y += sampleStep) {
          for (let x = 0; x < canvas.width; x += sampleStep) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const [r, g, b] = pixel;

            // Skip very dark or very light pixels (likely background)
            const brightness = (r + g + b) / 3;
            if (brightness < 20 || brightness > 240) continue;

            // Quantize colors to reduce variations
            const quantized = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
            colorMap.set(quantized, (colorMap.get(quantized) || 0) + 1);
          }
        }

        // Sort by frequency and get top colors, ensuring minimum luminance
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, count)
          .map(([color]) => {
            const [r, g, b] = color.split(",").map(Number);
            const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            return ensureMinLuminance(hex);
          });

        resolve(sortedColors.length > 0 ? sortedColors : ["#4488aa", "#aa8866", "#88aa88"]);
      } catch (e) {
        resolve(["#4488aa", "#aa8866", "#88aa88"]);
      }
    };

    img.onerror = () => {
      resolve(["#4488aa", "#aa8866", "#88aa88"]);
    };

    img.src = imageUrl;
  });
}

/**
 * Get dominant colors for a game banner
 * Uses cache to avoid re-processing the same images
 */
export async function getBannerColors(appid: number): Promise<string[]> {
  const cache = getColorCache();
  const cached = cache[appid];

  if (cached && isCacheValid(cached)) {
    // Validate cached colors and ensure minimum luminance
    const validColors = cached.colors
      .filter(c => c && c.startsWith('#') && c.length === 7)
      .map(c => ensureMinLuminance(c));
    if (validColors.length > 0) {
      return validColors;
    }
  }

  const headerUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;
  const colors = await extractColorsFromImage(headerUrl, 3);

  // Validate extracted colors
  const validColors = colors.filter(c => c && c.startsWith('#') && c.length === 7);
  const finalColors = validColors.length > 0 ? validColors : ["#4488aa", "#aa8866", "#88aa88"];

  // Cache the result
  cache[appid] = {
    colors: finalColors,
    timestamp: Date.now(),
  };
  saveColorCache(cache);

  return finalColors;
}

/**
 * Get colors for multiple games, with a limit to prevent too many concurrent requests
 */
export async function getBannerColorsForGames(appids: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  const cache = getColorCache();

  // Check cache first, validating colors and enforcing luminance
  const missingAppids: number[] = [];
  for (const appid of appids) {
    const cached = cache[appid];
    if (cached && isCacheValid(cached)) {
      const validColors = cached.colors
        .filter(c => c && c.startsWith('#') && c.length === 7)
        .map(c => ensureMinLuminance(c));
      if (validColors.length > 0) {
        result.set(appid, validColors);
      } else {
        missingAppids.push(appid);
      }
    } else {
      missingAppids.push(appid);
    }
  }

  // Fetch missing colors in batches to avoid overwhelming the browser
  const batchSize = 5;
  for (let i = 0; i < missingAppids.length; i += batchSize) {
    const batch = missingAppids.slice(i, i + batchSize);
    const batchPromises = batch.map(async (appid) => {
      const colors = await getBannerColors(appid);
      result.set(appid, colors);
    });
    await Promise.all(batchPromises);

    // Small delay between batches
    if (i + batchSize < missingAppids.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return result;
}

/**
 * Clear the color cache
 */
export function clearBannerColorCache(): void {
  try {
    localStorage.removeItem(COLOR_CACHE_KEY);
  } catch (e) {
    // Ignore
  }
}
