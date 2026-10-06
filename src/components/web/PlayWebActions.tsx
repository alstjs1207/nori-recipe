import type { ReactNode } from "react";
import type { Play } from "@/types";

export function PlayWebActionsProvider({ children }: { play?: Play; children: ReactNode }) { return <>{children}</>; }
export function PlayShareButton() { return null; }
