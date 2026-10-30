const BOOKING = Object.freeze({
  calendarProperty: 'BOOKING_CALENDAR_ID',
  openHour: 19,
  closeHour: 24,
  minimumDurationHours: 2,
  minimumNoticeHours: 0,
  bookingWindowDays: 120,
  workingDays: [1, 2, 3, 4, 5, 6],
  timezone: 'America/Bogota'
});

function doGet() {
  const template = HtmlService.createTemplateFromFile('Booking');
  return template.evaluate()
    .setTitle('Reservas de baile · Juan Lara')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getMonthAvailability(year, month) {
  const requestedYear = Number(year);
  const requestedMonth = Number(month);
  if (!Number.isInteger(requestedYear) || !Number.isInteger(requestedMonth)
      || requestedMonth < 1 || requestedMonth > 12) {
    throw new Error('El mes solicitado no es válido.');
  }

  const calendar = getBookingCalendar_();
  const timezone = calendar.getTimeZone();
  if (timezone !== BOOKING.timezone) {
    throw new Error(
      'Configura el proyecto y el calendario con la zona horaria ' + BOOKING.timezone + '.'
    );
  }

  const now = new Date();
  const firstDay = makeDate_(requestedYear, requestedMonth, 1, 0, 0);
  const lastDay = makeDate_(requestedYear, requestedMonth + 1, 1, 0, 0);
  const maximumDate = new Date(now.getTime() + BOOKING.bookingWindowDays * 24 * 60 * 60 * 1000);
  if (firstDay.getTime() > maximumDate.getTime() || lastDay.getTime() <= now.getTime()) {
    throw new Error('El mes solicitado está fuera del periodo de disponibilidad.');
  }
  const events = calendar.getEvents(firstDay, lastDay);
  const slotsByDate = {};
  const daysInMonth = new Date(requestedYear, requestedMonth, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = [
      String(requestedYear).padStart(4, '0'),
      String(requestedMonth).padStart(2, '0'),
      String(day).padStart(2, '0')
    ].join('-');
    const dayStart = makeDate_(requestedYear, requestedMonth, day, 0, 0);
    if (!BOOKING.workingDays.includes(dayStart.getDay())) continue;

    const slots = [];
    for (let hour = BOOKING.openHour; hour + BOOKING.minimumDurationHours <= BOOKING.closeHour; hour += 1) {
      const start = makeDate_(requestedYear, requestedMonth, day, hour, 0);
      if (start.getTime() < now.getTime() + BOOKING.minimumNoticeHours * 60 * 60 * 1000) continue;
      if (start.getTime() > now.getTime() + BOOKING.bookingWindowDays * 24 * 60 * 60 * 1000) continue;

      let maxDurationHours = 0;
      for (let durationHours = 1; hour + durationHours <= BOOKING.closeHour; durationHours += 1) {
        const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
        const hasConflict = events.some(event =>
          start.getTime() < event.getEndTime().getTime()
          && end.getTime() > event.getStartTime().getTime()
        );
        if (hasConflict) break;
        maxDurationHours = durationHours;
      }
      if (maxDurationHours >= BOOKING.minimumDurationHours) {
        slots.push({
          time: Utilities.formatDate(start, timezone, 'HH:mm'),
          maxDurationHours: maxDurationHours
        });
      }
    }

    if (slots.length > 0) slotsByDate[date] = slots;
  }

  return {
    year: requestedYear,
    month: requestedMonth,
    timezone: timezone,
    slotsByDate: slotsByDate,
    today: Utilities.formatDate(now, timezone, 'yyyy-MM-dd'),
    maximumDate: Utilities.formatDate(maximumDate, timezone, 'yyyy-MM-dd')
  };
}

function bookSlot(booking) {
  if (!booking || typeof booking !== 'object') throw new Error('No recibimos los datos de la reserva.');
  if (String(booking.website || '').trim()) throw new Error('No fue posible procesar esta solicitud.');

  const name = cleanText_(booking.name, 100, 'Escribe tu nombre.');
  const phone = cleanText_(booking.phone, 30, 'Escribe un número de WhatsApp válido.');
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || !/^[+\d().\-\s]+$/.test(phone)) {
    throw new Error('Revisa el número de WhatsApp e inténtalo de nuevo.');
  }

  const email = cleanText_(booking.email, 254, 'Escribe un correo electrónico válido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('El correo electrónico no parece válido.');
  }

  const eventType = cleanText_(booking.eventType, 100, '');
  const rhythm = cleanText_(booking.rhythm, 100, '');
  const details = cleanText_(booking.details, 500, '');
  const date = String(booking.date || '');
  const time = String(booking.time || '');
  const durationHours = Number(booking.durationHours);
  if (!Number.isInteger(durationHours) || durationHours < BOOKING.minimumDurationHours) {
    throw new Error('La duración mínima de la reserva es de 2 horas.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):00$/.test(time)) {
    throw new Error('La fecha o el horario seleccionado no son válidos.');
  }

  const calendar = getBookingCalendar_();
  const timezone = calendar.getTimeZone();
  if (timezone !== BOOKING.timezone) {
    throw new Error(
      'Configura el proyecto y el calendario con la zona horaria ' + BOOKING.timezone + '.'
    );
  }

  const start = Utilities.parseDate(date + ' ' + time, timezone, 'yyyy-MM-dd HH:mm');
  if (Utilities.formatDate(start, timezone, 'yyyy-MM-dd HH:mm') !== date + ' ' + time) {
    throw new Error('La fecha o el horario seleccionado no son válidos.');
  }

  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  const startHour = Number(time.slice(0, 2));
  const now = new Date();
  const maximumDate = now.getTime() + BOOKING.bookingWindowDays * 24 * 60 * 60 * 1000;
  if (!BOOKING.workingDays.includes(start.getDay())
      || startHour < BOOKING.openHour
      || startHour + durationHours > BOOKING.closeHour
      || start.getTime() < now.getTime() + BOOKING.minimumNoticeHours * 60 * 60 * 1000
      || start.getTime() > maximumDate) {
    throw new Error('Ese horario no está dentro del periodo disponible para reservar.');
  }

  const cache = CacheService.getScriptCache();
  const rateLimitKey = 'reservation-' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, phoneDigits)
  );
  if (cache.get(rateLimitKey)) {
    throw new Error('Espera un minuto antes de enviar otra solicitud de reserva.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('La agenda está procesando otra solicitud. Inténtalo nuevamente.');
  }

  try {
    const conflict = calendar.getEvents(start, end).some(event =>
      start.getTime() < event.getEndTime().getTime()
      && end.getTime() > event.getStartTime().getTime()
    );
    if (conflict) throw new Error('Ese horario acaba de ocuparse. Selecciona otra hora.');

    const description = [
      'Reserva solicitada desde la página de Juan Lara.',
      'Nombre: ' + name,
      'WhatsApp: ' + phone,
      'Correo electrónico: ' + email,
      'Duración: ' + durationHours + ' horas',
      eventType ? 'Tipo de evento: ' + eventType : '',
      rhythm ? 'Ritmo preferido: ' + rhythm : '',
      details ? 'Detalles: ' + details : ''
    ].filter(Boolean).join('\n');

    calendar.createEvent('Reserva de baile · ' + name + ' (' + durationHours + ' h)', start, end, {
      description: description,
      visibility: CalendarApp.Visibility.PRIVATE
    });
    cache.put(rateLimitKey, '1', 60);
  } finally {
    lock.releaseLock();
  }

  return {
    date: Utilities.formatDate(start, timezone, 'yyyy-MM-dd'),
    time: Utilities.formatDate(start, timezone, 'HH:mm'),
    durationHours: durationHours,
    message: 'Solicitud registrada en la agenda. Juan se pondrá en contacto contigo para confirmar.'
  };
}

function getBookingCalendar_() {
  const calendarId = PropertiesService.getScriptProperties()
    .getProperty(BOOKING.calendarProperty);
  if (!calendarId) {
    throw new Error('Falta configurar BOOKING_CALENDAR_ID en las propiedades del proyecto de Apps Script.');
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error('No se encontró el calendario configurado o Apps Script no tiene permiso para acceder.');
  }
  return calendar;
}

function makeDate_(year, month, day, hour, minute) {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (month === 13) date.setFullYear(year + 1);
  return date;
}

function cleanText_(value, maximumLength, requiredMessage) {
  const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (requiredMessage && !text) throw new Error(requiredMessage);
  if (text.length > maximumLength) {
    throw new Error('Uno de los campos supera la longitud permitida.');
  }
  return text;
}
