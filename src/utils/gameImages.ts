export type ImageAspect = 'landscape' | 'portrait' | 'square';

export interface GameImageOptions {
  appid: number;
  isNonSteam?: boolean;
  matchedAppid?: number | null;
  imgIconUrl?: string;
  aspect?: ImageAspect;
}

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const STEAM_MEDIA = 'https://media.steampowered.com/steamcommunity/public/images/apps';
const STEAM_AKAMAI = 'https://steamcdn-a.akamaihd.net/steam/apps';

export function getEffectiveAppId(options: GameImageOptions): number {
  if (options.isNonSteam && options.matchedAppid) {
    return options.matchedAppid;
  }
  return options.appid;
}

export function getGameImageUrls(options: GameImageOptions): string[] {
  const appid = getEffectiveAppId(options);
  if (!appid) return [];

  const aspect = options.aspect || 'landscape';
  const urls: string[] = [];

  switch (aspect) {
    case 'landscape':
      // header.jpg (460×215)
      urls.push(`${STEAM_AKAMAI}/${appid}/header.jpg`);
      urls.push(`${STEAM_CDN}/${appid}/header.jpg`);
      // hero_capsule (616×353)
      urls.push(`${STEAM_CDN}/${appid}/hero_capsule.jpg`);
      // Last resort (467×181)
      urls.push(`${STEAM_CDN}/${appid}/capsule_467x181.jpg`);
      break;

    case 'portrait':
      // @1x portrait (600×900)
      urls.push(`${STEAM_CDN}/${appid}/library_600x900.jpg`);
      // @2x portrait (1200×1800)
      urls.push(`${STEAM_CDN}/${appid}/library_600x900_2x.jpg`);
      // Fallback
      urls.push(`${STEAM_AKAMAI}/${appid}/header.jpg`);
      break;

    case 'square':
      urls.push(`${STEAM_CDN}/${appid}/capsule_sm_120.jpg`);
      if (options.imgIconUrl) {
        urls.push(`${STEAM_MEDIA}/${appid}/${options.imgIconUrl}.jpg`);
      }
      break;
  }

  return urls;
}

export function getGameIconUrl(game: { appid: number; is_non_steam?: boolean; matched_appid?: number | null; img_icon_url?: string }): string | null {
  const appid = getEffectiveAppId({
    appid: game.appid,
    isNonSteam: game.is_non_steam,
    matchedAppid: game.matched_appid,
  });
  if (!appid) return null;

  if (game.is_non_steam) {
    return `${STEAM_CDN}/${appid}/capsule_sm_120.jpg`;
  }
  if (game.img_icon_url) {
    return `${STEAM_MEDIA}/${appid}/${game.img_icon_url}.jpg`;
  }
  return `${STEAM_CDN}/${appid}/capsule_sm_120.jpg`;
}

export function getLandscapeUrl(appid: number): string {
  return `${STEAM_CDN}/${appid}/hero_capsule.jpg`;
}

export function getCapsuleUrl(appid: number, size: 'sm' | 'md' | 'lg' = 'md'): string {
  switch (size) {
    case 'sm': return `${STEAM_CDN}/${appid}/capsule_184x69.jpg`;
    case 'md': return `${STEAM_CDN}/${appid}/capsule_231x87.jpg`;
    case 'lg': return `${STEAM_CDN}/${appid}/capsule_467x181.jpg`; 
  }
}

export function getPortraitUrl(appid: number): string {
  return `${STEAM_CDN}/${appid}/library_600x900_2x.jpg`; 
}
