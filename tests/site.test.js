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
