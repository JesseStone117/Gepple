(function () {
  const MANIFEST_PATH = "manifest.json";
  const CACHE_PREFIX = "gepple-assets-";
  const DEFAULT_MANIFEST = {
    version: "dev",
    checkIntervalMs: 4000,
    styles: ["styles.css"],
    scripts: [
      "src/characters.js",
      "src/randomMap.js",
      "src/audioManager.js",
      "src/controllerManager.js",
      "src/game.js",
      "src/main.js",
    ],
  };

  function getCacheBustedPath(path, version) {
    const separator = path.includes("?") ? "&" : "?";
    return path + separator + "v=" + encodeURIComponent(version);
  }

  function getManifestPath() {
    return MANIFEST_PATH + "?check=" + Date.now();
  }

  function mergeManifest(manifest) {
    if (!manifest || typeof manifest !== "object") {
      return DEFAULT_MANIFEST;
    }

    return {
      version: manifest.version || DEFAULT_MANIFEST.version,
      checkIntervalMs: manifest.checkIntervalMs || DEFAULT_MANIFEST.checkIntervalMs,
      styles: Array.isArray(manifest.styles) ? manifest.styles : DEFAULT_MANIFEST.styles,
      scripts: Array.isArray(manifest.scripts) ? manifest.scripts : DEFAULT_MANIFEST.scripts,
    };
  }

  async function fetchManifest() {
    const response = await fetch(getManifestPath(), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not load " + MANIFEST_PATH + ".");
    }

    return mergeManifest(await response.json());
  }

  async function fetchTextAsset(path, version) {
    const assetPath = getCacheBustedPath(path, version);
    const response = await fetch(assetPath, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not load " + path + ".");
    }

    return response.text();
  }

  async function loadStyle(path, version) {
    try {
      const css = await fetchTextAsset(path, version);
      const style = document.createElement("style");
      style.setAttribute("data-gepple-style", path);
      style.textContent = css;
      document.head.appendChild(style);
      return;
    } catch (error) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = getCacheBustedPath(path, version);
      document.head.appendChild(link);
    }
  }

  async function loadScript(path, version) {
    const scriptText = await fetchTextAsset(path, version);
    const script = document.createElement("script");
    script.textContent = scriptText + "\n//# sourceURL=" + getCacheBustedPath(path, version);
    document.body.appendChild(script);
  }

  async function loadStyles(styles, version) {
    const styleLoads = styles.map(function mapStyle(path) {
      return loadStyle(path, version);
    });

    await Promise.all(styleLoads);
  }

  async function loadScripts(scripts, version) {
    for (const script of scripts) {
      await loadScript(script, version);
    }
  }

  async function deleteOldManagedCaches(version) {
    if (!window.caches) {
      return;
    }

    const activeCacheName = CACHE_PREFIX + version;
    const cacheNames = await window.caches.keys();

    await Promise.all(
      cacheNames.map(function deleteOldCache(cacheName) {
        if (!cacheName.startsWith(CACHE_PREFIX)) {
          return Promise.resolve(false);
        }

        if (cacheName === activeCacheName) {
          return Promise.resolve(false);
        }

        return window.caches.delete(cacheName);
      })
    );
  }

  function saveActiveVersion(version) {
    try {
      window.localStorage.setItem("gepple-active-version", version);
    } catch (error) {
    }
  }

  function getReloadUrl(version) {
    const url = new URL(window.location.href);
    url.searchParams.set("geppleVersion", version);
    return url.toString();
  }

  function announceReload(version) {
    const game = window.GeppleGameInstance;

    if (!game || typeof game.pushToast !== "function") {
      return;
    }

    game.pushToast("Update " + version + " found. Reloading Gepple...");
  }

  function reloadIntoVersion(version) {
    announceReload(version);

    window.setTimeout(function reloadAfterToast() {
      window.location.replace(getReloadUrl(version));
    }, 800);
  }

  async function checkForUpdate(currentVersion) {
    let manifest = null;

    try {
      manifest = await fetchManifest();
    } catch (error) {
      return;
    }

    if (manifest.version === currentVersion) {
      return;
    }

    await deleteOldManagedCaches(manifest.version);
    saveActiveVersion(manifest.version);
    reloadIntoVersion(manifest.version);
  }

  function startUpdateChecks(manifest) {
    const intervalMs = Math.max(1000, manifest.checkIntervalMs || DEFAULT_MANIFEST.checkIntervalMs);

    window.setInterval(function checkOnInterval() {
      checkForUpdate(manifest.version);
    }, intervalMs);

    document.addEventListener("visibilitychange", function checkWhenVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }

      checkForUpdate(manifest.version);
    });
  }

  function showBootError(error) {
    const message = document.createElement("pre");
    message.style.cssText =
      "margin:24px;padding:18px;border-radius:14px;background:#2b0d16;color:#fff2f2;white-space:pre-wrap;";
    message.textContent = "Gepple could not start.\n\n" + error.message;
    document.body.appendChild(message);
  }

  async function boot() {
    let manifest = DEFAULT_MANIFEST;

    try {
      manifest = await fetchManifest();
    } catch (error) {
      manifest = DEFAULT_MANIFEST;
    }

    window.GeppleAppVersion = manifest.version;
    window.GeppleAssetPath = function getVersionedAssetPath(path) {
      return getCacheBustedPath(path, manifest.version);
    };

    saveActiveVersion(manifest.version);
    await deleteOldManagedCaches(manifest.version);
    await loadStyles(manifest.styles, manifest.version);
    await loadScripts(manifest.scripts, manifest.version);
    startUpdateChecks(manifest);
  }

  boot().catch(showBootError);
})();
