import { Link, useNavigation, usePathname } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFocusEffect } from "expo-router";
import { getFavorites, toggleFavorite } from "@/db/queries";
import { useSessionStore } from "@/store/sessionStore";
import { ONBOARDING_DEFAULT_MATERIALS } from "@/onboarding/utils";
import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { NewPlayBadge } from "@/components/NewPlayBadge";
import type { MaterialSlug } from "@/constants/materials";
import {
  formatAge,
  formatDuration,
  formatPreparation,
  getMaterialStatus,
} from "@/play/presentation";
import type { Play } from "@/types";

export type IconName =
  | "flower"
  | "search"
  | "bookmark"
  | "chart"
  | "arrow"
  | "back"
  | "chevron"
  | "home"
  | "run"
  | "moon"
  | "spark"
  | "sliders"
  | "clock"
  | "timer"
  | "child"
  | "check"
  | "close"
  | "leaf"
  | "settings";

const paths: Record<Exclude<IconName, "flower">, ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  bookmark: <path d="M6 4h12v17l-6-4-6 4V4Z" />,
  chart: <path d="M5 20V11m5 9V4m5 16V8m5 12V2" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="m15 4-8 8 8 8" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  home: (
    <>
      <path d="m3 10 9-8 9 8v11h-6v-7H9v7H3V10Z" />
    </>
  ),
  run: (
    <>
      <circle cx="15" cy="4" r="2" />
      <path d="m11 8 4 3 5-1M6 10l5-2-2 6 5 3 2 5M9 14l-3 6H2" />
    </>
  ),
  moon: <path d="M20.5 13.2A9 9 0 0 1 10.8 3a9 9 0 1 0 9.7 10.2Z" />,
  spark: (
    <>
      <path d="m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8L12 3Z" />
      <path d="M20 2v4m-2-2h4" />
    </>
  ),
  sliders: (
    <>
      <path d="M3 6h6m4 0h8M3 12h11m4 0h3M3 18h3m4 0h11" />
      <circle cx="11" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M9 2h6m-3 0v5m5 2 3-3m-8 4v4l3 2" />
    </>
  ),
  child: (
    <>
      <circle cx="12" cy="5" r="3" />
      <path d="M6 21v-6a6 6 0 0 1 12 0v6M3 11v7m18-7v7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  leaf: (
    <>
      <path d="M12 21V11m0 4C4 15 3 8 3 5c6 0 9 3 9 8m0 2c8 0 9-7 9-10-6 0-9 3-9 8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m10 3-1 3-3 1-3-1-1 4 3 2v3l-2 2 3 3 3-1 3 1 1 3 4-1 1-3 2-2 3 1 1-4-3-2v-3l2-2-3-3-3 1-3-1-1-3Z" />
    </>
  ),
};

export function BrandMark({ monochrome = false }: { monochrome?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      {["#796BFF", "#FF7F89", "#FFA64F", "#7763FF", "#9B86FF"].map(
        (color, index) => (
          <ellipse
            key={color}
            cx="20"
            cy="10"
            rx="6.2"
            ry="9"
            fill={monochrome ? "currentColor" : color}
            transform={`rotate(${index * 72} 20 20)`}
          />
        ),
      )}
    </svg>
  );
}

export function Icon({
  name,
  size = 22,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  if (name === "flower")
    return (
      <span className="nori-flower-icon">
        <BrandMark monochrome />
      </span>
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function WebNavigation({
  placement,
}: {
  placement: "header" | "bottom";
}) {
  const pathname = usePathname();
  const detail =
    pathname.startsWith("/play/") || pathname.startsWith("/feedback/");
  if (placement === "bottom" && detail) return null;
  const items = [
    { href: "/", label: "발견", icon: "flower" },
    { href: "/search", label: "탐색", icon: "search" },
    { href: "/favorites", label: "저장", icon: "bookmark" },
    { href: "/record", label: "기록", icon: "chart" },
  ] as const;
  return (
    <nav className={`nori-nav nori-nav-${placement}`} aria-label="주 메뉴">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "is-active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon">
              <Icon
                name={item.icon}
                filled={active && item.icon === "bookmark"}
              />
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function useSelectedMaterials(): MaterialSlug[] {
  const todayMaterials = useSessionStore((state) => state.todayMaterials);
  const owned = useSessionStore((state) => state.userContext.ownedMaterials);
  return (
    todayMaterials ?? (owned.length ? owned : ONBOARDING_DEFAULT_MATERIALS)
  );
}

export function useWebFavorites() {
  const guestId = useSessionStore((state) => state.guestId);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (guestId)
        void getFavorites(guestId, 1000)
          .then((records) => {
            if (active) setIds(new Set(records.map((record) => record.playId)));
          })
          .catch(() => {
            if (active) setError("저장한 놀이를 불러오지 못했어요.");
          });
      return () => {
        active = false;
      };
    }, [guestId]),
  );
  async function toggle(playId: string) {
    if (!guestId || busyId) return;
    setBusyId(playId);
    setError(null);
    try {
      const saved = await toggleFavorite(guestId, playId);
      setIds((previous) => {
        const next = new Set(previous);
        if (saved) next.add(playId);
        else next.delete(playId);
        return next;
      });
    } catch {
      setError("놀이를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  }
  return { ids, toggle, busyId, error };
}

export function BookmarkButton({
  play,
  saved,
  busy,
  onToggle,
}: {
  play: Play;
  saved: boolean;
  busy?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      className={`icon-button bookmark-button ${saved ? "is-saved" : ""}`}
      type="button"
      aria-label={`${play.name} ${saved ? "저장 취소" : "저장"}`}
      aria-pressed={saved}
      disabled={busy}
      onClick={() => onToggle(play.id)}
    >
      <Icon name="bookmark" filled={saved} />
    </button>
  );
}

export function PlayCard({
  play,
  saved,
  onToggle,
  completedAt,
  materials,
  compact = false,
}: {
  play: Play;
  saved: boolean;
  onToggle: (id: string) => void;
  completedAt?: string;
  materials: MaterialSlug[];
  compact?: boolean;
}) {
  const status = getMaterialStatus(play, materials);
  return (
    <article className={`nori-play-card ${compact ? "card-compact" : ""}`}>
      <Link href={`/play/${play.id}`} className="play-card-link">
        <div className="play-card-art">
          <img
            src={`/media/thumbs/${play.id}.webp`}
            alt=""
            loading="lazy"
            decoding="async"
          />
          {completedAt ? (
            <span className="completed-badge">
              <Icon name="check" size={14} /> 완료
            </span>
          ) : null}
        </div>
        <div className="play-card-copy">
          <div className="play-card-labels">
            <span className="eyebrow">
              {DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"]} 놀이
            </span>
            <NewPlayBadge createdAt={play.createdAt} />
          </div>
          <h3>{play.name}</h3>
          <p className="card-meta">
            {formatDuration(play)} · {formatPreparation(play)}
          </p>
          <p className="card-age">{formatAge(play)}</p>
          <span className={`material-status ${status.ready ? "is-ready" : ""}`}>
            {status.label}
          </span>
        </div>
      </Link>
      <BookmarkButton play={play} saved={saved} onToggle={onToggle} />
    </article>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="nori-empty">
      <span className="empty-icon">
        <Icon name="spark" size={32} />
      </span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function PageFooter() {
  return (
    <footer className="nori-page-footer">
      아이의 속도에 맞춰, 함께하는 시간을 즐겨요.
      <br />
      <Link href="/mypage">내 설정</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/settings">이용 안내</Link>
    </footer>
  );
}

// Native tab scenes remain mounted on the web. Remove their inactive DOM so
// keyboard and screen reader navigation only encounter the current page.
export function WebPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const navigation = useNavigation();
  const [focused, setFocused] = useState(navigation.isFocused());
  const ref = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        if (ref.current) scrollPosition.current = ref.current.scrollTop;
        setFocused(false);
      };
    }, []),
  );
  useEffect(() => {
    if (focused && ref.current) ref.current.scrollTop = scrollPosition.current;
  }, [focused]);
  return focused ? (
    <div ref={ref} className={`nori-scroll-page ${className}`}>
      {children}
    </div>
  ) : null;
}
