// Shared utility for displaying game metadata (size, purchase date, release date) in list views
import { FaHdd, FaCalendarAlt, FaShoppingCart } from "react-icons/fa";

interface GameInfo {
  size_on_disk?: number;
  rtime_purchased?: number;
  release_date?: number;
}

export function formatSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

export function formatDate(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return "";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface GameMetadataRowProps {
  game: GameInfo;
  scale?: (n: number) => number;
}

export function GameMetadataRow({ game, scale }: GameMetadataRowProps) {
  const s = scale || ((n) => n);
  const sizeStr = formatSize(game.size_on_disk);
  const purchaseStr = formatDate(game.rtime_purchased);
  const releaseStr = formatDate(game.release_date);

  if (!sizeStr && !purchaseStr && !releaseStr) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: s(12),
        flexWrap: "wrap",
        fontSize: s(10),
        color: "#888",
        marginTop: s(4),
      }}
    >
      {sizeStr && (
        <span style={{ display: "flex", alignItems: "center", gap: s(4) }}>
          <FaHdd size={s(8)} style={{ color: "#88aabb" }} />
          {sizeStr}
        </span>
      )}
      {purchaseStr && (
        <span style={{ display: "flex", alignItems: "center", gap: s(4) }}>
          <FaShoppingCart size={s(8)} style={{ color: "#88bb88" }} />
          {purchaseStr}
        </span>
      )}
      {releaseStr && (
        <span style={{ display: "flex", alignItems: "center", gap: s(4) }}>
          <FaCalendarAlt size={s(8)} style={{ color: "#bb88aa" }} />
          {releaseStr}
        </span>
      )}
    </div>
  );
}

// Component that displays release date only (for HistoryModal)
interface ReleaseDateOnlyProps {
  release_date?: number;
  scale?: (n: number) => number;
}

export function ReleaseDateOnly({ release_date, scale }: ReleaseDateOnlyProps) {
  const s = scale || ((n) => n);
  const releaseStr = formatDate(release_date);

  if (!releaseStr) {
    return null;
  }

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: s(4),
        fontSize: s(10),
        color: "#888",
      }}
    >
      <FaCalendarAlt size={s(8)} style={{ color: "#bb88aa" }} />
      {releaseStr}
    </span>
  );
}

