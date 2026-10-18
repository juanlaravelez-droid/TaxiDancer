(() => {
  const appUrl = (window.BOOKING_APP_URL || '').trim();
  const calendar = document.getElementById('bookingCalendar');
  const loading = calendar?.querySelector('.calendar-loading');
  const fallback = document.getElementById('googleCalendarFallback');
  const note = document.querySelector('.cal-note');
  if (!calendar || !loading || !fallback) return;

  const isAppsScriptUrl = (() => {
    try {
      const url = new URL(appUrl);
      return url.protocol === 'https:'
        && url.hostname === 'script.google.com'
        && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
    } catch {
      return false;
    }
  })();

  if (!appUrl) {
    loading.hidden = true;
    fallback.hidden = false;
    return;
  }

  if (!isAppsScriptUrl) {
    console.error('BOOKING_APP_URL debe ser la URL /exec de una implementación de Google Apps Script.');
    loading.hidden = true;
    fallback.hidden = false;
    return;
  }

  if (note) {
    note.textContent = 'La agenda consulta la disponibilidad en Google Calendar. Las solicitudes se registran como eventos privados pendientes de confirmación.';
  }

  const frame = document.createElement('iframe');
  frame.className = 'custom-calendar-frame';
  frame.title = 'Calendario personalizado de reservas conectado a Google Calendar';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.src = appUrl;
  frame.addEventListener('load', () => {
    loading.hidden = true;
    frame.hidden = false;
    fallback.hidden = true;
    frame.contentWindow.postMessage({ type: 'juan-lara-booking-init' }, '*');
  }, { once: true });
  calendar.appendChild(frame);

  const openLink = document.createElement('a');
  openLink.className = 'calendar-fallback-link';
  openLink.href = appUrl;
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  openLink.textContent = 'Abrir la agenda en otra pestaña';
  calendar.appendChild(openLink);
})();
