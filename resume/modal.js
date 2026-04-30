const DESKTOP_MARGIN = 40;
const MOBILE_BREAKPOINT = 768;
const ANIM_DURATION = 400;
const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 0.5;

function isMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function getFinalRect() {
  const margin = isMobile() ? 10 : DESKTOP_MARGIN;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (isMobile()) {
    const w = vw - margin * 2;
    const h = vh - margin + 5;
    return { left: margin, top: 10, width: w, height: h };
  }

  const w = Math.min(vw - margin * 2, 1200);
  const h = vh - margin * 2;
  const left = (vw - w) / 2;
  const top = (vh - h) / 2;
  return { left, top, width: w, height: h };
}

function buildLoaderSVG() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('aria-hidden', 'true');

  const g = document.createElementNS(ns, 'g');
  g.classList.add('loader-orbit');

  // coral trail arc
  const trail = document.createElementNS(ns, 'path');
  trail.setAttribute('d', 'M 40 10 A 30 30 0 1 1 39.9 10');
  trail.setAttribute('fill', 'none');
  trail.setAttribute('stroke', '#e07a5f');
  trail.setAttribute('stroke-width', '2');
  trail.setAttribute('stroke-linecap', 'round');
  trail.setAttribute('opacity', '0.4');

  // teal ball at top of orbit
  const ball = document.createElementNS(ns, 'circle');
  ball.setAttribute('cx', '40');
  ball.setAttribute('cy', '10');
  ball.setAttribute('r', '5');
  ball.classList.add('loader-ball');

  g.appendChild(trail);
  g.appendChild(ball);
  svg.appendChild(g);
  return svg;
}

function cloneSourceContent(sourceEl) {
  const clone = sourceEl.cloneNode(true);
  clone.style.pointerEvents = 'none';
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.style.margin = '0';
  clone.style.position = 'absolute';
  clone.style.inset = '0';
  return clone;
}

function modalify(sourceEl) {
  const src = sourceEl.dataset.modalSrc;
  const label = sourceEl.dataset.modalLabel || 'Project modal';

  if (!src) {
    console.warn('modalify: element has no data-modal-src', sourceEl);
    return;
  }

  if (!sourceEl.querySelectorAll('[data-modal-img]')[0]) {
    console.warn('modalify: element has no child with data-modal-img', sourceEl);
    return;
  }

  sourceEl.setAttribute('tabindex', '0');
  sourceEl.setAttribute('role', 'button');
  sourceEl.addEventListener('click', () => openModal(sourceEl, src, label));
  sourceEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(sourceEl, src, label);
    }
  });
}

function openModal(sourceEl, src, label) {
  const modalImg = sourceEl.querySelectorAll('[data-modal-img]')[0];
  const sourceRect = modalImg.getBoundingClientRect();
  const finalRect = getFinalRect();

  // overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  // window
  const win = document.createElement('div');
  win.className = 'modal-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-label', label);
  win.tabIndex = -1;

  // position at source rect initially
  win.style.left = sourceRect.left + 'px';
  win.style.top = sourceRect.top + 'px';
  win.style.width = sourceRect.width + 'px';
  win.style.height = sourceRect.height + 'px';
  win.style.borderRadius = getComputedStyle(sourceEl).borderRadius || '6px';

  // layer: original content clone
  const originalLayer = document.createElement('div');
  originalLayer.className = 'modal-original';
  originalLayer.appendChild(cloneSourceContent(modalImg));

  // layer: iframe content
  const contentLayer = document.createElement('div');
  contentLayer.className = 'modal-content';
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', label);
  contentLayer.appendChild(iframe);

  // layer: loader
  const loaderLayer = document.createElement('div');
  loaderLayer.className = 'modal-loader';
  loaderLayer.appendChild(buildLoaderSVG());

  // close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.textContent = '✕';

  win.appendChild(originalLayer);
  win.appendChild(loaderLayer);
  win.appendChild(contentLayer);

  win.appendChild(closeBtn);

  document.body.appendChild(overlay);
  document.body.appendChild(win);

  // disable scroll after appending but before measuring final rect
  // so viewport shift doesn't affect coordinates
  // document.body.style.overflow = 'hidden';

  // ensure position:fixed is explicit
  win.style.position = 'fixed';

  // opening state — loader fades in immediately
  win.classList.add('state-opening');
  loaderLayer.classList.add('is-visible');

  // double rAF: first lets browser register initial styles,
  // second ensures a paint has occurred before we animate
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    win.style.left = finalRect.left + 'px';
    win.style.top = finalRect.top + 'px';
    win.style.width = finalRect.width + 'px';
    win.style.height = finalRect.height + 'px';
    win.style.borderRadius = '6px';
  }));

  // once animation finishes, load iframe
  // use { once: true } so listener auto-removes after first call
  iframe.src = src;

  var iFrameLoaded = false;
  var modalOpenComplete = false;
  iframe.addEventListener('load', function onLoad() {
    iFrameLoaded = true;
      if (modalOpenComplete) {
        // loaderLayer.classList.remove('is-visible');
        contentLayer.classList.add('is-visible');
      }
  }, { once: true });

  win.addEventListener('transitionend', function onOpenEnd(e) {
    modalOpenComplete = true;
    if (iFrameLoaded) {
      // loaderLayer.classList.remove('is-visible');
      contentLayer.classList.add('is-visible');
    }

    win.classList.remove('state-opening');

  }, { once: true });

  // focus modal
  win.focus();

  // close handlers
  const close = () => closeModal(win, overlay, loaderLayer, contentLayer, sourceEl);
  closeBtn.addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  // mobile swipe
  bindSwipe(win, close);

  // trap focus
  bindFocusTrap(win);
}

function closeModal(win, overlay, loaderLayer, contentLayer, sourceEl) {
  const modalImg = sourceEl.querySelectorAll('[data-modal-img]')[0];
  const targetRect = modalImg.getBoundingClientRect();

  win.classList.add('state-closing');

  overlay.classList.remove('is-open');
  contentLayer.classList.remove('is-visible');


  win.style.position = 'fixed';
  win.style.left = targetRect.left + 'px';
  win.style.top = targetRect.top + 'px';
  win.style.width = targetRect.width + 'px';
  win.style.height = targetRect.height + 'px';
  win.style.borderRadius = getComputedStyle(sourceEl).borderRadius || '6px';

  win.addEventListener('transitionend', function onCloseEnd(e) {  
    if (e.target != win) {
      return;
    }  
    win.remove();
    overlay.remove();
    loaderLayer.remove();
    document.body.style.overflow = '';
    sourceEl.focus();
  });
}

function bindSwipe(win, close) {
  let startY = 0;
  let startTime = 0;
  let currentY = 0;

  win.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startTime = Date.now();
    currentY = startY;
    win.style.transition = 'none';
  }, { passive: true });

  win.addEventListener('touchmove', e => {
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      win.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  win.addEventListener('touchend', () => {
    const dy = currentY - startY;
    const dt = Date.now() - startTime;
    const velocity = dy / dt;

    win.style.transition = '';
    win.style.transform = '';

    if (dy > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY) {
      close();
    }
  });
}

function bindFocusTrap(win) {
  win.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const focusable = [...win.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}