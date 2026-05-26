import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DEV_AREA_LABELS } from "@/constants/devAreas";
import { getPlayImageSource } from "@/constants/playImages";
import { APP_COLORS, APP_FONTS, APP_SHADOWS } from "@/constants/theme";
import { getFavorites } from "@/db/queries";
import { usePlaysStore } from "@/store/playsStore";
import { useSessionStore } from "@/store/sessionStore";
import type { FavoriteRecord } from "@/types";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const guestId = useSessionStore((state) => state.guestId);
  const plays = usePlaysStore((state) => state.plays);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const playMap = new Map(plays.map((play) => [play.id, play]));

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!guestId) {
        setFavorites([]);
        return () => {
          active = false;
        };
      }

      void getFavorites(guestId, 60)
        .then((records) => {
          if (active) {
            setFavorites(records);
          }
        })
        .catch(() => {
          if (active) {
            setFavorites([]);
          }
        });

      return () => {
        active = false;
      };
    }, [guestId]),
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 18 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>찜</Text>
        <Text style={styles.subtitle}>다시 해보고 싶은 놀이를 모아둡니다.</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>아직 찜한 놀이가 없어요</Text>
          <Text style={styles.emptyBody}>상세 화면에서 하트를 누르면 이곳에 저장됩니다.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {favorites.map((favorite, index) => {
            const play = playMap.get(favorite.playId);
            const imageSource = getPlayImageSource(favorite.playId);

            return (
              <Pressable
                key={favorite.id}
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(main)/play/[id]",
                    params: { id: favorite.playId },
                  })
                }
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.thumbnail,
                    index % 2 === 0 ? styles.thumbnailYellow : styles.thumbnailPink,
                  ]}
                >
                  {imageSource ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      resizeMode="cover"
                      source={imageSource}
                      style={styles.thumbnailImage}
                    />
                  ) : null}
                  <Text style={styles.heart}>♥</Text>
                </View>
                <Text style={styles.cardTitle}>{play?.name ?? favorite.playId}</Text>
                <Text style={styles.cardMeta}>
                  #{play ? DEV_AREA_LABELS[play.devAreas[0] ?? "cognitive"] : "놀이"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: APP_COLORS.background,
  },
  header: {
    gap: 5,
  },
  title: {
    color: APP_COLORS.ink,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  subtitle: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: APP_FONTS.body,
  },
  emptyCard: {
    gap: 8,
    padding: 24,
    borderRadius: 26,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.line,
    ...APP_SHADOWS.card,
  },
  emptyTitle: {
    color: APP_COLORS.ink,
    fontSize: 20,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  emptyBody: {
    color: APP_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: APP_FONTS.body,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    width: "47.8%",
    gap: 9,
  },
  pressed: {
    opacity: 0.88,
  },
  thumbnail: {
    aspectRatio: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  thumbnailYellow: {
    backgroundColor: "#FFF0AF",
  },
  thumbnailPink: {
    backgroundColor: "#FFE5E9",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  heart: {
    position: "absolute",
    right: 12,
    bottom: 10,
    color: APP_COLORS.coral,
    fontSize: 34,
    lineHeight: 36,
    textShadowColor: "rgba(0,0,0,0.14)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  cardTitle: {
    color: APP_COLORS.ink,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: APP_FONTS.heading,
    fontWeight: "600",
  },
  cardMeta: {
    color: APP_COLORS.muted,
    fontSize: 13,
    fontFamily: APP_FONTS.body,
  },
});
