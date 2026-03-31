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
      // Capsule images (landscape ~460x215 or ~231x87)
      urls.push(`${STEAM_CDN}/${appid}/capsule_231x87.jpg`);
      urls.push(`${STEAM_CDN}/${appid}/capsule_184x69.jpg`);
      urls.push(`${STEAM_AKAMAI}/${appid}/header.jpg`);
      // Library hero (wide banner)
      urls.push(`${STEAM_CDN}/${appid}/library_hero.jpg`);
      break;

    case 'portrait':
      // Library capsule (portrait ~600x900)
      urls.push(`${STEAM_CDN}/${appid}/library_600x900.jpg`);
      urls.push(`${STEAM_CDN}/${appid}/library_600x900_2x.jpg`);
      // Fallback to landscape capsules (will be cropped)
      urls.push(`${STEAM_CDN}/${appid}/capsule_231x87.jpg`);
      break;

    case 'square':
      // Small capsule
      urls.push(`${STEAM_CDN}/${appid}/capsule_sm_120.jpg`);
      // Icon from img_icon_url
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
  return `${STEAM_AKAMAI}/${appid}/header.jpg`;
}

export function getCapsuleUrl(appid: number, size: 'sm' | 'md' | 'lg' = 'md'): string {
  switch (size) {
    case 'sm': return `${STEAM_CDN}/${appid}/capsule_184x69.jpg`;
    case 'md': return `${STEAM_CDN}/${appid}/capsule_231x87.jpg`;
    case 'lg': return `${STEAM_CDN}/${appid}/capsule_616x353.jpg`;
  }
}

export function getPortraitUrl(appid: number): string {
  return `${STEAM_CDN}/${appid}/library_600x900.jpg`;
}
