/* Feelings Events & Décor — interaction & motion */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const deva = n => String(n).padStart(2, '0').replace(/\d/g, d => '०१२३४५६७८९'[d]);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const curtain = $('.curtain');
  const hasGsap = !!(window.gsap && window.ScrollTrigger);

  /* ------------------------------------------------------------------
     Archive (built first so it works even without GSAP)
  ------------------------------------------------------------------ */
  const grid = $('[data-grid]');
  const PAGE = 20;
  let shown = PAGE;
  let filter = 'all';

  // interleave categories so "All" reads as a varied mix
  const data = (() => {
    const groups = {};
    (window.ARCHIVE || []).forEach(d => (groups[d.c] = groups[d.c] || []).push(d));
    const keys = Object.keys(groups);
    const out = [];
    let added = true;
    for (let i = 0; added; i++) {
      added = false;
      keys.forEach(k => { if (groups[k][i]) { out.push(groups[k][i]); added = true; } });
    }
    return out;
  })();

  data.forEach((d, i) => {
    const r = d.h / d.w;
    const fig = document.createElement('figure');
    fig.className = 'tile' + (r > 1.3 ? ' tile--tall' : '') + (r < 0.72 ? ' tile--wide' : '');
    fig.dataset.c = d.c;
    fig.dataset.cap = d.alt;
    fig.dataset.i = i;
    fig.tabIndex = 0;
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', 'Open image: ' + d.alt);
    fig.innerHTML = `<img src="${d.src}" alt="${d.alt}" width="${d.w}" height="${d.h}" loading="lazy" decoding="async">`;
    grid.appendChild(fig);
  });
  const tiles = $$('.tile', grid);

  // counts on filter chips
  $$('.filter').forEach(b => {
    const f = b.dataset.f;
    const n = f === 'all' ? tiles.length : tiles.filter(t => t.dataset.c === f).length;
    const sup = $('sup', b); if (sup) sup.textContent = n;
  });

  const moreBtn = $('[data-more]');
  function applyFilter() {
    let count = 0;
    tiles.forEach(t => {
      const match = filter === 'all' || t.dataset.c === filter;
      const visible = match && count < shown;
      if (match) count++;
      t.classList.toggle('is-hidden', !visible);
    });
    const total = filter === 'all' ? tiles.length : tiles.filter(t => t.dataset.c === filter).length;
    moreBtn.style.display = shown >= total ? 'none' : '';
    $('span', moreBtn).textContent = `Show more (${total - Math.min(shown, total)})`;
  }
  applyFilter();

  function relayout(fn) {
    if (hasGsap && window.Flip && !reduce) {
      const state = Flip.getState(tiles);
      fn();
      Flip.from(state, {
        duration: .8, ease: 'expo.inOut', absolute: true, stagger: .012,
        onEnter: els => gsap.fromTo(els, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, y: 0, duration: .7, delay: .25, ease: 'expo.out' }),
        onLeave: els => gsap.to(els, { opacity: 0, scale: .92, duration: .4 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    } else fn();
  }

  $$('.filter').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.f === filter) return;
    $$('.filter').forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
    relayout(() => { filter = b.dataset.f; shown = PAGE; applyFilter(); });
  }));
  moreBtn.addEventListener('click', () => relayout(() => { shown += PAGE; applyFilter(); }));

  /* ------------------------------------------------------------------
     Lightbox
  ------------------------------------------------------------------ */
  const lb = $('.lb'), lbImg = $('.lb__fig img'), lbCap = $('.lb__fig figcaption'), lbCount = $('.lb__count');
  let lbList = [], lbIdx = 0, lastFocus = null;
  // lbList holds plain {src, alt} items so any group of images can open in the viewer
  function lbShow(i) {
    lbIdx = (i + lbList.length) % lbList.length;
    const it = lbList[lbIdx];
    lbImg.style.opacity = 0;
    const pre = new Image();
    pre.onload = pre.onerror = () => {
      if (lbList[lbIdx] !== it) return;
      lbImg.src = it.src; lbImg.alt = it.alt;
      if (hasGsap && !reduce) gsap.fromTo(lbImg, { opacity: 0, scale: .97 }, { opacity: 1, scale: 1, duration: .6, ease: 'expo.out' });
      else lbImg.style.opacity = 1;
    };
    pre.src = it.src;
    lbCap.textContent = it.alt;
    lbCount.textContent = `${String(lbIdx + 1).padStart(2, '0')} / ${String(lbList.length).padStart(2, '0')}`;
    const multi = lbList.length > 1;
    $('.lb__prev').style.visibility = $('.lb__next').style.visibility = multi ? '' : 'hidden';
    lbCount.style.visibility = multi ? '' : 'hidden';
  }
  function lbOpen(items, index) {
    lbList = items;
    lastFocus = document.activeElement;
    lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
    lbShow(index);
    window.lenis && window.lenis.stop();
    $('.lb__close').focus();
  }
  const toItem = img => ({ src: img.currentSrc || img.src, alt: img.alt || '' });
  function openTile(tile) {
    const visible = tiles.filter(t => !t.classList.contains('is-hidden'));
    lbOpen(visible.map(t => toItem($('img', t))), visible.indexOf(tile));
  }
  let closing = false;
  function lbClose() {
    if (!lb.classList.contains('is-open') || closing) return;
    closing = true;
    const finish = () => {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
      window.lenis && window.lenis.start();
      lastFocus && lastFocus.focus({ preventScroll: true });
      closing = false;
    };
    // photo eases back and down while the backdrop fades (CSS transition on .lb)
    if (hasGsap && !reduce) {
      gsap.to(lbImg, { scale: .94, y: 24, opacity: 0, duration: .45, ease: 'power3.in', overwrite: true,
        onComplete: () => gsap.set(lbImg, { clearProps: 'y,scale' }) });
      gsap.to([lbCap, lbCount, '.lb__nav', '.lb__close'], { opacity: 0, duration: .3, onComplete: () => gsap.set([lbCap, lbCount, '.lb__nav', '.lb__close'], { clearProps: 'opacity' }) });
      gsap.delayedCall(.18, finish);
    } else finish();
  }
  // project images: open that project's photos
  $$('.story').forEach(story => {
    const figs = $$('.story__main, .story__side', story).filter(f => $('img', f));
    const items = figs.map(f => toItem($('img', f)));
    figs.forEach((f, i) => {
      f.tabIndex = 0; f.setAttribute('role', 'button');
      f.setAttribute('aria-label', 'Open image: ' + items[i].alt);
      f.addEventListener('click', () => lbOpen(items, i));
      f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lbOpen(items, i); } });
    });
  });
  grid.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) openTile(t); });
  grid.addEventListener('keydown', e => { const t = e.target.closest('.tile'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openTile(t); } });
  $('.lb__close').addEventListener('click', lbClose);
  $('.lb__prev').addEventListener('click', () => lbShow(lbIdx - 1));
  $('.lb__next').addEventListener('click', () => lbShow(lbIdx + 1));
  // click / tap anywhere closes, except the arrows (and not right after a swipe)
  let swiped = false;
  lb.addEventListener('click', e => {
    if (swiped) { swiped = false; return; }
    if (e.target.closest('.lb__nav')) return;
    lbClose();
  });
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowRight') lbShow(lbIdx + 1);
    if (e.key === 'ArrowLeft') lbShow(lbIdx - 1);
  });
  let tx = null;
  lb.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) { swiped = true; lbShow(lbIdx + (dx < 0 ? 1 : -1)); setTimeout(() => (swiped = false), 400); }
    tx = null;
  });

  /* ------------------------------------------------------------------
     Enquiry form → WhatsApp
  ------------------------------------------------------------------ */
  const form = $('[data-form]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    let ok = true;
    ['name', 'phone'].forEach(n => {
      const input = form.elements[n];
      const bad = !String(fd.get(n) || '').trim();
      input.closest('.field').classList.toggle('is-error', bad);
      if (bad && ok) { input.focus(); ok = false; }
    });
    if (!ok) { $('[data-note]').textContent = 'Please add your name and phone number.'; return; }
    const lines = [
      'Hello Feelings, I would like to enquire about décor.',
      '',
      `Occasion: ${fd.get('occasion')}`,
      `Name: ${fd.get('name')}`,
      `Phone: ${fd.get('phone')}`,
      fd.get('date') ? `Date: ${new Date(fd.get('date')).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : '',
      fd.get('guests') ? `Guests: ${fd.get('guests')}` : '',
      fd.get('venue') ? `Venue: ${fd.get('venue')}` : '',
      fd.get('notes') ? `Notes: ${fd.get('notes')}` : ''
    ].filter((l, i) => l || i === 1);
    window.open('https://wa.me/919822063414?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
    $('[data-note]').textContent = 'Thank you. WhatsApp should now be open with your message.';
  });
  $$('.field input', form).forEach(i => i.addEventListener('input', () => i.closest('.field').classList.remove('is-error')));

  /* ------------------------------------------------------------------
     Videos: play only when on screen
  ------------------------------------------------------------------ */
  const vids = $$('video');
  const vio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const v = en.target;
      if (en.isIntersecting) {
        if (v.preload === 'none') v.preload = 'auto';
        const p = v.play(); if (p && p.catch) p.catch(() => {});
      } else v.pause();
    });
  }, { rootMargin: '200px 0px' });
  vids.forEach(v => { v.muted = true; vio.observe(v); });

  /* ------------------------------------------------------------------
     Menu
  ------------------------------------------------------------------ */
  const menu = $('.menu'), toggle = $('.nav__toggle');
  let menuTl = null;
  function setMenu(open) {
    document.documentElement.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', !open);
    if (hasGsap && !reduce) {
      if (!menuTl) {
        menuTl = gsap.timeline({ paused: true })
          .set(menu, { visibility: 'visible' })
          .fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: .8, ease: 'expo.inOut' })
          .from($$('.menu__links a', menu), { yPercent: 60, opacity: 0, stagger: .05, duration: .8, ease: 'expo.out' }, '-=.35')
          .from($('.menu__foot', menu), { opacity: 0, duration: .5 }, '-=.5');
      }
      open ? menuTl.timeScale(1).play() : menuTl.timeScale(1.6).reverse();
    } else {
      menu.style.visibility = open ? 'visible' : 'hidden';
      menu.style.clipPath = open ? 'none' : '';
    }
    if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
  }
  toggle.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));
  $$('.menu a[href^="#"]').forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ------------------------------------------------------------------
     Without GSAP or with reduced motion: stop here, keep site usable
  ------------------------------------------------------------------ */
  const nav = $('[data-nav]'), fab = $('.fab');
  function basicNav() {
    let lastY = 0;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nav.classList.toggle('is-solid', y > 40);
      nav.classList.toggle('is-hidden', y > lastY && y > 400 && !document.documentElement.classList.contains('menu-open'));
      lastY = y;
    }, { passive: true });
  }

  if (!hasGsap || reduce) {
    curtain && curtain.remove();
    fab.classList.add('is-shown');
    basicNav();
    if (reduce) $$('.process__img')[0]?.classList.add('is-active');
    return;
  }

  /* ==================================================================
     MOTION
  ================================================================== */
  gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // Smooth scroll
  const lenis = new Lenis({ lerp: .09, wheelMultiplier: 1, smoothWheel: true });
  window.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0, duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  }));

  // Nav state
  let navDark = 0;
  lenis.on('scroll', ({ scroll, direction }) => {
    nav.classList.toggle('is-solid', scroll > 40);
    nav.classList.toggle('is-hidden', direction === 1 && scroll > 400 && !document.documentElement.classList.contains('menu-open'));
  });
  const setDark = () => nav.classList.toggle('is-dark', navDark > 0);
  // the floating button checks what's behind it (it sits at the bottom, the nav at the top)
  const fabDark = $$('.work, .enquire');
  const fabCheck = () => {
    const y = window.innerHeight - 50;
    fab.classList.toggle('is-on-dark', fabDark.some(sec => { const r = sec.getBoundingClientRect(); return r.top < y && r.bottom > y; }));
  };
  lenis.on('scroll', fabCheck);
  window.addEventListener('resize', fabCheck);

  // Cursor: only appears over things that actually open (archive tiles, project photos).
  // State is re-checked on every pointer move AND every scroll frame, so it never lingers
  // when content slides out from under a still mouse.
  if (finePointer) {
    const cur = $('.cursor'), label = $('.cursor__label');
    const xTo = gsap.quickTo(cur, 'x', { duration: .45, ease: 'power3' });
    const yTo = gsap.quickTo(cur, 'y', { duration: .45, ease: 'power3' });
    let px = -1, py = -1, shown = false;
    const SEL = '.tile, .story__main[role="button"], .story__side[role="button"]';
    const check = () => {
      if (px < 0) return;
      const el = document.elementFromPoint(px, py);
      const t = el && !lb.classList.contains('is-open') && !document.documentElement.classList.contains('menu-open') ? el.closest(SEL) : null;
      if (t && !shown) {
        shown = true; label.textContent = 'View';
        gsap.to(cur, { scale: 1, opacity: 1, duration: .45, ease: 'expo.out', overwrite: 'auto' });
      } else if (!t && shown) {
        shown = false;
        gsap.to(cur, { scale: 0, opacity: 0, duration: .3, ease: 'expo.out', overwrite: 'auto' });
      }
    };
    window.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; xTo(px); yTo(py); check(); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { px = -1; shown = false; gsap.to(cur, { scale: 0, opacity: 0, duration: .3, overwrite: 'auto' }); });
    window.addEventListener('blur', () => { shown = false; gsap.set(cur, { scale: 0, opacity: 0 }); });
    lenis.on('scroll', check);
    document.addEventListener('click', () => requestAnimationFrame(check));
  }

  document.fonts.ready.then(init);

  // Line masks get room above and below so ascenders/descenders (g, y, p, accents) are never clipped
  function splitLines(el) {
    const s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: false });
    (s.masks || []).forEach(m => m.classList.add('split-mask'));
    return s;
  }

  function init() {
    /* ---------------- Intro ---------------- */
    const heroA = splitLines($('.hero__line--a'));
    const heroB = splitLines($('.hero__line--b'));
    const arch = $('.hero__arch'), heroVid = $('.hero__video'), pin = $('.hero__pin');

    // Ivory copy of the headline, clipped by the arch, so type stays legible over the film
    const inv = $('.hero__title').cloneNode(true);
    inv.classList.add('hero__title--inv');
    inv.setAttribute('aria-hidden', 'true');
    arch.insertBefore(inv, $('.hero__over', arch));
    const syncInv = () => {
      const a = arch.getBoundingClientRect(), p = pin.getBoundingClientRect();
      inv.style.width = p.width + 'px'; inv.style.height = p.height + 'px';
      inv.style.transform = `translate3d(${p.left - a.left}px, ${p.top - a.top}px, 0)`;
    };
    gsap.ticker.add(syncInv);
    heroA.lines.push(...$$('.hero__line--a .split-line', inv));
    heroB.lines.push(...$$('.hero__line--b .split-line', inv));

    gsap.set([heroA.lines, heroB.lines], { yPercent: 145 });
    gsap.set(arch, { clipPath: 'inset(100% 0% 0% 0%)' });
    gsap.set('.hero__eyebrow span, .hero__scroll', { opacity: 0, y: 14 });
    gsap.set('.nav', { yPercent: -100 });

    const word = $('.curtain__word'), sub = $('.curtain__sub'), rule = $('.curtain__rule');
    const intro = gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from(word, { yPercent: 100, duration: 1.1 })
      .from($$('i', rule), { scaleX: 0, duration: 1, ease: 'expo.inOut', transformOrigin: i => i ? 'left center' : 'right center' }, '-=.7')
      .from($('b', rule), { scale: 0, rotate: -45, duration: .7 }, '<.2')
      .from(sub, { opacity: 0, y: 10, duration: .8 }, '-=.6')
      .to([word, rule, sub], { yPercent: -60, opacity: 0, duration: .7, ease: 'expo.in', stagger: .04 }, '+=.3')
      .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, '-=.25')
      .to(arch, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' }, '-=.85')
      .fromTo(heroVid, { scale: 1.45 }, { scale: 1.15, duration: 2, ease: 'expo.out' }, '<')
      .to(heroA.lines, { yPercent: 0, duration: 1.3 }, '-=1.2')
      .to(heroB.lines, { yPercent: 0, duration: 1.3 }, '-=1.15')
      .to('.hero__eyebrow span, .hero__scroll', { opacity: 1, y: 0, duration: 1, stagger: .08 }, '-=1')
      .to('.nav', { yPercent: 0, duration: 1 }, '-=1')
      .add(() => fab.classList.add('is-shown'), '-=.4')
      .add(() => { curtain.remove(); lenis.start(); gsap.set(arch, { clearProps: 'clipPath' }); buildScroll(); });
  }

  function buildScroll() {
    const mm = gsap.matchMedia();

    /* ---------------- Hero: arch opens to full frame (scrubbed) ---------------- */
    mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)' }, ctx => {
      const { desk } = ctx.conditions;
      const arch = $('.hero__arch');
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '.hero', start: 'top top', end: '+=140%', scrub: .8, pin: '.hero__pin',
          invalidateOnRefresh: true,
          onUpdate: self => {
            const d = self.progress > .45 && self.progress < 1 ? 1 : 0;
            if (d !== (nav._heroDark || 0)) { nav._heroDark = d; navDark += d ? 1 : -1; setDark(); }
          }
        }
      });
      tl.to(arch, { width: () => window.innerWidth, height: () => window.innerHeight, borderRadius: 0, y: 0, duration: 1 }, 0)
        .to('.hero__video', { scale: 1, duration: 1 }, 0)
        .to('.hero__line--a', desk ? { xPercent: -45, opacity: 0, duration: .7 } : { y: -80, opacity: 0, duration: .5 }, 0)
        .to('.hero__line--b', desk ? { xPercent: 45, opacity: 0, duration: .7 } : { y: -60, opacity: 0, duration: .5 }, 0)
        .to('.hero__eyebrow, .hero__scroll', { opacity: 0, y: -20, duration: .3 }, 0)
        .to('.hero__shade', { opacity: 1, duration: .5 }, .55)
        .fromTo('.hero__over', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .45 }, .7)
        .to({}, { duration: .25 });
    });

    /* ---------------- Section headings (play in, reverse out — both directions) ---------------- */
    $$('[data-split]').forEach(el => {
      const s = splitLines(el);
      gsap.fromTo(s.lines, { yPercent: 145 }, {
        yPercent: 0, duration: 1.2, stagger: .09, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', end: 'bottom 8%', toggleActions: 'play reverse play reverse' }
      });
    });
    $$('.label').forEach(el => {
      gsap.fromTo(el, { opacity: 0, x: -24 }, {
        opacity: 1, x: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', end: 'bottom 4%', toggleActions: 'play reverse play reverse' }
      });
    });

    /* ---------------- Manifesto: words light up with scroll ---------------- */
    const mText = $('[data-words]');
    const mSplit = SplitText.create(mText, { type: 'words', wordsClass: 'word' });
    gsap.fromTo(mSplit.words, { opacity: .12 }, {
      opacity: 1, stagger: .1, ease: 'none',
      scrollTrigger: { trigger: mText, start: 'top 80%', end: 'bottom 50%', scrub: true }
    });
    gsap.fromTo('.manifesto__note', { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.manifesto__note', start: 'top 92%', toggleActions: 'play reverse play reverse' }
    });

    // image curtain reveal + parallax (scrubbed, so it runs in reverse too)
    $$('.reveal-img').forEach(fig => {
      const img = $('img', fig);
      gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top 100%', end: 'top 45%', scrub: .6 }
      });
      gsap.fromTo(img, { yPercent: -16 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    /* ---------------- Work ---------------- */
    const darkTrigger = (trigger) => ScrollTrigger.create({
      trigger, start: 'top 40px', end: 'bottom 40px',
      onToggle: self => { navDark += self.isActive ? 1 : -1; setDark(); }
    });

    mm.add('(min-width: 901px)', () => {
      const work = $('.work'), track = $('.work__track');
      const dist = () => track.scrollWidth - window.innerWidth;
      const h = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: work, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1,
          invalidateOnRefresh: true, anticipatePin: 1,
          onToggle: self => { navDark += self.isActive ? 1 : -1; setDark(); }
        }
      });

      $$('.story').forEach(story => {
        const main = $('.story__main', story), side = $('.story__side', story);
        const media = $('.story__main img, .story__main video', story);
        gsap.fromTo(media, { xPercent: -7 }, {
          xPercent: 7, ease: 'none',
          scrollTrigger: { trigger: story, containerAnimation: h, start: 'left right', end: 'right left', scrub: true }
        });
        gsap.fromTo(main, { clipPath: 'inset(0% 0% 0% 100%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
          scrollTrigger: { trigger: story, containerAnimation: h, start: 'left 95%', end: 'left 35%', scrub: true }
        });
        gsap.fromTo(side, { yPercent: 30, opacity: 0 }, {
          yPercent: 0, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: story, containerAnimation: h, start: 'left 70%', end: 'left 20%', scrub: true }
        });
        const txt = $$('.story__num, h3, .story__meta, .story__text p:last-child', story);
        gsap.fromTo(txt, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, stagger: .08, duration: 1, ease: 'expo.out',
          scrollTrigger: { trigger: story, containerAnimation: h, start: 'left 55%', end: 'right 25%', toggleActions: 'play reverse play reverse' }
        });
      });
      gsap.fromTo('.work__end > *', { opacity: 0, x: 60 }, {
        opacity: 1, x: 0, stagger: .1, ease: 'none',
        scrollTrigger: { trigger: '.work__end', containerAnimation: h, start: 'left 90%', end: 'left 50%', scrub: true }
      });
    });

    mm.add('(max-width: 900px)', () => {
      darkTrigger('.work');
      $$('.story').forEach(story => {
        const main = $('.story__main', story), side = $('.story__side', story);
        const media = $('.story__main img, .story__main video', story);
        gsap.fromTo(main, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
          scrollTrigger: { trigger: story, start: 'top 90%', end: 'top 30%', scrub: .6 }
        });
        gsap.fromTo(media, { yPercent: -8, scale: 1.15 }, {
          yPercent: 4, scale: 1, ease: 'none',
          scrollTrigger: { trigger: story, start: 'top bottom', end: 'bottom top', scrub: true }
        });
        gsap.fromTo(side, { y: 80, opacity: 0 }, {
          y: 0, opacity: 1, ease: 'none',
          scrollTrigger: { trigger: story, start: 'top 70%', end: 'top 20%', scrub: .6 }
        });
        gsap.fromTo($$('.story__num, h3, .story__meta, .story__text p:last-child', story), { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, stagger: .07, duration: .9, ease: 'expo.out',
          scrollTrigger: { trigger: $('.story__text', story), start: 'top 90%', end: 'bottom 5%', toggleActions: 'play reverse play reverse' }
        });
      });
    });
    darkTrigger('.enquire');

    /* ---------------- Quote: characters ink in with scroll ---------------- */
    const q = $('[data-chars]');
    const qs = SplitText.create(q, { type: 'words,chars' });
    gsap.fromTo(qs.chars, { color: '#D3C3AA' }, {
      color: '#1C1410', stagger: .02, ease: 'none',
      scrollTrigger: { trigger: q, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
    gsap.fromTo('.quote footer', { opacity: 0, y: 20 }, {
      opacity: 1, y: 0, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.quote footer', start: 'top 95%', toggleActions: 'play reverse play reverse' }
    });

    /* ---------------- Services ---------------- */
    $$('.svc__row').forEach(row => {
      gsap.fromTo(row, { opacity: 0, y: 50 }, {
        opacity: 1, y: 0, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: row, start: 'top 94%', end: 'bottom 2%', toggleActions: 'play reverse play reverse' }
      });
    });
    if (finePointer) {
      const pv = $('.svc-preview'), inner = $('.svc-preview__inner');
      const px = gsap.quickTo(pv, 'x', { duration: .7, ease: 'power3' });
      const py = gsap.quickTo(pv, 'y', { duration: .7, ease: 'power3' });
      const list = $('.svc');
      list.addEventListener('pointermove', e => { px(e.clientX); py(e.clientY); });
      list.addEventListener('pointerenter', () => gsap.to(pv, { opacity: 1, scale: 1, duration: .6, ease: 'expo.out' }));
      list.addEventListener('pointerleave', () => gsap.to(pv, { opacity: 0, scale: .6, duration: .5, ease: 'expo.out' }));
      lenis.on('scroll', () => gsap.to(pv, { opacity: 0, scale: .6, duration: .3, overwrite: 'auto' }));
      $$('.svc__row').forEach(row => row.addEventListener('pointerenter', () => {
        const img = document.createElement('img');
        img.src = row.dataset.img; img.alt = '';
        inner.appendChild(img);
        gsap.fromTo(img, { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.3 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: .8, ease: 'expo.out' });
        gsap.to(pv, { opacity: 1, scale: 1, duration: .5, ease: 'expo.out' });
        while (inner.children.length > 3) inner.firstElementChild.remove();
      }));
    }

    /* ---------------- Film: frame opens, columns drift (scrubbed + pinned) ---------------- */
    mm.add({ desk: '(min-width: 901px)', mob: '(max-width: 900px)' }, ctx => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: '.film', start: 'top top', end: '+=120%', scrub: .8, pin: '.film__frame' }
      });
      tl.fromTo('.film__grid', { clipPath: ctx.conditions.desk ? 'inset(22% 30% 22% 30% round 400px 400px 0px 0px)' : 'inset(18% 12% 18% 12% round 300px 300px 0px 0px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', duration: 1 }, 0)
        .fromTo('.film__cell:nth-child(odd)', { yPercent: 14 }, { yPercent: -6, duration: 1.4 }, 0)
        .fromTo('.film__cell:nth-child(even)', { yPercent: -10 }, { yPercent: 6, duration: 1.4 }, 0)
        .fromTo('.film__title span', { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .12, duration: .6 }, .35);
    });

    /* ---------------- Process ---------------- */
    mm.add('(min-width: 901px)', () => {
      const imgs = $$('.process__img'), steps = $$('.step'), cur = $('.process__cur');
      let active = 0;
      gsap.set(imgs, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(imgs[0], { clipPath: 'inset(0% 0% 0% 0%)' });
      gsap.set(steps, { opacity: .28 });
      gsap.set(steps[0], { opacity: 1 });
      const go = (i, dir) => {
        if (i === active) return;
        const from = dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)';
        imgs.forEach((im, k) => im.style.zIndex = k === i ? 3 : (k === active ? 2 : 1));
        gsap.fromTo(imgs[i], { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', overwrite: true });
        gsap.fromTo($('img, video', imgs[i]), { scale: 1.25 }, { scale: 1, duration: 1.4, ease: 'expo.out' });
        gsap.to(steps[active], { opacity: .28, duration: .6 });
        gsap.to(steps[i], { opacity: 1, duration: .6 });
        cur.textContent = deva(i + 1);
        active = i;
      };
      steps.forEach((s, i) => ScrollTrigger.create({
        trigger: s, start: 'top 60%', end: 'bottom 60%',
        onEnter: () => go(i, 1), onEnterBack: () => go(i, -1)
      }));
      return () => { imgs.forEach(im => im.style.zIndex = ''); };
    });
    mm.add('(max-width: 900px)', () => {
      $$('.step').forEach(s => {
        const fig = $('.step__img', s), img = $('img', fig);
        gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
          scrollTrigger: { trigger: fig, start: 'top 95%', end: 'top 40%', scrub: .6 }
        });
        gsap.fromTo(img, { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.fromTo($$('.step__n, h3, p', s), { opacity: 0, y: 30 }, {
          opacity: 1, y: 0, stagger: .08, duration: .9, ease: 'expo.out',
          scrollTrigger: { trigger: s, start: 'top 88%', end: 'bottom 5%', toggleActions: 'play reverse play reverse' }
        });
      });
    });

    /* ---------------- Florals: marquee follows scroll direction ---------------- */
    const rows = $$('.marquee').map(m => {
      const row = $('.marquee__row', m);
      row.innerHTML += row.innerHTML; // duplicate for seamless loop
      $$('img', row).forEach((im, i) => { if (i >= row.children.length / 2) { im.alt = ''; im.setAttribute('aria-hidden', 'true'); } });
      return { row, dir: +m.dataset.dir, x: 0, w: 0 };
    });
    const measure = () => rows.forEach(r => { r.w = r.row.scrollWidth / 2; });
    measure();
    window.addEventListener('resize', measure);
    $$('.marquee img').forEach(im => im.addEventListener('load', measure, { once: true }));
    let boost = 0, scrollDir = 1;
    lenis.on('scroll', ({ velocity, direction }) => {
      if (direction) scrollDir = direction;
      boost = Math.min(Math.abs(velocity) * 0.9, 18);
    });
    let flVisible = false;
    ScrollTrigger.create({ trigger: '.florals', start: 'top bottom', end: 'bottom top', onToggle: s => (flVisible = s.isActive) });
    gsap.ticker.add((t, dt) => {
      boost *= .94;
      if (!flVisible) return;
      const speed = (.045 + boost * .02) * dt * scrollDir;
      rows.forEach(r => {
        if (!r.w) return;
        r.x -= speed * r.dir;
        r.x = ((r.x % r.w) - r.w) % r.w;
        r.row.style.transform = `translate3d(${r.x}px,0,0)`;
      });
    });
    gsap.fromTo('.florals__lede, .florals__head .btn', { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, stagger: .1, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.florals__lede', start: 'top 92%', toggleActions: 'play reverse play reverse' }
    });
    gsap.fromTo('.marquee', { clipPath: 'inset(0% 0% 0% 100%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', stagger: .15, ease: 'none',
      scrollTrigger: { trigger: '.marquee', start: 'top 95%', end: 'top 45%', scrub: .6 }
    });

    /* ---------------- Archive tiles ---------------- */
    gsap.set(tiles, { opacity: 0, y: 60 });
    ScrollTrigger.batch(tiles, {
      start: 'top 95%', end: 'bottom 5%',
      onEnter: b => gsap.to(b, { opacity: 1, y: 0, stagger: .06, duration: 1, ease: 'expo.out', overwrite: true }),
      onLeaveBack: b => gsap.to(b, { opacity: 0, y: 60, stagger: .03, duration: .6, ease: 'expo.in', overwrite: true }),
      onEnterBack: b => gsap.to(b, { opacity: 1, y: 0, stagger: .04, duration: .8, ease: 'expo.out', overwrite: true }),
      onLeave: b => gsap.to(b, { opacity: 0, y: -40, duration: .6, ease: 'expo.in', overwrite: true })
    });
    gsap.fromTo('.filter', { opacity: 0, y: 16 }, {
      opacity: 1, y: 0, stagger: .04, duration: .8, ease: 'expo.out',
      scrollTrigger: { trigger: '.filters', start: 'top 92%', toggleActions: 'play reverse play reverse' }
    });

    /* ---------------- Enquire ---------------- */
    gsap.fromTo('.enquire__lede, .enquire__contact > div, .form > *', { opacity: 0, y: 36 }, {
      opacity: 1, y: 0, stagger: .06, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.enquire', start: 'top 70%', end: 'bottom 10%', toggleActions: 'play reverse play reverse' }
    });

    /* ---------------- Footer wordmark rises with scroll ---------------- */
    gsap.fromTo('.foot__word span', { yPercent: 105 }, {
      yPercent: 0, stagger: .06, ease: 'none',
      scrollTrigger: { trigger: '.foot__word', start: 'top bottom', end: 'bottom bottom', scrub: .6 }
    });
    gsap.fromTo('.foot__top > *', { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, stagger: .08, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: '.foot', start: 'top 85%', toggleActions: 'play none play reverse' }
    });

    // late-loading media changes heights; keep triggers accurate
    // Triggers must be measured in page order so pinned sections (hero, work, film) push
    // everything below them correctly; otherwise later headings think they're already passed.
    const resync = () => { ScrollTrigger.refresh(); ScrollTrigger.sort(); ScrollTrigger.refresh(); };
    window.addEventListener('load', resync);
    resync();
  }
})();
