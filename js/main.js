/* =========================================================
   Teplorium — інтерактив
   ========================================================= */
(() => {
  'use strict';

  document.documentElement.classList.add('js');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /* Адреса обробника заявок (Formspree, Make, власний бекенд, Telegram-бот).
     Приймає POST JSON: { name, phone, topic, msg, page }. */
  const FORM_ENDPOINT = '';

  /* =======================================================
     1. Процедурні текстури матеріалів
     ======================================================= */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function grain(ctx, w, h, amount) {
    const img = ctx.getImageData(0, 0, w, h);
    const a = img.data;
    for (let i = 0; i < a.length; i += 4) {
      const n = (Math.random() - .5) * amount;
      a[i] += n; a[i + 1] += n; a[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }
  // безшовні плями: кожну малюємо з усіма зсувами по краях тайла
  function blotches(ctx, w, h, count, rMin, rMax, colors) {
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = rMin + Math.random() * (rMax - rMin);
      const col = colors[i % colors.length];
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }

  function texPlaster() {
    const [c, x] = makeCanvas(256, 256);
    x.fillStyle = '#d3cdc2'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, 26, 20, 70, ['rgba(255,255,255,.18)', 'rgba(90,80,65,.10)']);
    blotches(x, 256, 256, 160, 1, 3, ['rgba(60,55,45,.25)', 'rgba(255,255,255,.35)']);
    grain(x, 256, 256, 22);
    return c.toDataURL('image/jpeg', .85);
  }

  function texBrick() {
    const W = 240, H = 96, bw = 56, bh = 20, m = 4;
    const [c, x] = makeCanvas(W, H);
    x.fillStyle = '#9d958a'; x.fillRect(0, 0, W, H);
    grain(x, W, H, 40);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? -30 : 0;
      for (let col = 0; col < 5; col++) {
        const bx = off + col * (bw + m) + m / 2;
        const by = row * (bh + m) + m / 2;
        const hue = 8 + Math.random() * 12;
        const sat = 42 + Math.random() * 18;
        const lig = 30 + Math.random() * 12;
        // цеглина, що виходить за край, дублюється з іншого боку — тайл безшовний
        for (const px of [bx, bx - W, bx + W]) {
          if (px + bw < 0 || px > W) continue;
          const g = x.createLinearGradient(0, by, 0, by + bh);
          g.addColorStop(0, `hsl(${hue} ${sat}% ${lig + 5}%)`);
          g.addColorStop(1, `hsl(${hue} ${sat}% ${lig - 4}%)`);
          x.fillStyle = g;
          x.fillRect(px, by, bw, bh);
          x.fillStyle = 'rgba(0,0,0,.18)';
          x.fillRect(px, by + bh - 2, bw, 2);
          x.fillStyle = 'rgba(255,220,200,.10)';
          x.fillRect(px, by, bw, 1.5);
        }
      }
    }
    blotches(x, W, H, 120, 1, 2.5, ['rgba(0,0,0,.35)', 'rgba(255,200,170,.18)']);
    grain(x, W, H, 26);
    return c.toDataURL('image/jpeg', .88);
  }

  function texPrimer() {
    const [c, x] = makeCanvas(256, 256);
    x.fillStyle = '#6f7d86'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, 30, 15, 60, ['rgba(255,255,255,.12)', 'rgba(0,20,30,.12)']);
    grain(x, 256, 256, 14);
    return c.toDataURL('image/jpeg', .85);
  }

  function texCoat() {
    const [c, x] = makeCanvas(256, 256);
    x.fillStyle = '#3a3f46'; x.fillRect(0, 0, 256, 256);
    blotches(x, 256, 256, 30, 30, 90, ['rgba(255,255,255,.035)', 'rgba(0,0,0,.035)']);
    // «апельсинова кірка» напиленого покриття
    blotches(x, 256, 256, 900, 1.5, 4.5, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.14)']);
    grain(x, 256, 256, 9);
    return c.toDataURL('image/jpeg', .9);
  }

  /* =======================================================
     2. 3D-стіна в Hero
     ======================================================= */
  const stage = document.getElementById('stage');
  const wall = document.getElementById('wall');

  if (stage && wall) initWall();

  function initWall() {
    const rs = document.documentElement.style;
    rs.setProperty('--tex-plaster', `url(${texPlaster()})`);
    rs.setProperty('--tex-brick', `url(${texBrick()})`);
    rs.setProperty('--tex-primer', `url(${texPrimer()})`);
    rs.setProperty('--tex-coat', `url(${texCoat()})`);

    // від внутрішнього шару до зовнішнього
    const LAYERS = [
      { key: 'plaster', d: 14, name: 'Внутрішня штукатурка',   note: 'Рівна основа з боку приміщення' },
      { key: 'brick',   d: 92, name: 'Несуча стіна',           note: 'Цегла, бетон, газоблок чи дерево' },
      { key: 'primer',  d: 6,  name: 'Ґрунтовка',              note: 'Міцне зчеплення піни з основою' },
      { key: 'foam',    d: 64, name: 'Пінополіуретан (ППУ)',   note: 'Безшовний шар без мостиків холоду' },
      { key: 'coat',    d: 10, name: 'Поліуретанове покриття', note: 'Захист від вологи та ультрафіолету' }
    ];
    const H = 380, GAP = 62;
    const total = LAYERS.reduce((s, l) => s + l.d, 0);
    const n = LAYERS.length;

    const floor = document.getElementById('floor');
    const svg = document.getElementById('callouts');
    const labelsBox = document.getElementById('labels');
    const hero = document.getElementById('top');
    const hint = document.getElementById('scrollHint');
    const meta = document.getElementById('stageMeta');
    const NS = 'http://www.w3.org/2000/svg';

    let acc = -total / 2;
    const items = LAYERS.map((L, i) => {
      const k = n - 1 - i;                       // порядок від зовнішнього шару
      const side = k % 2 === 0 ? 'top' : 'bottom';

      const el = document.createElement('div');
      el.className = `layer layer--${L.key}`;
      el.style.setProperty('--d', `${L.d}px`);
      el.innerHTML =
        '<div class="face face--front"></div>' +
        `<div class="face face--right"><span class="anchor anchor--${side}"></span></div>` +
        '<div class="face face--top"></div>';
      wall.appendChild(el);

      const label = document.createElement('div');
      label.className = 'callout';
      label.innerHTML = `<span class="callout__num">${String(k + 1).padStart(2, '0')}</span><div><b>${L.name}</b><small>${L.note}</small></div>`;
      labelsBox.appendChild(label);

      const path = document.createElementNS(NS, 'path');
      const ring = document.createElementNS(NS, 'circle');
      const dot = document.createElementNS(NS, 'circle');
      ring.setAttribute('r', '7'); ring.setAttribute('class', 'ring');
      dot.setAttribute('r', '2.5');
      svg.append(path, ring, dot);

      const z0 = acc + L.d / 2;
      acc += L.d;
      return { i, k, side, el, label, path, ring, dot, anchor: el.querySelector('.anchor'), z0, x: 0, lw: 0, lh: 0 };
    });

    let stageW = 0, stageH = 0, baseScale = 1;
    function measure() {
      const r = stage.getBoundingClientRect();
      stageW = r.width; stageH = r.height;
      const small = stageW < 600;
      const band = small ? 46 : 70;
      baseScale = Math.max(.38, Math.min((stageW - 16) / (small ? 620 : 560), (stageH - band * 2) / 470, 1.02));
      const labelW = small ? Math.min(150, Math.floor((stageW - 12) / 3) - 6) : 176;
      items.forEach(it => {
        it.label.style.setProperty('--lw', `${labelW}px`);
        it.lw = labelW;
        it.lh = it.label.offsetHeight;
      });
    }

    // стан анімації
    let target = 0, cur = 0;
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let heroVisible = true;
    let lastMeta = '';

    function readScroll() {
      const r = hero.getBoundingClientRect();
      const span = r.height - innerHeight;
      target = span > 0 ? clamp(-r.top / span) : 0;
    }

    if (finePointer && !reduceMotion) {
      hero.addEventListener('pointermove', e => {
        tmx = (e.clientX / innerWidth) * 2 - 1;
        tmy = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
    }

    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; }, { rootMargin: '100px' }).observe(hero);

    // розставляє підписи одного ряду без накладань
    function layoutSide(list) {
      list.sort((a, b) => a.ax - b.ax);
      const gap = 6;
      list.forEach(it => { it.x = clamp(it.ax - it.lw / 2, 0, stageW - it.lw); });
      for (let j = 1; j < list.length; j++) list[j].x = Math.max(list[j].x, list[j - 1].x + list[j - 1].lw + gap);
      const last = list[list.length - 1];
      if (last) last.x = Math.min(last.x, stageW - last.lw);
      for (let j = list.length - 2; j >= 0; j--) list[j].x = Math.min(list[j].x, list[j + 1].x - list[j].lw - gap);
      list.forEach(it => { it.x = Math.max(0, it.x); });
    }

    function frame(time) {
      requestAnimationFrame(frame);
      if (!heroVisible) return;

      cur += (target - cur) * (reduceMotion ? 1 : .085);
      if (Math.abs(target - cur) < .0004) cur = target;
      mx += (tmx - mx) * .06; my += (tmy - my) * .06;

      const e = easeInOut(clamp(cur / .78));
      const idle = reduceMotion ? 0 : Math.sin(time / 1600) * 1.6 * (1 - e);
      const rotY = -34 - 24 * e + mx * 6 * (1 - e * .4) + idle;
      const rotX = -13 - 6 * e - my * 3;
      const s = baseScale * (1.1 - .1 * e);

      wall.style.transform = `translateX(${stageW * .035 * e}px) scale(${s}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      wall.style.setProperty('--sheen', `${-35 + 70 * e + mx * 12}%`);

      items.forEach(it => {
        const z = it.z0 + (it.i - (n - 1) / 2) * GAP * e;
        const y = -(it.i - (n - 1) / 2) * 9 * e;
        it.el.style.transform = `translate3d(0, ${y}px, ${z}px)`;
      });

      floor.style.transform = `translateY(${(H / 2 + 22) * s}px) rotateX(90deg) scale(${s * (1 + .45 * e)}, ${s})`;

      // виноски: проєкція якорів 3D-шарів у координати сцени
      const sr = stage.getBoundingClientRect();
      const tops = [], bottoms = [];
      items.forEach(it => {
        const a = it.anchor.getBoundingClientRect();
        it.ax = a.left + a.width / 2 - sr.left;
        it.ay = a.top + a.height / 2 - sr.top;
        it.t = easeOut(clamp((e - (.12 + it.k * .12)) / .22));
        (it.side === 'top' ? tops : bottoms).push(it);
      });
      layoutSide(tops); layoutSide(bottoms);

      const pad = stageW < 600 ? 6 : 16;
      items.forEach(it => {
        const ly = it.side === 'top' ? pad : stageH - it.lh - pad;
        const shift = (1 - it.t) * (it.side === 'top' ? -10 : 10);
        it.label.style.transform = `translate3d(${it.x}px, ${ly + shift}px, 0)`;
        it.label.style.opacity = it.t;

        const edgeY = it.side === 'top' ? ly + it.lh : ly;
        const lx = clamp(it.ax, it.x + 14, it.x + it.lw - 14);
        const elbow = it.side === 'top' ? edgeY + 14 : edgeY - 14;
        it.path.setAttribute('d', `M${it.ax.toFixed(1)},${it.ay.toFixed(1)} V${elbow.toFixed(1)} H${lx.toFixed(1)} V${edgeY.toFixed(1)}`);
        it.path.style.opacity = it.t * .9;
        it.dot.setAttribute('cx', it.ax); it.dot.setAttribute('cy', it.ay);
        it.ring.setAttribute('cx', it.ax); it.ring.setAttribute('cy', it.ay);
        it.dot.style.opacity = it.t;
        it.ring.style.opacity = it.t * .55;
      });

      hint.classList.toggle('is-hidden', cur > .04);
      stage.classList.toggle('is-exploded', e > .1);
      const m = e > .55 ? 'ШАРИ 05 · РОЗКЛАДЕНО' : 'ШАРИ 05 · ЗІБРАНО';
      if (m !== lastMeta) { meta.textContent = m; lastMeta = m; }
    }

    measure();
    readScroll();
    cur = target;
    addEventListener('scroll', readScroll, { passive: true });
    addEventListener('resize', () => { measure(); readScroll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    requestAnimationFrame(frame);
  }

  /* =======================================================
     3. Шапка, меню, dock
     ======================================================= */
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const dock = document.getElementById('dock');
  const contact = document.getElementById('contact');
  const heroEl = document.getElementById('top');
  let contactVisible = false;

  function onScroll() {
    header.classList.toggle('is-scrolled', scrollY > 10);
    const heroEnd = heroEl ? heroEl.getBoundingClientRect().bottom : 0;
    dock.classList.toggle('is-visible', heroEnd < innerHeight * .6 && !contactVisible);
  }
  addEventListener('scroll', onScroll, { passive: true });
  new IntersectionObserver(([en]) => { contactVisible = en.isIntersecting; onScroll(); }, { threshold: .15 }).observe(contact);
  onScroll();

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* =======================================================
     4. Поява блоків, підсвітка карток, лічильники
     ======================================================= */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      revealIO.unobserve(en.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => revealIO.observe(el));

  // світлова пляма на картці слідує за курсором
  if (finePointer) {
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      }, { passive: true });
    });
  }

  const countIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      if (reduceMotion) return;
      const el = en.target;
      const to = +el.dataset.count;
      const t0 = performance.now(), dur = 1600;
      const tick = now => {
        const t = clamp((now - t0) / dur);
        el.textContent = Math.round(to * easeOut(t));
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }, { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => countIO.observe(el));

  /* =======================================================
     5. Каталог → форма, валідація, відправка
     ======================================================= */
  const form = document.getElementById('leadForm');
  const topic = form.elements.topic;
  const nameInput = form.elements.name;
  const phoneInput = form.elements.phone;

  document.querySelectorAll('[data-service]').forEach(link => {
    link.addEventListener('click', () => {
      topic.value = link.dataset.service;
      setTimeout(() => nameInput.focus({ preventScroll: true }), 700);
    });
  });

  const normalizePhone = v => {
    let d = v.replace(/\D/g, '');
    if (d.length === 10 && d.startsWith('0')) d = '38' + d;
    return d.length === 12 && d.startsWith('380') ? '+' + d : null;
  };
  [nameInput, phoneInput].forEach(inp => inp.addEventListener('input', () => inp.closest('.field').classList.remove('err')));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const phone = normalizePhone(phoneInput.value);
    nameInput.closest('.field').classList.toggle('err', !name);
    phoneInput.closest('.field').classList.toggle('err', !phone);
    if (!name) { nameInput.focus(); return; }
    if (!phone) { phoneInput.focus(); return; }

    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    const payload = { name, phone, topic: topic.value, msg: form.elements.msg.value.trim(), page: location.href };
    btn.disabled = true;
    btn.textContent = 'Надсилаємо…';
    try {
      if (FORM_ENDPOINT) {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(String(res.status));
      } else {
        console.warn('[Teplorium] FORM_ENDPOINT не налаштовано — заявка нікуди не відправлена:', payload);
      }
      form.classList.add('sent');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = label;
      alert('Не вдалося надіслати заявку. Зателефонуйте нам: +380 50 767 51 39');
    }
  });

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
