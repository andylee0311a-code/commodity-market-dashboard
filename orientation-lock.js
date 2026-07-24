/* Lock supported mobile browsers to landscape while the chart is fullscreen. */
(() => {
  const chartCard = document.querySelector(".chart-card");
  const fullscreenButton = document.getElementById("fullscreenChart");

  if (!chartCard || !fullscreenButton) return;

  let orientationWasLocked = false;
  let lockInProgress = false;

  const isNativeFullscreen = () => (
    document.fullscreenElement === chartCard
    || document.webkitFullscreenElement === chartCard
  );

  const isChartFullscreen = () => (
    isNativeFullscreen()
    || chartCard.classList.contains("pseudo-fullscreen")
  );

  async function lockLandscape() {
    if (!isChartFullscreen() || lockInProgress) return;

    const orientation = window.screen?.orientation;
    if (!orientation?.lock) return;

    lockInProgress = true;

    try {
      try {
        await orientation.lock("landscape-primary");
      } catch (primaryError) {
        await orientation.lock("landscape");
      }
      orientationWasLocked = true;
    } catch (error) {
      console.debug("Landscape orientation lock is unavailable in this browser.", error);
    } finally {
      lockInProgress = false;
    }
  }

  function unlockOrientation() {
    const orientation = window.screen?.orientation;

    if (orientationWasLocked && orientation?.unlock) {
      try {
        orientation.unlock();
      } catch (error) {
        console.debug("Unable to release the screen orientation lock.", error);
      }
    }

    orientationWasLocked = false;
    lockInProgress = false;
  }

  function syncOrientation() {
    window.setTimeout(() => {
      if (isChartFullscreen()) {
        lockLandscape();
      } else {
        unlockOrientation();
      }
    }, 80);
  }

  document.addEventListener("fullscreenchange", syncOrientation);
  document.addEventListener("webkitfullscreenchange", syncOrientation);
  fullscreenButton.addEventListener("click", syncOrientation);

  const pseudoFullscreenObserver = new MutationObserver(syncOrientation);
  pseudoFullscreenObserver.observe(chartCard, {
    attributes: true,
    attributeFilter: ["class"],
  });

  window.addEventListener("pagehide", unlockOrientation);
})();
