import { WebPage } from "@/components/web/NoriUI";
import { Link } from "expo-router";
import { usePlaysStore } from "@/store/playsStore";
import {
  EmptyState,
  Icon,
  PageFooter,
  PlayCard,
  useSelectedMaterials,
  useWebFavorites,
} from "@/components/web/NoriUI";

export default function FavoritesWebScreen() {
  const favorites = useWebFavorites();
  const plays = usePlaysStore((state) => state.plays);
  const materials = useSelectedMaterials();
  const saved = [...favorites.ids].flatMap((id) =>
    plays.filter((play) => play.id === id),
  );
  return (
    <WebPage>
      <div className="nori-page">
        <header className="page-heading">
          <p className="page-kicker">다음에 또 함께하고 싶은 순간</p>
          <h1>
            저장한 놀이 <span className="heading-count">{saved.length}</span>
          </h1>
          <p>마음에 드는 놀이를 모아두고, 편할 때 꺼내보세요.</p>
        </header>
        {favorites.error ? (
          <p className="error-text" role="alert">
            {favorites.error}
          </p>
        ) : null}
        {saved.length ? (
          <div className="saved-grid">
            {saved.map((play) => (
              <PlayCard
                key={play.id}
                play={play}
                saved
                onToggle={(id) => {
                  void favorites.toggle(id);
                }}
                materials={materials}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="어떤 놀이를 함께해볼까요?">
            <p>북마크를 누르면 이곳에 놀이가 모여요.</p>
            <Link className="primary-button" href="/search">
              놀이 찾아보기
              <Icon name="arrow" size={18} />
            </Link>
          </EmptyState>
        )}
        <PageFooter />
      </div>
    </WebPage>
  );
}
