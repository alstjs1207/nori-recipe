import { IBMPlexSansKR_400Regular } from "@expo-google-fonts/ibm-plex-sans-kr/400Regular";
import { IBMPlexSansKR_600SemiBold } from "@expo-google-fonts/ibm-plex-sans-kr/600SemiBold";
import { IBMPlexSansKR_700Bold } from "@expo-google-fonts/ibm-plex-sans-kr/700Bold";
import { useFonts } from "expo-font";

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    IBMPlexSansKR_400Regular,
    IBMPlexSansKR_600SemiBold,
    IBMPlexSansKR_700Bold,
  });
  return loaded;
}
