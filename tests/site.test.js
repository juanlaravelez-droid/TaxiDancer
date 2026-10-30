const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

class FakeElement {
  constructor(classes = []) {
    this.attributes = {};
    this.children = [];
    this.listeners = new Map();
    this.style = {};
    this.textContent = '';
    this.hidden = false;
    this.classList = {
      values: new Set(classes),
      add: value => this.classList.values.add(value),
      remove: value => this.classList.values.delete(value),
      contains: value => this.classList.values.has(value)
    };
  }

  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    event.target = event.target || this;
    event.preventDefault = event.preventDefault || (() => {
      event.defaultPrevented = true;
    });
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  querySelector(selector) {
    return selector === '.caption-number' ? this.captionNumber : null;
  }

  querySelectorAll(selector) {
    return selector === '.slide' ? this.slides || [] : [];
  }

  contains(element) {
    return element === this || this.children.includes(element);
  }
}

function runScript(relativePath, sandbox) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInNewContext(source, sandbox, { filename: relativePath });
}

function createCarousel() {
  const carousel = new FakeElement();
  carousel.slides = Array.from({ length: 4 }, () => {
    const slide = new FakeElement();
    slide.captionNumber = new FakeElement();
    return slide;
  });

  const elements = {
    carousel,
    dots: new FakeElement(),
    currentNum: new FakeElement(),
    totalNum: new FakeElement(),
    btnPrev: new FakeElement(),
    btnNext: new FakeElement(),
    btnPlay: new FakeElement(),
    iconPlay: new FakeElement(),
    iconPause: new FakeElement(),
    progressBar: new FakeElement()
  };
  const intervals = new Map();
  let nextIntervalId = 1;
  const document = {
    hidden: false,
    getElementById: id => elements[id] || null,
    createElement: () => new FakeElement(),
    addEventListener() {}
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    setInterval: callback => {
      const id = nextIntervalId++;
      intervals.set(id, callback);
      return id;
    },
    clearInterval: id => intervals.delete(id)
  };

  runScript('assets/js/carousel.js', {
    document,
    window,
    requestAnimationFrame: callback => callback()
  });

  return { elements, intervals };
}

function createBookingContext() {
  const createdEvents = [];
  const cacheValues = new Map();
  const calendar = {
    getTimeZone: () => 'America/Bogota',
    getEvents: () => [],
    createEvent: (title, start, end, options) => {
      createdEvents.push({ title, start, end, options });
    }
  };
  const utilities = {
    formatDate: (date, timezone, pattern) => {
      const year = String(date.getFullYear()).padStart(4, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      if (pattern === 'HH:mm') return `${hour}:${minute}`;
      if (pattern === 'yyyy-MM-dd HH:mm') return `${year}-${month}-${day} ${hour}:${minute}`;
      return `${year}-${month}-${day}`;
    },
    parseDate: (dateTime, timezone, pattern) => new Date(`${dateTime.replace(' ', 'T')}:00`),
    computeDigest: () => [1],
    base64EncodeWebSafe: () => 'phone-hash',
    DigestAlgorithm: { SHA_256: 'SHA_256' }
  };
  const sandbox = {
    Date,
    Utilities: utilities,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'test-calendar' })
    },
    CalendarApp: {
      getCalendarById: () => calendar,
      Visibility: { PRIVATE: 'private' }
    },
    CacheService: {
      getScriptCache: () => ({
        get: key => cacheValues.get(key) || null,
        put: (key, value) => cacheValues.set(key, value)
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} })
    }
  };
  runScript('backend/google-apps-script/Code.gs', sandbox);
  return { sandbox, createdEvents };
}

test('contact form opens a WhatsApp message with form values and defaults', () => {
  const form = new FakeElement();
  form.values = {
    nombre: ' Ana ',
    telefono: ' 3001234567 ',
    evento: '',
    ritmo: 'Tango',
    fecha: '',
    ciudad: 'Medellín',
    detalles: ''
  };
  let openedUrl;
  let reset = false;
  let scheduledDelay;
  const toast = new FakeElement();
  const currentYear = new FakeElement();
  const elements = { contactForm: form, toast, currentYear };
  const document = {
    getElementById: id => elements[id] || null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    open: url => {
      openedUrl = url;
    },
    clearTimeout() {},
    setTimeout: (callback, delay) => {
      scheduledDelay = delay;
      return 1;
    }
  };
  class FormDataMock {
    constructor(submittedForm) {
      this.values = submittedForm.values;
    }

    get(name) {
      return this.values[name];
    }
  }

  form.reset = () => {
    reset = true;
  };
  runScript('assets/js/main.js', { document, window, FormData: FormDataMock, URL, Date });

  assert.equal(currentYear.textContent, String(new Date().getFullYear()));
  const event = form.dispatch('submit');
  const url = new URL(openedUrl);
  const message = url.searchParams.get('text');

  assert.equal(event.defaultPrevented, true);
  assert.equal(url.origin + url.pathname, 'https://wa.me/573206548796');
  assert.match(message, /¡Hola! Me llamo Ana \(3001234567\)\./);
  assert.match(message, /Evento: Por definir/);
  assert.match(message, /Ritmo: Tango/);
  assert.match(message, /Fecha: Por confirmar/);
  assert.match(message, /Ciudad: Medellín/);
  assert.match(message, /Detalles: Sin detalles adicionales/);
  assert.equal(url.searchParams.get('utm_campaign'), 'booking');
  assert.equal(reset, true);
  assert.equal(toast.classList.contains('show'), true);
  assert.equal(scheduledDelay, 4000);
});

test('carousel creates slide controls and supports navigation and wrapping', () => {
  const { elements } = createCarousel();
  const { carousel, dots, currentNum, totalNum, btnNext } = elements;

  assert.equal(totalNum.textContent, '04');
  assert.equal(dots.children.length, 4);
  assert.equal(carousel.slides[0].classList.contains('active'), true);
  assert.equal(carousel.slides[0].attributes['aria-hidden'], 'false');

  btnNext.dispatch('click');
  assert.equal(currentNum.textContent, '02');
  assert.equal(carousel.slides[1].captionNumber.textContent, '02 / 04');

  dots.children[0].dispatch('click');
  assert.equal(currentNum.textContent, '01');

  const keyEvent = carousel.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(keyEvent.defaultPrevented, true);
  assert.equal(currentNum.textContent, '04');
  assert.equal(carousel.slides[3].attributes['aria-hidden'], 'false');
});

test('carousel playback button pauses and resumes automatic rotation', () => {
  const { elements, intervals } = createCarousel();
  const { btnPlay, iconPlay, iconPause } = elements;

  assert.equal(intervals.size, 1);
  btnPlay.dispatch('click');
  assert.equal(intervals.size, 0);
  assert.equal(iconPlay.hidden, false);
  assert.equal(iconPause.hidden, true);
  assert.equal(btnPlay.attributes['aria-label'], 'Reanudar presentación');

  btnPlay.dispatch('click');
  assert.equal(intervals.size, 1);
  assert.equal(iconPlay.hidden, true);
  assert.equal(iconPause.hidden, false);
  assert.equal(btnPlay.attributes['aria-label'], 'Pausar presentación');
});

test('booking availability runs Monday through Saturday and closes at midnight', () => {
  const { sandbox } = createBookingContext();
  const now = new Date();
  const monthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const availability = sandbox.getMonthAvailability(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1
  );
  const dates = Object.keys(availability.slotsByDate);

  assert.ok(dates.length > 0);
  for (const date of dates) {
    const [year, month, day] = date.split('-').map(Number);
    const weekday = new Date(year, month - 1, day).getDay();
    assert.ok([1, 2, 3, 4, 5, 6].includes(weekday));
    const slots = availability.slotsByDate[date];
    assert.deepEqual(Array.from(slots, slot => slot.time), ['19:00', '20:00', '21:00', '22:00']);
    assert.deepEqual(Array.from(slots, slot => slot.maxDurationHours), [5, 4, 3, 2]);
  }
});

test('booking accepts a reservation ending at midnight and rejects out-of-hours requests', () => {
  const { sandbox, createdEvents } = createBookingContext();
  const monday = new Date();
  monday.setDate(monday.getDate() + 1);
  while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1);
  const date = [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, '0'),
    String(monday.getDate()).padStart(2, '0')
  ].join('-');
  const nextDay = new Date(monday);
  nextDay.setDate(nextDay.getDate() + 1);
  const saturday = new Date(monday);
  saturday.setDate(saturday.getDate() + 5);
  const saturdayDate = [
    saturday.getFullYear(),
    String(saturday.getMonth() + 1).padStart(2, '0'),
    String(saturday.getDate()).padStart(2, '0')
  ].join('-');
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sundayDate = [
    sunday.getFullYear(),
    String(sunday.getMonth() + 1).padStart(2, '0'),
    String(sunday.getDate()).padStart(2, '0')
  ].join('-');
  const booking = {
    name: 'Ana',
    phone: '3001234567',
    email: 'ana@example.com',
    date,
    time: '22:00',
    durationHours: 2
  };

  sandbox.bookSlot(booking);
  assert.equal(createdEvents.length, 1);
  assert.equal(createdEvents[0].start.getHours(), 22);
  assert.equal(createdEvents[0].end.getDate(), nextDay.getDate());
  assert.equal(createdEvents[0].end.getHours(), 0);

  const saturdayContext = createBookingContext();
  saturdayContext.sandbox.bookSlot({ ...booking, date: saturdayDate });
  assert.equal(saturdayContext.createdEvents.length, 1);

  assert.throws(() => sandbox.bookSlot({ ...booking, time: '18:00' }), /no está dentro del periodo disponible/);
  assert.throws(() => sandbox.bookSlot({ ...booking, time: '22:00', durationHours: 3 }), /no está dentro del periodo disponible/);
  assert.throws(() => sandbox.bookSlot({ ...booking, date: sundayDate }), /no está dentro del periodo disponible/);
});
