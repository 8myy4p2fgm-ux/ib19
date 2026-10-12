
// Close the group explanation when clicking anywhere outside it.
document.addEventListener('pointerdown', function(event) {
  const panel = document.querySelector('#home details.group-info');
  if (panel && panel.open && !panel.contains(event.target)) panel.open = false;
});
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const panel = document.querySelector('#home details.group-info');
    if (panel && panel.open) panel.open = false;
  }
});
