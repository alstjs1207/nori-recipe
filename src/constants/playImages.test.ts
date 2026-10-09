import assert from "node:assert/strict";
import test from "node:test";
import { loadPlaysBundle } from "@/data/content";
import { getPlayImageSource, getPlayThumbnailSource } from "./playImages.web";

test("보류·보관 놀이와 검토 중인 그림은 이미지 주소를 제공하지 않는다", () => {
  for (const play of loadPlaysBundle().plays) {
    const visible = play.status === "live" && play.imageStatus !== "review";
    assert.equal(getPlayImageSource(play.id) !== null, visible, play.id);
    assert.equal(getPlayThumbnailSource(play.id) !== null, visible, play.id);
  }
  assert.equal(getPlayImageSource("play_missing"), null);
});
