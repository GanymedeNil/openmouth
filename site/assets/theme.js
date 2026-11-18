// Apply a saved light/dark choice before the page paints; without one the page follows the system.
try {
  var saved = localStorage.getItem('om-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
} catch (e) {}
document.documentElement.classList.add('js');
