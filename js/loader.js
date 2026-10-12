// Start the minimum display time immediately; data loading runs independently.
(() => {
  const started = performance.now();
  const loader = document.getElementById('carrot-loader');
  let settled = false;
  window.ib19Loader = {
    ready() {
      if (settled) return;
      settled = true;
      const remaining = Math.max(0, 2000 - (performance.now() - started));
      setTimeout(() => {
        loader.classList.add('is-hidden');
        setTimeout(() => loader.remove(), 350);
      }, remaining);
    }
  };
})();
