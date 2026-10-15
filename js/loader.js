// Show the carrot only if preparing analytics takes perceptible time.
(() => {
  const loader = document.getElementById('carrot-loader');
  let settled = false;
  const showTimer = setTimeout(() => {
    if (!settled) loader.classList.add('is-visible');
  }, 300);
  window.ib19Loader = {
    ready() {
      if (settled) return;
      settled = true;
      clearTimeout(showTimer);
      if (!loader.classList.contains('is-visible')) return loader.remove();
      loader.classList.add('is-hidden');
      setTimeout(() => loader.remove(), 180);
    }
  };
})();
