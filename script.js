/* ==========================================================================
   Organisational Excellence — interaction layer (multi-page)
   Shared across index.html / reflect.html (Reflection) /
   action.html (Action + Commitment).
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'oe-reflected-pillars';

  /* ---------------------------------------------------------------------
     Reflected-pillar tracking. Fixed to work even when pages are opened
     directly from disk (file://), where localStorage is sometimes
     partitioned per file and won't reliably share across pages: the
     selection is ALSO carried as a query string on the link into the
     Action page, and the Action page reads both and unions them.
     --------------------------------------------------------------------- */
  function readStoredPillars() {
    const set = new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) JSON.parse(raw).forEach((v) => set.add(String(v)));
    } catch (e) { /* localStorage unavailable — non-fatal */ }
    try {
      const q = new URLSearchParams(window.location.search).get('reflected');
      if (q) q.split(',').filter(Boolean).forEach((v) => set.add(String(v)));
    } catch (e) { /* malformed query — non-fatal */ }
    return set;
  }

  const reflectedPillars = readStoredPillars();

  function persistReflectedPillars() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(reflectedPillars)));
    } catch (e) { /* non-fatal */ }
  }

  function addReflectedPillar(id) {
    if (!id) return;
    reflectedPillars.add(String(id));
    persistReflectedPillars();
    refreshActionLink();
  }

  function refreshActionLink() {
    const link = document.getElementById('toActionBtn');
    if (!link) return;
    if (reflectedPillars.size) {
      link.href = 'action.html?reflected=' + encodeURIComponent(Array.from(reflectedPillars).join(','));
    }
  }
  refreshActionLink();

  /* ---------------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------------- */
  const revealTargets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------------------
     Nav background on scroll
     --------------------------------------------------------------------- */
  const nav = document.getElementById('nav');
  function updateNavBg() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }

  /* ---------------------------------------------------------------------
     Pillar-progress signature — spans three pages.
     --------------------------------------------------------------------- */
  const pageOrder = { landing: 0, reflect: 1, action: 2 };
  const currentPage = document.body.dataset.page;
  const pillarFill = document.querySelector('.pillar-progress__fill');

  function updatePillarProgress() {
    if (!pillarFill) return;
    const pageIndex = pageOrder[currentPage] ?? 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const scrollFrac = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    const pct = ((pageIndex + scrollFrac) / 3) * 100;
    pillarFill.style.height = pct + '%';
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateNavBg();
        updatePillarProgress();
        ticking = false;
      });
      ticking = true;
    }
  });
  updateNavBg();
  updatePillarProgress();

  /* ---------------------------------------------------------------------
     Generic horizontal slider — used for both the Patterns carousel and
     the pillar carousel. Handles sliding transform, per-slide height
     sync (slides vary in content length), and touch/mouse drag/swipe.
     --------------------------------------------------------------------- */
  function createSlider({ panel, track, itemSelector, onIndexChange }) {
    const items = Array.from(track.querySelectorAll(itemSelector));
    let index = 0;

    function syncHeight() {
      const active = items[index];
      if (active) panel.style.height = active.scrollHeight + 'px';
    }

    function goTo(i) {
      index = Math.max(0, Math.min(items.length - 1, i));
      track.style.transform = `translateX(-${index * 100}%)`;
      syncHeight();
      if (onIndexChange) onIndexChange(index);
    }

    let dragStartX = 0;
    let dragDeltaX = 0;
    let isDragging = false;

    function dragStart(x) {
      isDragging = true;
      dragStartX = x;
      dragDeltaX = 0;
      track.classList.add('is-dragging');
    }
    function dragMove(x) {
      if (!isDragging) return;
      dragDeltaX = x - dragStartX;
      const baseOffset = -index * panel.getBoundingClientRect().width;
      track.style.transform = `translateX(${baseOffset + dragDeltaX}px)`;
    }
    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove('is-dragging');
      const threshold = panel.getBoundingClientRect().width * 0.15;
      if (dragDeltaX < -threshold && index < items.length - 1) {
        goTo(index + 1);
      } else if (dragDeltaX > threshold && index > 0) {
        goTo(index - 1);
      } else {
        goTo(index);
      }
    }

    track.addEventListener('touchstart', (e) => dragStart(e.touches[0].clientX), { passive: true });
    track.addEventListener('touchmove', (e) => dragMove(e.touches[0].clientX), { passive: true });
    track.addEventListener('touchend', dragEnd);
    track.addEventListener('mousedown', (e) => { e.preventDefault(); dragStart(e.clientX); });
    window.addEventListener('mousemove', (e) => dragMove(e.clientX));
    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('resize', () => goTo(index));

    goTo(0);
    return { goTo, get index() { return index; } };
  }

  /* ---------------------------------------------------------------------
     REFLECTION — video. Tries to autoplay WITH sound; if the browser
     blocks that (very common), falls back to muted autoplay with an
     obvious, always-visible sound toggle. A blurred, full-bleed copy of
     the same video fills the wide frame behind the crisp, uncropped
     foreground video, so the frame reads as cinematic/horizontal
     without cropping any on-screen captions.
     --------------------------------------------------------------------- */
  const video = document.getElementById('introVideo');
  const bgVideo = document.getElementById('introVideoBg');
  const muteBtn = document.getElementById('videoMuteBtn');
  const muteIconOff = document.getElementById('muteIconOff');
  const muteIconOn = document.getElementById('muteIconOn');
  const wizardSection = document.getElementById('wizard');

  function setMuteIcon(isMuted) {
    if (muteIconOff) muteIconOff.style.display = isMuted ? '' : 'none';
    if (muteIconOn) muteIconOn.style.display = isMuted ? 'none' : '';
    if (muteBtn) muteBtn.setAttribute('aria-label', isMuted ? 'Turn sound on' : 'Turn sound off');
  }

  if (muteBtn && video) {
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      setMuteIcon(video.muted);
    });
  }

  function goToPatterns() {
    cancelVideoCountdown();
    if (wizardSection) wizardSection.scrollIntoView({ behavior: 'smooth' });
  }
  const toReflectBtn = document.getElementById('toReflectBtn');
  const toWizardBtn = document.getElementById('toWizardBtn');
  [toReflectBtn, toWizardBtn].forEach((btn) => { if (btn) btn.addEventListener('click', goToPatterns); });

  if (video) {
    video.muted = false;
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        video.muted = true;
        setMuteIcon(true);
        video.play().catch(() => { /* even muted autoplay blocked — controls still work */ });
      });
    }
    setMuteIcon(video.muted);

    if (bgVideo) {
      const bgPlay = bgVideo.play();
      if (bgPlay && typeof bgPlay.catch === 'function') bgPlay.catch(() => {});
      video.addEventListener('play', () => bgVideo.play().catch(() => {}));
      video.addEventListener('pause', () => bgVideo.pause());
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (!e.isIntersecting) {
            if (!video.paused) video.pause();
            if (bgVideo && !bgVideo.paused) bgVideo.pause();
          }
        }),
        { threshold: 0.3 }
      ).observe(video);
    }

    // Once the film ends, visibly count down to the Patterns section —
    // a real, cancel-able countdown rather than a silent animation.
    video.addEventListener('ended', startVideoCountdown);
  }

  let videoCountdownInterval = null;
  const videoAutoAdvanceEl = document.getElementById('videoAutoAdvance');
  const videoAutoAdvanceText = document.getElementById('videoAutoAdvanceText');
  const videoAutoAdvanceCancel = document.getElementById('videoAutoAdvanceCancel');

  function cancelVideoCountdown() {
    if (videoCountdownInterval) {
      clearInterval(videoCountdownInterval);
      videoCountdownInterval = null;
    }
    if (videoAutoAdvanceEl) videoAutoAdvanceEl.hidden = true;
  }
  function startVideoCountdown() {
    if (!videoAutoAdvanceEl || !videoAutoAdvanceText) return;
    let remaining = 6; // ~5–7s window
    videoAutoAdvanceEl.hidden = false;
    videoAutoAdvanceText.textContent = `Continuing to patterns in ${remaining}s`;
    videoCountdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(videoCountdownInterval);
        videoCountdownInterval = null;
        goToPatterns();
        return;
      }
      videoAutoAdvanceText.textContent = `Continuing to patterns in ${remaining}s`;
    }, 1000);
  }
  if (videoAutoAdvanceCancel) videoAutoAdvanceCancel.addEventListener('click', cancelVideoCountdown);

  /* ---------------------------------------------------------------------
     PATTERNS — five recurring realities in a horizontally swipeable
     carousel. A "Next" control is always visible and interactive,
     whether or not an option has been picked — picking one is optional
     personalisation, not a gate to moving forward.
     --------------------------------------------------------------------- */
  const wizardTrack = document.getElementById('wizardTrack');
  const wizardStage = document.getElementById('wizardStage');
  const wsteps = wizardTrack ? Array.from(wizardTrack.querySelectorAll('.wstep')) : [];
  const wizardDots = Array.from(document.querySelectorAll('.wizard__dot'));

  let wizardCountdownInterval = null;
  const wizardAutoAdvanceEl = document.getElementById('wizardAutoAdvance');
  const wizardAutoAdvanceText = document.getElementById('wizardAutoAdvanceText');
  const wizardAutoAdvanceCancel = document.getElementById('wizardAutoAdvanceCancel');

  function cancelWizardCountdown() {
    if (wizardCountdownInterval) {
      clearInterval(wizardCountdownInterval);
      wizardCountdownInterval = null;
    }
    if (wizardAutoAdvanceEl) wizardAutoAdvanceEl.hidden = true;
  }
  function startWizardCountdown() {
    const link = document.getElementById('toActionBtn');
    if (!wizardAutoAdvanceEl || !wizardAutoAdvanceText || !link) return;
    let remaining = 5;
    wizardAutoAdvanceEl.hidden = false;
    wizardAutoAdvanceText.textContent = `Continuing to Action in ${remaining}s`;
    wizardCountdownInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(wizardCountdownInterval);
        wizardCountdownInterval = null;
        window.location.href = link.href;
        return;
      }
      wizardAutoAdvanceText.textContent = `Continuing to Action in ${remaining}s`;
    }, 1000);
  }
  if (wizardAutoAdvanceCancel) wizardAutoAdvanceCancel.addEventListener('click', cancelWizardCountdown);

  let wizardSlider = null;
  if (wsteps.length && wizardTrack && wizardStage) {
    wizardSlider = createSlider({
      panel: wizardStage,
      track: wizardTrack,
      itemSelector: '.wstep',
      onIndexChange: (i) => {
        wizardDots.forEach((dot, di) => {
          dot.classList.toggle('is-current', di === i);
          dot.classList.toggle('is-done', di < i);
        });
        if (i === wsteps.length - 1) startWizardCountdown();
        else cancelWizardCountdown();
      },
    });

    wsteps.forEach((step, i) => {
      const options = step.querySelectorAll('.wopt');
      const continueBtn = step.querySelector('.wstep__continue');
      const transitionLine = step.querySelector('.wstep__transition');
      const followupLine = step.querySelector('.wstep__followup');
      const pillarMatch = step.dataset.pillarMatch;

      options.forEach((opt) => {
        opt.addEventListener('click', () => {
          options.forEach((o) => o.classList.remove('is-picked'));
          opt.classList.add('is-picked');
          if (pillarMatch) addReflectedPillar(pillarMatch);
          if (followupLine) followupLine.classList.add('is-visible');
          if (transitionLine) transitionLine.classList.add('is-visible');
          if (continueBtn && continueBtn.tagName === 'BUTTON') {
            continueBtn.textContent = 'Continue';
            continueBtn.classList.add('is-answered');
          }
          // Height may have grown now that the transition line is showing.
          if (wizardSlider) wizardStage.style.height = step.scrollHeight + 'px';
        });
      });

      if (continueBtn && continueBtn.tagName === 'BUTTON') {
        continueBtn.addEventListener('click', () => wizardSlider.goTo(i + 1));
      }
    });

    wizardDots.forEach((dot, i) => {
      dot.style.cursor = 'pointer';
      dot.addEventListener('click', () => wizardSlider.goTo(i));
    });
  }

  /* ---------------------------------------------------------------------
     SCROLL CUE (Action page) — click jumps straight to the pillars.
     --------------------------------------------------------------------- */
  const scrollCue = document.getElementById('pillarScrollCue');
  const pillarStepper = document.getElementById('pillarStepper');
  if (scrollCue && pillarStepper) {
    scrollCue.addEventListener('click', () => {
      pillarStepper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const closingScrollCue = document.getElementById('closingScrollCue');
  const closingSection = document.getElementById('closing');
  if (closingScrollCue && closingSection) {
    closingScrollCue.addEventListener('click', () => {
      closingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------------------------------------------------------------
     PILLAR CAROUSEL (Action page) — Back/Next, dots, and swipe all
     drive the same horizontal track. Last pillar's "Next" goes to
     Commitment instead of restarting.
     --------------------------------------------------------------------- */
  const pillarTrack = document.getElementById('pillarTrack');
  const pillarPanel = document.getElementById('pillarPanel');
  const pcards = pillarTrack ? Array.from(pillarTrack.querySelectorAll('.pcard')) : [];
  const pdots = Array.from(document.querySelectorAll('.pdot'));
  const pillarPrev = document.getElementById('pillarPrev');
  const pillarNext = document.getElementById('pillarNext');
  const commitmentsSection = document.getElementById('commitments');

  let pillarSlider = null;
  if (pcards.length && pillarTrack && pillarPanel) {
    pillarSlider = createSlider({
      panel: pillarPanel,
      track: pillarTrack,
      itemSelector: '.pcard',
      onIndexChange: (i) => {
        pdots.forEach((dot, di) => dot.classList.toggle('is-active', di === i));
        if (pillarPrev) pillarPrev.disabled = i === 0;
        if (pillarNext) pillarNext.textContent = i === pcards.length - 1 ? 'See the Commitments' : 'Next pillar';

        const activeCard = pcards[i];
        if (activeCard) {
          const pillarId = activeCard.dataset.pillar;
          const matchLine = activeCard.querySelector('.pcard__match');
          if (matchLine) matchLine.classList.toggle('is-matched', reflectedPillars.has(pillarId));
        }
      },
    });

    if (pillarNext) {
      pillarNext.addEventListener('click', () => {
        if (pillarSlider.index === pcards.length - 1) {
          if (commitmentsSection) commitmentsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          pillarSlider.goTo(pillarSlider.index + 1);
        }
      });
    }
    if (pillarPrev) {
      pillarPrev.addEventListener('click', () => pillarSlider.goTo(pillarSlider.index - 1));
    }
    pdots.forEach((dot, i) => dot.addEventListener('click', () => pillarSlider.goTo(i)));
  }
})();
