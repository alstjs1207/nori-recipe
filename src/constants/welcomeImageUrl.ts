import welcomeImageVersion from "./welcomeImageVersion.json";

export function getWelcomeImageUrl(): string {
  return `/media/welcome/hero.webp?v=${welcomeImageVersion}`;
}
