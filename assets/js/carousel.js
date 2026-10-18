(() => {
  const carousel = document.getElementById('carousel');
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll('.slide'));
  if (slides.length === 0) return;

  const dotsWrap = document.getElementById('dots');
  const counter = document.getElementById('currentNum');
  const totalCounter = document.getElementById('totalNum');
  const previousButton = document.getElementById('btnPrev');
  const nextButton = document.getElementById('btnNext');
  const playButton = document.getElementById('btnPlay');
  const playIcon = document.getElementById('iconPlay');
  const pauseIcon = document.getElementById('iconPause');
  const progressBar = document.getElementById('progressBar');
  const interval = 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentIndex = 0;
  let isPlaying = !reducedMotion;
  let isHovered = false;
  let timerId = null;
  let touchStartX = null;
  const dots = [];

  totalCounter.textContent = String(slides.length).padStart(2, '0');

  slides.forEach((slide, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot';
    dot.setAttribute('aria-label', `Ir a foto ${index + 1}`);
    dot.addEventListener('click', () => showSlide(index));
    dotsWrap.appendChild(dot);
    dots.push(dot);
  });

  function resetProgress() {
    progressBar.classList.remove('animating');
    progressBar.style.width = '0%';
    if (isPlaying && !isHovered && !document.hidden) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => progressBar.classList.add('animating'));
      });
    }
  }

  function showSlide(index) {
    slides[currentIndex].classList.remove('active');
    slides[currentIndex].setAttribute('aria-hidden', 'true');
    dots[currentIndex].classList.remove('active');
    dots[currentIndex].removeAttribute('aria-current');

    currentIndex = (index + slides.length) % slides.length;
    slides[currentIndex].classList.add('active');
    slides[currentIndex].setAttribute('aria-hidden', 'false');
    dots[currentIndex].classList.add('active');
    dots[currentIndex].setAttribute('aria-current', 'true');
    slides[currentIndex].querySelector('.caption-number').textContent =
      `${String(currentIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    counter.textContent = String(currentIndex + 1).padStart(2, '0');
    resetProgress();
  }

  function stopTimer() {
    window.clearInterval(timerId);
    timerId = null;
    progressBar.classList.remove('animating');
    progressBar.style.width = '0%';
  }

  function startTimer() {
    stopTimer();
    if (!isPlaying || isHovered || document.hidden) return;
    timerId = window.setInterval(() => showSlide(currentIndex + 1), interval);
    resetProgress();
  }

  function updatePlaybackControls() {
    playIcon.hidden = isPlaying;
    pauseIcon.hidden = !isPlaying;
    playButton.setAttribute('aria-label', isPlaying ? 'Pausar presentación' : 'Reanudar presentación');
  }

  function togglePlayback() {
    isPlaying = !isPlaying;
    updatePlaybackControls();
    isPlaying ? startTimer() : stopTimer();
  }

  previousButton.addEventListener('click', () => {
    showSlide(currentIndex - 1);
    startTimer();
  });
  nextButton.addEventListener('click', () => {
    showSlide(currentIndex + 1);
    startTimer();
  });
  playButton.addEventListener('click', togglePlayback);

  carousel.addEventListener('touchstart', event => {
    touchStartX = event.touches[0].clientX;
  }, { passive: true });
  carousel.addEventListener('touchend', event => {
    if (touchStartX === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 40) showSlide(currentIndex + (distance < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showSlide(currentIndex + 1);
      startTimer();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showSlide(currentIndex - 1);
      startTimer();
    } else if (event.key === ' ' && event.target === carousel) {
      event.preventDefault();
      togglePlayback();
    }
  });

  carousel.addEventListener('mouseenter', () => {
    isHovered = true;
    stopTimer();
  });
  carousel.addEventListener('mouseleave', () => {
    isHovered = false;
    startTimer();
  });
  carousel.addEventListener('focusin', stopTimer);
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) startTimer();
  });
  document.addEventListener('visibilitychange', startTimer);

  showSlide(0);
  updatePlaybackControls();
  startTimer();
})();
