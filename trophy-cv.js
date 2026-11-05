// Trophy Room screenshot detection.
//
// Works on raw RGBA pixels ({ width, height, data } — canvas ImageData shape)
// so the same code runs in the browser and in the Node test harness
// (tools/test-cv.js). No ML: it relies on the fixed in-game layout.
//
// 1. Anchor: the row of page dots under the shelves. The active page's dot
//    is bright green, the others are brown. The index of the green dot is
//    the page index across G1/G2/G3/EX (matches trophy-room.json `pages`,
//    with EX pages after them). The dot pitch gives the screenshot's scale,
//    and the dot row's centre is the horizontal centre of the shelves.
// 2. Grid: 3 columns x 5 shelves placed relative to that anchor using
//    ratios measured from reference screenshots.
// 3. Per slot: won trophies are lit gold/silver with a glow; unwon ones are
//    dark silhouettes on the red shelf. We measure the fraction of "bright"
//    pixels in the trophy area (above the name label) and threshold it.
(function (root) {
  // Geometry, in units of dot pitch, measured from reference screenshots.
  const COL_PITCH = 12.58;     // horizontal distance between columns
  const SHELF_PITCH = 10.79;   // vertical distance between shelves
  const LABEL_ABOVE_DOTS = 1.42; // bottom shelf's label line above dot row
  // Trophy sample box, relative to a slot's label line / column centre.
  const BOX_TOP = 0.90;        // x SHELF_PITCH above label line
  const BOX_BOTTOM = 0.24;     // x SHELF_PITCH above label line (skips 2-line labels)
  const BOX_HALF_W = 0.33;     // x COL_PITCH either side of column centre
  const WON_THRESHOLD = 0.025; // bright-pixel fraction above which a slot is won

  const isGreen = (r, g, b) => g > 170 && r < 190 && b < 90 && g - r > 40;
  // Inactive page dot: orange-brown, e.g. (121,64,22).
  const isDot = (r, g, b) => r > 90 && r < 170 && g > 40 && g < 100 && b < 50 && r - g > 35 && g - b > 20;
  // "Lit" pixel: anything much brighter than the dark-red shelf and
  // silhouettes. The red shelf has high R but low G/B, so key off G and B.
  const isBright = (r, g, b) => g > 120 && b > 60 || (r > 200 && g > 160);

  function findGreenBlobs(img) {
    const { width: W, height: H, data: d } = img;
    const seen = new Uint8Array(W * H);
    const blobs = [];
    const stack = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (seen[p]) continue;
        const i = p * 4;
        if (!isGreen(d[i], d[i + 1], d[i + 2])) continue;
        seen[p] = 1;
        stack.push(p);
        let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
        while (stack.length) {
          const q = stack.pop();
          n++;
          const qx = q % W, qy = (q / W) | 0;
          if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
          if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
          const nb = [qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1, q - W, q + W];
          for (const r of nb) {
            if (r < 0 || r >= W * H || seen[r]) continue;
            const j = r * 4;
            if (isGreen(d[j], d[j + 1], d[j + 2])) { seen[r] = 1; stack.push(r); }
          }
        }
        blobs.push({ n, x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
      }
    }
    return blobs;
  }

  // Scan a horizontal line for dot-coloured runs; returns run centres.
  function dotRuns(img, y, isColor, minLen) {
    const { width: W, data: d } = img;
    const runs = [];
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const i = (y * W + x) * 4;
      const hit = x < W && isColor(d[i], d[i + 1], d[i + 2]);
      if (hit && start < 0) start = x;
      if (!hit && start >= 0) {
        if (x - start >= minLen) runs.push({ c: (start + x - 1) / 2, len: x - start });
        start = -1;
      }
    }
    return runs;
  }

  // Locate the page-dot row. Returns { index, count, pitch, cx, cy } or null.
  function findDots(img) {
    const candidates = findGreenBlobs(img).filter(b =>
      b.w >= 8 && b.w <= 60 && Math.abs(b.w - b.h) <= Math.max(2, b.w * 0.2) &&
      b.n > 0.6 * b.w * b.h);
    let best = null;
    for (const b of candidates) {
      const cy = Math.round((b.y0 + b.y1) / 2);
      const cxActive = (b.x0 + b.x1) / 2;
      const minLen = Math.max(3, Math.round(b.w * 0.5));
      const brown = dotRuns(img, cy, isDot, minLen).filter(r => r.len <= b.w * 1.5);
      const dots = brown.map(r => r.c).concat([cxActive]).sort((a, c) => a - c);
      // Keep the chain of evenly spaced dots that contains the active dot.
      const ai = dots.indexOf(cxActive);
      const gap = Math.min(
        ai > 0 ? dots[ai] - dots[ai - 1] : Infinity,
        ai < dots.length - 1 ? dots[ai + 1] - dots[ai] : Infinity);
      if (!isFinite(gap) || gap > b.w * 3) continue;
      let lo = ai, hi = ai;
      while (lo > 0 && Math.abs(dots[lo] - dots[lo - 1] - gap) < gap * 0.25) lo--;
      while (hi < dots.length - 1 && Math.abs(dots[hi + 1] - dots[hi] - gap) < gap * 0.25) hi++;
      const count = hi - lo + 1;
      if (count < 4) continue;
      if (!best || count > best.count) {
        best = {
          index: ai - lo,
          count,
          pitch: (dots[hi] - dots[lo]) / (count - 1),
          cx: (dots[hi] + dots[lo]) / 2,
          cy,
        };
      }
    }
    return best;
  }

  function slotGeometry(dots) {
    const colP = COL_PITCH * dots.pitch;
    const shelfP = SHELF_PITCH * dots.pitch;
    const slots = [];
    for (let row = 0; row < 5; row++) {
      const labelY = dots.cy - LABEL_ABOVE_DOTS * dots.pitch - (4 - row) * shelfP;
      for (let col = 0; col < 3; col++) {
        const cx = dots.cx + (col - 1) * colP;
        slots.push({
          x0: Math.round(cx - BOX_HALF_W * colP),
          x1: Math.round(cx + BOX_HALF_W * colP),
          y0: Math.round(labelY - BOX_TOP * shelfP),
          y1: Math.round(labelY - BOX_BOTTOM * shelfP),
        });
      }
    }
    return slots;
  }

  function brightFraction(img, box) {
    const { width: W, height: H, data: d } = img;
    const x0 = Math.max(0, box.x0), x1 = Math.min(W - 1, box.x1);
    const y0 = Math.max(0, box.y0), y1 = Math.min(H - 1, box.y1);
    let n = 0, hit = 0;
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        const i = (y * W + x) * 4;
        n++;
        if (isBright(d[i], d[i + 1], d[i + 2])) hit++;
      }
    }
    return n ? hit / n : 0;
  }

  // Main entry. `layout` is trophy-room.json. Returns
  // { ok, error?, pageIndex, dotCount, slots: [{ raceId, won, score, box }] }
  function analyzeTrophyScreenshot(img, layout) {
    const dots = findDots(img);
    if (!dots) return { ok: false, error: 'Could not find the page indicator dots below the shelves.' };
    const slots = slotGeometry(dots);
    if (slots[0].y0 < -dots.pitch * 2) {
      return { ok: false, error: 'Screenshot is cropped too tightly — the top shelf is cut off.' };
    }
    const page = layout.pages[dots.index];
    const result = {
      ok: true,
      pageIndex: dots.index,
      dotCount: dots.count,
      isTracked: !!page,
      dots,
      slots: slots.map((box, i) => {
        const score = brightFraction(img, box);
        return {
          raceId: page ? page[i] : null,
          won: score > WON_THRESHOLD,
          score,
          box,
        };
      }),
    };
    return result;
  }

  const api = { analyzeTrophyScreenshot, findDots, slotGeometry, WON_THRESHOLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrophyCV = api;
})(typeof self !== 'undefined' ? self : this);
