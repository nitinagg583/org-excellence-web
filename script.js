/* ==========================================================================
   Organisational Excellence — interaction layer (multi-page)
   Shared across index.html / reflect.html (Understanding) /
   navigation.html (Navigation + Commitment).
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'oe-reflected-pillars';

  function getReflectedPillars() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      return new Set();
    }
  }
  function addReflectedPillar(id) {
    try {
      const set = getReflectedPillars();
      set.add(id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) { /* localStorage unavailable — non-fatal */ }
  }

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
     Pillar-progress signature — spans three pages: fill reflects
     (page position + scroll fraction within the page) / 3 pages.
     --------------------------------------------------------------------- */
  const pageOrder = { landing: 0, reflect: 1, navigation: 2 };
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
     VIDEO (Understanding page) — autoplays muted (browser requirement),
     a sound toggle, a persistent "skip to text" control up top, and a
     "continue to reflection" action once they're ready to move on.
     --------------------------------------------------------------------- */
  const video = document.getElementById('introVideo');
  const muteBtn = document.getElementById('videoMuteBtn');
  const muteIconOff = document.getElementById('muteIconOff');
  const muteIconOn = document.getElementById('muteIconOn');
  const toReflectBtn = document.getElementById('toReflectBtn'); // top "skip to text"
  const toWizardBtn = document.getElementById('toWizardBtn'); // below-video "continue"
  const wizardSection = document.getElementById('wizard');

  if (muteBtn && video) {
    muteBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      const isMuted = video.muted;
      muteBtn.setAttribute('aria-label', isMuted ? 'Turn sound on' : 'Turn sound off');
      if (muteIconOff) muteIconOff.style.display = isMuted ? '' : 'none';
      if (muteIconOn) muteIconOn.style.display = isMuted ? 'none' : '';
    });
  }
  [toReflectBtn, toWizardBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        if (wizardSection) wizardSection.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });
  if (video) {
    // Autoplay can be silently blocked by some browsers/devices even when
    // muted; if so, fall back to showing a normal paused frame — the
    // "continue" and "skip" controls remain available regardless.
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => { /* autoplay blocked — no-op, controls still work */ });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (!e.isIntersecting && !video.paused) video.pause(); }),
        { threshold: 0.3 }
      ).observe(video);
    }
  }

  /* ---------------------------------------------------------------------
     GUIDED REFLECTION WIZARD — manual only. Pick an option to reveal the
     transition line and the Continue button; Continue moves to the next
     step. Selections are stored locally (this browser only) so the
     matching pillar can be tagged later on the Navigation page.
     --------------------------------------------------------------------- */
  const wsteps = Array.from(document.querySelectorAll('.wstep'));
  const wizardDots = Array.from(document.querySelectorAll('.wizard__dot'));

  function setWizardStep(index) {
    wsteps.forEach((step, i) => step.classList.toggle('is-active', i === index));
    wizardDots.forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      dot.classList.toggle('is-done', i < index);
    });
  }

  if (wsteps.length) {
    setWizardStep(0);

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
          if (continueBtn) continueBtn.classList.add('is-visible');
        });
      });

      if (continueBtn && continueBtn.tagName === 'BUTTON') {
        continueBtn.addEventListener('click', () => {
          if (i < wsteps.length - 1) setWizardStep(i + 1);
        });
      }
    });

    wizardDots.forEach((dot, i) => {
      dot.addEventListener('click', () => setWizardStep(i));
      dot.style.cursor = 'pointer';
    });
  }

  /* ---------------------------------------------------------------------
     SCROLL CUE (Navigation page) — click jumps straight to the pillars.
     --------------------------------------------------------------------- */
  const scrollCue = document.getElementById('pillarScrollCue');
  const pillarStepper = document.getElementById('pillarStepper');
  if (scrollCue && pillarStepper) {
    scrollCue.style.cursor = 'pointer';
    scrollCue.addEventListener('click', () => {
      pillarStepper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------------------------------------------------------------
     PILLAR TRACK (Navigation page) — a real sliding carousel: Back/Next
     buttons, clickable dots, AND touch/mouse drag/swipe all move the
     same horizontal track. On the last pillar, "Next" becomes a link
     through to the Commitment section instead of restarting.
     --------------------------------------------------------------------- */
  const pillarTrack = document.getElementById('pillarTrack');
  const pcards = Array.from(document.querySelectorAll('.pcard'));
  const pdots = Array.from(document.querySelectorAll('.pdot'));
  const pillarPrev = document.getElementById('pillarPrev');
  const pillarNext = document.getElementById('pillarNext');
  const commitmentsSection = document.getElementById('commitments');
  let currentPillarIndex = 0;

  function setPillarIndex(index) {
    currentPillarIndex = Math.max(0, Math.min(pcards.length - 1, index));
    if (pillarTrack) {
      pillarTrack.style.transform = `translateX(-${currentPillarIndex * 100}%)`;
    }
    pdots.forEach((dot, i) => dot.classList.toggle('is-active', i === currentPillarIndex));

    if (pillarPrev) pillarPrev.disabled = currentPillarIndex === 0;
    if (pillarNext) {
      pillarNext.textContent = currentPillarIndex === pcards.length - 1 ? 'See the Commitments' : 'Next pillar';
    }

    const activeCard = pcards[currentPillarIndex];
    if (activeCard) {
      const pillarId = activeCard.dataset.pillar;
      const matchLine = activeCard.querySelector('.pcard__match');
      if (matchLine) matchLine.classList.toggle('is-matched', getReflectedPillars().has(pillarId));
    }
  }

  if (pcards.length && pillarTrack) {
    setPillarIndex(0);

    if (pillarNext) {
      pillarNext.addEventListener('click', () => {
        if (currentPillarIndex === pcards.length - 1) {
          if (commitmentsSection) commitmentsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
          setPillarIndex(currentPillarIndex + 1);
        }
      });
    }
    if (pillarPrev) {
      pillarPrev.addEventListener('click', () => setPillarIndex(currentPillarIndex - 1));
    }
    pdots.forEach((dot) => {
      dot.addEventListener('click', () => setPillarIndex(parseInt(dot.dataset.pillarIndex, 10)));
    });

    // Drag / swipe support (touch + mouse), horizontal-only, so vertical
    // page scroll on a phone still works normally.
    let dragStartX = 0;
    let dragDeltaX = 0;
    let isDragging = false;
    const panel = pillarTrack.parentElement;
    const trackWidth = () => panel.getBoundingClientRect().width;

    function dragStart(x) {
      isDragging = true;
      dragStartX = x;
      dragDeltaX = 0;
      pillarTrack.classList.add('is-dragging');
    }
    function dragMove(x) {
      if (!isDragging) return;
      dragDeltaX = x - dragStartX;
      const baseOffset = -currentPillarIndex * trackWidth();
      pillarTrack.style.transform = `translateX(${baseOffset + dragDeltaX}px)`;
    }
    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      pillarTrack.classList.remove('is-dragging');
      const threshold = trackWidth() * 0.15;
      if (dragDeltaX < -threshold && currentPillarIndex < pcards.length - 1) {
        setPillarIndex(currentPillarIndex + 1);
      } else if (dragDeltaX > threshold && currentPillarIndex > 0) {
        setPillarIndex(currentPillarIndex - 1);
      } else {
        setPillarIndex(currentPillarIndex); // snap back
      }
    }

    pillarTrack.addEventListener('touchstart', (e) => dragStart(e.touches[0].clientX), { passive: true });
    pillarTrack.addEventListener('touchmove', (e) => dragMove(e.touches[0].clientX), { passive: true });
    pillarTrack.addEventListener('touchend', dragEnd);

    pillarTrack.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragStart(e.clientX);
    });
    window.addEventListener('mousemove', (e) => dragMove(e.clientX));
    window.addEventListener('mouseup', dragEnd);

    // Keep the track aligned on resize/orientation change.
    window.addEventListener('resize', () => setPillarIndex(currentPillarIndex));
  }
})();
