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
      // A failed first install must not leave the UI waiting forever or claim
      // readiness. An existing active worker still provides its previous shell.
      await new Promise((resolve, reject) => {
        const installing = registration.installing;
        const onState = () => {
          if (installing.state === "redundant" && !registration.active) {
            installing.removeEventListener("statechange", onState);
            reject(new Error("offline shell installation failed"));
          }
        };
        if (installing) {
          installing.addEventListener("statechange", onState);
          onState();
        }
        navigator.serviceWorker.ready.then((value) => {
          installing?.removeEventListener("statechange", onState);
          resolve(value);
        }, reject);
      });
      window.dispatchEvent(new Event("nori:offline-ready"));
      // Updates are applied only when the user presses '새 버전 열기'.
    } catch {
      window.dispatchEvent(new Event(navigator.serviceWorker.controller ? "nori:offline-ready" : "nori:offline-error"));
      // Browsing remains available when installation/caching is unsupported.
    }
  });
}
