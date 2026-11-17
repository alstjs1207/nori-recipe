import { useState, type ImgHTMLAttributes } from "react";
import { DEFAULT_PLAY_IMAGE } from "@/constants/playImageManifest";
import { appRuntime } from "@/platform/runtime";

export function PlayImage({ src, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const displayed = !src || failedSource === src ? DEFAULT_PLAY_IMAGE : src;
  return <><img {...props} src={displayed} crossOrigin="anonymous" onError={(event) => {
    if (displayed !== DEFAULT_PLAY_IMAGE) setFailedSource(src);
    onError?.(event);
  }} />{appRuntime.target === "toss" && displayed !== DEFAULT_PLAY_IMAGE ? <span className="toss-ai-label">AI 삽화</span> : null}</>;
}
