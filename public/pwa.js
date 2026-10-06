if ("serviceWorker" in navigator && window.isSecureContext && document.querySelector('script[src*="/_expo/static/js/web/"]')) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const announceUpdate = () => {
        if (registration.waiting) window.dispatchEvent(new CustomEvent("nori:update-ready", { detail: registration.waiting }));
      };
      announceUpdate();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
        });
      });
      await navigator.serviceWorker.ready;
      window.dispatchEvent(new Event("nori:offline-ready"));
      // Updates are applied only when the user presses '새 버전 열기'.
    } catch {
      // Browsing remains available when installation/caching is unsupported.
    }
  });
}
