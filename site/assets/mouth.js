// A side view of the mouth, facing left, drawn from a few numbers per sound: how far the jaw
// opens, where the tongue tip and body are, what the lips do, whether the soft palate is down
// (air through the nose), whether the vocal folds buzz, and where the air goes.
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const HINGE = [222, 112]; // the jaw turns around this point
  const JAW_DEG = 15; // jaw = 1 opens this many degrees

  const turn = (x, y, deg) => {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = x - HINGE[0], dy = y - HINGE[1];
    return [HINGE[0] + dx * c - dy * s, HINGE[1] + dx * s + dy * c];
  };
  const pt = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  const lerp = (a, b, t) => a + (b - a) * t;

  // A smooth curve through the points (Catmull-Rom as cubic Béziers).
  function spline(pts, closed) {
    const n = pts.length, k = 1 / 6;
    const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = 'M' + pt(pts[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      d += 'C' + pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k]) +
        ' ' + pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k]) + ' ' + pt(p2);
    }
    return closed ? d + 'Z' : d;
  }

  // ---- the sounds ----
  // jaw 0–1, round 0–1, close (lips shut) 0–1, labdent (lower lip to upper teeth) 0–1,
  // velum 0 raised – 1 lowered (nasal), tip / body [x, y] (tip null: resting behind the lower teeth),
  // curl (tip turned up), voiced, flow: oral | nasal | lateral | stop | friction, place: where to circle.
  const base = { jaw: 0.1, round: 0, close: 0, labdent: 0, velum: 0, tip: null, body: [158, 150], curl: 0, voiced: true, flow: 'oral', place: null };
  const C = (o) => Object.assign({}, base, o);
  const V = (bx, by, jaw, round, o) => Object.assign({}, base, { body: [bx, by], jaw, round: round || 0 }, o || {});
  const P = {};
  P.rest = C({ jaw: 0.06, velum: 0.7, flow: 'none', voiced: false, body: [160, 152] });
  P.p = C({ close: 1, jaw: 0.04, voiced: false, flow: 'stop', place: 'lips' });
  P.b = C({ close: 1, jaw: 0.04, flow: 'stop', place: 'lips' });
  P.m = C({ close: 1, jaw: 0.04, velum: 1, flow: 'nasal', place: 'lips' });
  P.f = C({ labdent: 1, jaw: 0.06, voiced: false, flow: 'friction', place: 'lipteeth' });
  P.v = C({ labdent: 1, jaw: 0.06, flow: 'friction', place: 'lipteeth' });
  P['θ'] = C({ tip: [72, 159], body: [150, 147], jaw: 0.16, voiced: false, flow: 'friction', place: 'teeth' });
  P['ð'] = C({ tip: [72, 159], body: [150, 147], jaw: 0.16, flow: 'friction', place: 'teeth' });
  P.t = C({ tip: [91, 133], body: [150, 140], voiced: false, flow: 'stop', place: 'ridge' });
  P.d = C({ tip: [91, 133], body: [150, 140], flow: 'stop', place: 'ridge' });
  P.n = C({ tip: [91, 133], body: [150, 141], velum: 1, flow: 'nasal', place: 'ridge' });
  P.l = C({ tip: [91, 133], body: [164, 152], jaw: 0.14, flow: 'lateral', place: 'ridge' });
  P.s = C({ tip: [93, 140], body: [146, 139], jaw: 0.05, voiced: false, flow: 'friction', place: 'ridge' });
  P.z = C({ tip: [93, 140], body: [146, 139], jaw: 0.05, flow: 'friction', place: 'ridge' });
  P['ʃ'] = C({ tip: [102, 141], body: [136, 131], round: 0.7, jaw: 0.07, voiced: false, flow: 'friction', place: 'postalv' });
  P['ʒ'] = C({ tip: [102, 141], body: [136, 131], round: 0.7, jaw: 0.07, flow: 'friction', place: 'postalv' });
  P.k = C({ body: [197, 125], jaw: 0.12, voiced: false, flow: 'stop', place: 'velum' });
  P['ɡ'] = C({ body: [197, 125], jaw: 0.12, flow: 'stop', place: 'velum' });
  P['ŋ'] = C({ body: [197, 125], jaw: 0.12, velum: 1, flow: 'nasal', place: 'velum' });
  P.h = C({ jaw: 0.35, voiced: false, flow: 'friction', place: 'glottis' });
  P.w = C({ round: 1, body: [190, 131], jaw: 0.1, place: 'lips' });
  P.r = C({ tip: [117, 129], body: [170, 147], curl: 1, round: 0.55, jaw: 0.15, place: 'palate' });
  P.j = C({ body: [126, 129], jaw: 0.1, place: 'palate' });
  P['iː'] = V(124, 128, 0.1);
  P.i = V(126, 130, 0.12);
  P['ɪ'] = V(132, 136, 0.22);
  P.e = V(134, 143, 0.34);
  P['ɛ'] = P.e;
  P['æ'] = V(138, 164, 0.8);
  P.a = V(150, 168, 0.85);
  P['ʌ'] = V(160, 157, 0.55);
  P['ɑː'] = V(178, 168, 0.85);
  P['ə'] = V(156, 151, 0.4);
  P['uː'] = V(192, 129, 0.15, 0.85);
  P['ʊ'] = V(184, 137, 0.25, 0.6);
  P['ɜː'] = V(166, 146, 0.3, 0.3, { tip: [118, 136], curl: 1 });
  P['ɚ'] = P['ɜː'];
  P['ɔː'] = V(180, 160, 0.6, 0.6);
  P.o = V(182, 148, 0.4, 0.7);
  // diphthongs glide from one shape to the next
  const GLIDES = { 'aɪ': ['a', 'ɪ'], 'eɪ': ['e', 'ɪ'], 'oʊ': ['o', 'ʊ'], 'aʊ': ['a', 'ʊ'], 'ɔɪ': ['ɔː', 'ɪ'] };

  function shapes(sym) {
    if (GLIDES[sym]) return GLIDES[sym].map((s) => P[s]);
    return [P[sym] || P['ə']];
  }

  // Everything numeric, so a change can be tweened.
  function resolve(p) {
    const deg = -p.jaw * JAW_DEG;
    const tip = p.tip || turn(90, 171, deg);
    return {
      jaw: p.jaw, round: p.round, close: p.close, labdent: p.labdent, velum: p.velum, curl: p.curl,
      tx: tip[0], ty: tip[1], bx: p.body[0], by: p.body[1],
      voiced: p.voiced, flow: p.flow, place: p.place,
    };
  }

  const PLACES = {
    lipteeth: [78, 157], teeth: [73, 158], ridge: [91, 131], postalv: [101, 131],
    palate: [126, 122], velum: [205, 121], glottis: [236, 269],
  };

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  class Mouth {
    constructor(svg, opts) {
      this.svg = svg;
      this.opts = Object.assign({ labels: true }, opts || {});
      svg.textContent = '';
      el('path', { class: 'm-neck', d: 'M138,224C164,236 176,262 180,300L256,300L252,196L196,196Z' }, svg);
      el('path', { class: 'm-wall', d: 'M138,226C164,238 176,262 180,300' }, svg);
      this.jawBack = el('g', {}, svg);
      el('path', { class: 'm-skin', d: 'M68,142L232,142L230,238C196,240 156,236 120,229C88,223 66,214 57,198C51,188 47,180 46,172L60,150Z' }, this.jawBack);
      el('path', { class: 'm-skin', d: 'M300,0L80,0C76,18 70,30 64,42C52,56 34,70 26,80C21,87 24,94 33,96C41,98 47,98 50,101C48,106 44,110 43,114L56,140L246,140L252,300L300,300Z' }, svg);
      el('path', { class: 'm-nasal', d: 'M42,95C56,84 92,78 134,78C178,78 216,86 238,102C245,108 248,118 248,126L240,126C232,114 218,107 198,106C165,102 130,104 108,110C86,116 66,108 42,95Z' }, svg);
      this.cavity = el('path', { class: 'm-cavity' }, svg);
      el('path', { class: 'm-wall', d: 'M247,124C250,170 251,232 248,300' }, svg);
      el('path', { class: 'm-palate', d: 'M82,136C84,128 92,118 112,111C135,103 170,102 198,106L198,117C170,114 140,115 116,121C104,124 96,127 92,131C89,134 86,136 82,136Z' }, svg);
      this.velumEdge = el('path', { class: 'm-velum-edge' }, svg);
      this.velum = el('path', { class: 'm-velum' }, svg);
      this.tongue = el('path', { class: 'm-tongue' }, svg);
      el('path', { class: 'm-tooth', d: 'M74,133C73,142 74,150 77,157C79,159 82,159 84,156C86,149 87,141 86,134Z' }, svg);
      this.jawFront = el('g', {}, svg);
      el('path', { class: 'm-tooth', d: 'M79,186C77,178 76,170 78,163C80,160 84,160 86,163C88,170 89,178 89,186Z' }, this.jawFront);
      this.lowerLip = el('path', { class: 'm-lip', d: 'M68,145C61,141 55,141 48,143C40,146 37,154 39,162C41,170 50,174 58,172C64,170 67,163 68,156Z' }, this.jawFront);
      this.upperLip = el('path', { class: 'm-lip', d: 'M58,108C46,110 37,117 37,126C37,134 45,139 55,139C61,139 65,137 67,133L64,112Z' }, svg);
      this.folds = el('path', { class: 'm-folds', d: 'M227,266Q236,261 245,266M227,272Q236,277 245,272' }, svg);
      this.air = el('path', { class: 'm-air' }, svg);
      this.contact = el('circle', { class: 'm-contact', r: 8 }, svg);
      if (this.opts.labels) {
        const label = (x, y, t, out) => { const e = el('text', { class: 'm-label' + (out ? ' m-label--out' : ''), x, y }, svg); e.textContent = t; };
        label(120, 93, '鼻腔');
        label(142, 113, '硬腭');
        label(208, 100, '软腭');
        label(92, 106, '上齿龈');
        el('path', { class: 'm-wall', d: 'M100,109L93,127', 'stroke-width': 0.8 }, svg);
        label(66, 125, '牙齿');
        label(160, 194, '舌');
        label(8, 128, '唇', true);
        label(254, 290, '声带');
      }
      this.cur = resolve(P.rest);
      this.render(this.cur);
    }

    show(sym) { this.set(shapes(sym)[shapes(sym).length - 1]); }

    set(params) {
      cancelAnimationFrame(this.raf);
      this.cur = resolve(params);
      this.render(this.cur);
    }

    // Move to a shape over `ms`; resolves when there.
    to(params, ms) {
      cancelAnimationFrame(this.raf);
      const from = Object.assign({}, this.cur), goal = resolve(params);
      const keys = ['jaw', 'round', 'close', 'labdent', 'velum', 'curl', 'tx', 'ty', 'bx', 'by'];
      if (!ms) { this.cur = goal; this.render(goal); return Promise.resolve(); }
      return new Promise((done) => {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const s = Object.assign({}, goal);
          keys.forEach((k) => { s[k] = lerp(from[k], goal[k], e); });
          this.cur = s;
          this.render(s);
          if (t < 1) this.raf = requestAnimationFrame(step);
          else done();
        };
        this.raf = requestAnimationFrame(step);
      });
    }

    render(s) {
      const deg = -s.jaw * JAW_DEG;
      const tf = 'rotate(' + deg.toFixed(2) + ' ' + HINGE.join(' ') + ')';
      this.jawBack.setAttribute('transform', tf);
      this.jawFront.setAttribute('transform', tf);

      // lips: rounding pushes both forward; closing brings the lower lip up to the upper one;
      // for f / v it tucks under the upper teeth
      const drop = turn(52, 156, deg)[1] - 156;
      const lx = -7 * s.round + 15 * s.labdent;
      const ly = s.close * -(drop + 3) + s.labdent * (10 - drop);
      this.lowerLip.setAttribute('transform', 'translate(' + lx.toFixed(1) + ' ' + ly.toFixed(1) + ')');
      this.upperLip.setAttribute('transform', 'translate(' + (-7 * s.round).toFixed(1) + ' 0)');
      const lipGapY = (139 + 142 + drop + ly) / 2;

      // soft palate: up against the throat, or hanging down to open the nose
      const vt = [lerp(239, 213, s.velum), lerp(121, 149, s.velum)];
      const vc = [lerp(221, 211, s.velum), lerp(113, 124, s.velum)];
      const vd = 'M196,112Q' + pt(vc) + ' ' + pt(vt);
      this.velum.setAttribute('d', vd);
      this.velumEdge.setAttribute('d', vd);

      // the space inside, its floor carried by the jaw
      const floor = [[204, 234], [160, 211], [112, 194], [86, 184], [72, 173], [68, 152]].map((p) => turn(p[0], p[1], deg));
      this.cavity.setAttribute('d', spline([
        [84, 136], [92, 131], [116, 121], [150, 116], [198, 117], [236, 123], [247, 128], [250, 180], [249, 240],
        [247, 300], [226, 300], [224, 262], [216, 248], ...floor, [67, 140],
      ], true));

      // tongue
      const T = [s.tx, s.ty], B = [s.bx, s.by];
      const blade = [(s.bx + s.tx) / 2, (s.by + s.ty) / 2 - 3 - s.curl * 2];
      const under = s.curl ? [s.tx - 7, s.ty + 12] : [s.tx + 8, s.ty + 9];
      const back = [Math.min(s.bx + 44, 210), Math.max(s.by + 20, 164)];
      const f1 = turn(112, 189, deg), f2 = turn(162, 206, deg);
      this.tongue.setAttribute('d', spline([[205, 226], [214, 196], back, B, blade, T, under, f1, f2], true));

      this.folds.classList.toggle('is-voiced', !!s.voiced);

      // air: up the throat, then out through the mouth or the nose (or held, for a stop)
      const G = [236, 262], up = [241, 212], top = [239, 152];
      let path = null;
      if (s.flow === 'nasal') {
        path = [G, up, [242, 136], [240, 116], [226, 99], [180, 90], [112, 89], [62, 92], [22, 94]];
      } else if (s.flow !== 'none') {
        const over = [s.bx, (s.by + 117) / 2];
        const pts = [G, up, top, [214, Math.min(138, s.by - 4)], over];
        if (s.flow === 'stop') {
          if (s.place === 'lips') pts.push([92, (124 + s.ty) / 2], [70, lipGapY]);
          else if (s.place === 'ridge') pts.push([s.tx + 12, s.ty - 1]);
          else pts.pop();
        } else if (s.place === 'teeth') {
          pts.push([s.tx + 12, s.ty - 6], [s.tx - 2, s.ty - 2], [16, s.ty - 1]);
        } else if (s.place === 'lipteeth') {
          pts.push([96, 146], [80, 156], [62, 157], [18, 156]);
        } else {
          if (s.place === 'ridge' || s.place === 'postalv') pts.push([s.tx + 4, s.ty - 6]);
          pts.push([80, Math.max(s.ty - 8, (157 + 161 + drop) / 2)], [52, lipGapY], [16, lipGapY]);
        }
        path = pts;
      }
      if (path) {
        this.air.setAttribute('d', spline(path, false));
        this.air.style.display = '';
      } else {
        this.air.style.display = 'none';
      }

      let spot = s.place && PLACES[s.place];
      if (s.place === 'lips') spot = [46 + lx * 0.5, lipGapY];
      if (spot) {
        this.contact.setAttribute('cx', spot[0].toFixed(1));
        this.contact.setAttribute('cy', spot[1].toFixed(1));
        this.contact.style.display = '';
      } else {
        this.contact.style.display = 'none';
      }
    }
  }

  window.OMMouth = { Mouth, shapes, spline, PHONES: P };
})();
