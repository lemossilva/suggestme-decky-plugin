import { useState, useCallback } from "react";
import { FaSteam, FaGamepad } from "react-icons/fa";
import { getGameImageUrls, ImageAspect, GameImageOptions } from "./gameImages";

export interface GameImageProps extends GameImageOptions {
  aspect?: ImageAspect;
  style?: React.CSSProperties;
  className?: string;
  showPlaceholder?: boolean;
  placeholderIcon?: 'steam' | 'gamepad';
  placeholderBg?: string;
  onError?: () => void;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
}

export function GameImage({
  appid,
  isNonSteam,
  matchedAppid,
  imgIconUrl,
  aspect = 'landscape',
  style,
  className,
  showPlaceholder = true,
  placeholderIcon = 'steam',
  placeholderBg,
  onError,
  objectFit = 'cover',
}: GameImageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const urls = getGameImageUrls({
    appid,
    isNonSteam,
    matchedAppid,
    imgIconUrl,
    aspect,
  });

  const handleError = useCallback(() => {
    if (currentIndex < urls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFailed(true);
      onError?.();
    }
  }, [currentIndex, urls.length, onError]);



  if (failed || urls.length === 0) {
    if (!showPlaceholder) return null;

    const bg = placeholderBg || (isNonSteam ? "#aa886622" : "#4488aa22");
    const iconColor = isNonSteam ? "#aa8866" : "#4488aa";
    const Icon = placeholderIcon === 'gamepad' ? FaGamepad : FaSteam;

    return (
      <div
        style={{
          ...style,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} style={{ color: iconColor }} />
      </div>
    );
  }

  return (
    <img
      src={urls[currentIndex]}
      alt=""
      className={className}
      style={{
        ...style,
        objectFit,
        objectPosition: "center",
      }}
      onError={handleError}
    />
  );
}

export interface FallbackImageProps {
  src: string;
  fallbackUrls?: string[];
  style?: React.CSSProperties;
  placeholderStyle?: React.CSSProperties;
  showPlaceholder?: boolean;
  placeholderIcon?: 'steam' | 'gamepad';
  isNonSteam?: boolean;
}

export function FallbackImage({
  src,
  fallbackUrls = [],
  style,
  placeholderStyle,
  showPlaceholder = true,
  placeholderIcon = 'steam',
  isNonSteam = false,
}: FallbackImageProps) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const allUrls = [src, ...fallbackUrls];

  const handleError = useCallback(() => {
    if (urlIndex < allUrls.length - 1) {
      setUrlIndex(urlIndex + 1);
    } else {
      setFailed(true);
    }
  }, [urlIndex, allUrls.length]);

  if (failed) {
    if (!showPlaceholder) return null;

    const bg = isNonSteam ? "#aa886622" : "#4488aa22";
    const iconColor = isNonSteam ? "#aa8866" : "#4488aa";
    const Icon = placeholderIcon === 'gamepad' ? FaGamepad : FaSteam;

    return (
      <div
        style={{
          ...style,
          ...placeholderStyle,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={14} style={{ color: iconColor }} />
      </div>
    );
  }

  return (
    <img
      src={allUrls[urlIndex]}
      alt=""
      style={style}
      onError={handleError}
    />
  );
}
