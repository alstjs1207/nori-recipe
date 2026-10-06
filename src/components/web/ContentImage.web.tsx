import { useEffect, useState } from "react";
import { Image, type ImageProps, StyleSheet, Text, View } from "react-native";

export function ContentImage({ source, style, resizeMode = "cover", accessibilityLabel }: ImageProps) {
  const candidate = Array.isArray(source) ? source[0] : source;
  const uri = typeof candidate === "number" ? Image.resolveAssetSource(candidate)?.uri : candidate?.uri;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={[style, { overflow: "hidden" }]}>
      {uri && !failed ? <img src={uri} alt={accessibilityLabel ?? ""} loading="lazy" decoding="async" onError={() => setFailed(true)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: resizeMode === "contain" ? "contain" : resizeMode === "stretch" ? "fill" : "cover" }} /> : <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "#FFF3D9" }]}><Text style={{ fontSize: 12, color: "#887754" }}>🧸</Text></View>}
    </View>
  );
}
