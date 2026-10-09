import { useIsNewPlay } from "@/hooks/useIsNewPlay";

export function NewPlayBadge({ createdAt }: { createdAt?: string }) {
  if (!useIsNewPlay(createdAt)) return null;
  return (
    <span className="new-play-badge" aria-label="새로 추가된 놀이">
      NEW
    </span>
  );
}
