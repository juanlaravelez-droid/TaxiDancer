(() => {
  const cursor = document.getElementById('cursor');
  const cursorRing = document.getElementById('ring');
  const canUseCustomCursor = window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (cursor && cursorRing && canUseCustomCursor) {
    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    document.addEventListener('mousemove', event => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursor.style.left = `${mouseX}px`;
      cursor.style.top = `${mouseY}px`;
    });

    function followPointer() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      cursorRing.style.left = `${ringX}px`;
      cursorRing.style.top = `${ringY}px`;
      window.requestAnimationFrame(followPointer);
    }
    window.requestAnimationFrame(followPointer);
  }

  const contactForm = document.getElementById('contactForm');
  const toast = document.getElementById('toast');
  const currentYear = document.getElementById('currentYear');
  let toastTimeout;

  if (currentYear) currentYear.textContent = String(new Date().getFullYear());

  if (contactForm) {
    contactForm.addEventListener('submit', event => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const value = name => String(formData.get(name) || '').trim();
      const message = [
        `¡Hola! Me llamo ${value('nombre')} (${value('telefono')}).`,
        '',
        `📅 Evento: ${value('evento') || 'Por definir'}`,
        `💃 Ritmo: ${value('ritmo') || 'A convenir'}`,
        `🗓 Fecha: ${value('fecha') || 'Por confirmar'}`,
        `📍 Ciudad: ${value('ciudad') || 'Por definir'}`,
        `📝 Detalles: ${value('detalles') || 'Sin detalles adicionales'}`
      ].join('\n');
      const whatsappUrl = new URL('https://wa.me/573206548796');
      whatsappUrl.searchParams.set('text', message);
      whatsappUrl.searchParams.set('utm_source', 'website');
      whatsappUrl.searchParams.set('utm_medium', 'whatsapp');
      whatsappUrl.searchParams.set('utm_campaign', 'booking');
      whatsappUrl.searchParams.set('utm_content', 'contact_form');

      window.open(whatsappUrl.href, '_blank', 'noopener,noreferrer');
      if (toast) {
        toast.classList.add('show');
        window.clearTimeout(toastTimeout);
        toastTimeout = window.setTimeout(() => toast.classList.remove('show'), 4000);
      }
      contactForm.reset();
    });
  }

  const revealItems = document.querySelectorAll('.srv-card,.ritmo-item,.payment-card,.info-item');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealItems.forEach(item => {
      item.classList.add('reveal');
      observer.observe(item);
    });
  }
})();
