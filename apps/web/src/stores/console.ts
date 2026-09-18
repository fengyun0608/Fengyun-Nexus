import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "@/api/client";

export type ConsoleAppearance = {
  wallpaperUrl: string;
  wallpaperFit: "cover" | "contain" | "fill";
  wallpaperDim: number;
  note?: string;
};

export const DEFAULT_WALLPAPER_URL = "/wallpapers/default.jpg";

export const useConsoleStore = defineStore("console", () => {
  const appearance = ref<ConsoleAppearance>({
    wallpaperUrl: DEFAULT_WALLPAPER_URL,
    wallpaperFit: "cover",
    wallpaperDim: 0.42,
  });
  const defaults = ref({ wallpaperUrl: DEFAULT_WALLPAPER_URL });
  const loaded = ref(false);

  const wallpaperStyle = computed(() => {
    const url = (appearance.value.wallpaperUrl || DEFAULT_WALLPAPER_URL).replace(/"/g, "");
    const fit = appearance.value.wallpaperFit || "cover";
    return {
      backgroundImage: `url("${url}")`,
      backgroundSize: fit === "fill" ? "100% 100%" : fit,
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      backgroundAttachment: "fixed",
    } as Record<string, string>;
  });

  const dimStyle = computed(() => ({
    background: `rgba(238, 248, 243, ${appearance.value.wallpaperDim ?? 0.42})`,
  }));

  async function refresh() {
    try {
      const res = await api<{
        appearance?: ConsoleAppearance;
        defaults?: { wallpaperUrl?: string };
      }>("/v1/console/appearance");
      if (res.appearance) appearance.value = { ...appearance.value, ...res.appearance };
      if (res.defaults?.wallpaperUrl) {
        defaults.value = { wallpaperUrl: res.defaults.wallpaperUrl };
      }
      loaded.value = true;
    } catch {
      appearance.value.wallpaperUrl = DEFAULT_WALLPAPER_URL;
    }
  }

  function applyLocal(next: Partial<ConsoleAppearance>) {
    appearance.value = { ...appearance.value, ...next };
  }

  return {
    appearance,
    defaults,
    loaded,
    wallpaperStyle,
    dimStyle,
    refresh,
    applyLocal,
  };
});
