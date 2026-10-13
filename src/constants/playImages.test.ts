import assert from "node:assert/strict";
import test from "node:test";
import { loadPlaysBundle } from "@/data/content";
import { getPlayImageSource, getPlayThumbnailSource } from "./playImages.web";
import { getPlayImageUrl } from "./playImageUrls";

test("보류·보관 놀이와 검토 중인 그림은 이미지 주소를 제공하지 않는다", () => {
  for (const play of loadPlaysBundle().plays) {
    const visible = play.status === "live" && play.imageStatus !== "review";
    assert.equal(getPlayImageSource(play.id) !== null, visible, play.id);
    assert.equal(getPlayThumbnailSource(play.id) !== null, visible, play.id);
  }
  assert.equal(getPlayImageSource("play_missing"), null);
});

test("교체한 놀이의 상세와 썸네일은 이미지 버전이 포함된 주소를 공유한다", () => {
  for (const id of ["play_006", "play_076", "play_130"]) {
    const detail = new URL(getPlayImageUrl(id), "http://localhost");
    const thumbnail = new URL(getPlayImageUrl(id, "thumbnail"), "http://localhost");
    assert.match(detail.searchParams.get("v") ?? "", /^[a-f0-9]{12}$/);
    assert.equal(thumbnail.searchParams.get("v"), detail.searchParams.get("v"));
    assert.equal(detail.pathname, `/media/plays/${id}.webp`);
    assert.equal(thumbnail.pathname, `/media/thumbs/${id}.webp`);
    assert.deepEqual(getPlayImageSource(id), { uri: detail.pathname + detail.search });
    assert.deepEqual(getPlayThumbnailSource(id), { uri: thumbnail.pathname + thumbnail.search });
  }
});
