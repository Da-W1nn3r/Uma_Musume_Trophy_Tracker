// Screenshot scanning UI. Detection itself lives in trophy-cv.js; this file
// wires up the "Scan screenshots" dialog. Uses app.js globals (trophyRoom,
// raceById, completed, races, saveCompleted, render, celebrate) at call time.

// Each entry: { file, url, result } where result.slots[i].won may be
// toggled by the user before applying.
let scans = [];

function initScanner() {
  const dialog = document.getElementById('scan-dialog');
  const fileInput = document.getElementById('scan-file');
  document.getElementById('scan-btn').addEventListener('click', () => fileInput.click());
  document.getElementById('scan-more').addEventListener('click', () => fileInput.click());
  document.getElementById('scan-close').addEventListener('click', () => dialog.close());
  document.getElementById('scan-apply').addEventListener('click', applyScans);
  dialog.addEventListener('close', () => {
    scans.forEach(s => URL.revokeObjectURL(s.url));
    scans = [];
    document.getElementById('scan-results').innerHTML = '';
  });
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    if (!files.length) return;
    if (!dialog.open) {
      renderScans();
      dialog.showModal();
    }
    for (const file of files) {
      const url = URL.createObjectURL(file);
      let result;
      try {
        const img = await loadImageData(url);
        result = TrophyCV.analyzeTrophyScreenshot(img, trophyRoom);
      } catch (err) {
        result = { ok: false, error: 'Could not read image: ' + err.message };
      }
      scans.push({ file, url, result });
      renderScans();
    }
  });
}

function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error('unsupported image format'));
    img.src = url;
  });
}

function pageLabel(pageIndex) {
  const b = trophyRoom.gradeBoundary;
  if (pageIndex < b.g1End) return `G1 page ${pageIndex + 1}`;
  if (pageIndex < b.g2End) return `G2 page ${pageIndex - b.g1End + 1}`;
  if (pageIndex < trophyRoom.pages.length) return `G3 page ${pageIndex - b.g2End + 1}`;
  return `EX page ${pageIndex - trophyRoom.pages.length + 1}`;
}

// Latest scan per page wins, so re-scanning a page replaces the old result.
function effectiveScans() {
  const byPage = new Map();
  for (const s of scans) {
    if (s.result.ok && s.result.isTracked) byPage.set(s.result.pageIndex, s);
  }
  return byPage;
}

function scanMessage(info, text) {
  const msg = document.createElement('p');
  msg.className = 'scan-msg';
  msg.textContent = text;
  info.appendChild(msg);
}

function renderScans() {
  const container = document.getElementById('scan-results');
  container.innerHTML = '';
  const effective = new Set(effectiveScans().values());

  for (const scan of scans) {
    const { result } = scan;
    const card = document.createElement('div');
    card.className = 'scan-card';

    const preview = document.createElement('div');
    preview.className = 'scan-preview';
    const img = document.createElement('img');
    img.alt = scan.file.name;
    preview.appendChild(img);
    card.appendChild(preview);

    const info = document.createElement('div');
    info.className = 'scan-info';
    const title = document.createElement('div');
    title.className = 'scan-title';
    info.appendChild(title);
    card.appendChild(info);
    container.appendChild(card);

    if (!result.ok) {
      card.classList.add('error');
      title.textContent = scan.file.name;
      scanMessage(info, result.error);
      img.src = scan.url;
      continue;
    }

    title.textContent = pageLabel(result.pageIndex);
    if (!result.isTracked) {
      card.classList.add('error');
      scanMessage(info, 'EX trophies are not tracked by this app, so this page is skipped.');
    } else if (!effective.has(scan)) {
      card.classList.add('superseded');
      scanMessage(info, 'This page was scanned again later; the newer screenshot is used.');
    }

    // Outline each detected slot on the preview (positions as % of image).
    img.addEventListener('load', () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      for (const slot of result.slots) {
        if (slot.raceId === null) continue;
        const box = document.createElement('div');
        box.className = 'scan-box' + (slot.won ? ' won' : '');
        box.style.left = (slot.box.x0 / W * 100) + '%';
        box.style.top = (slot.box.y0 / H * 100) + '%';
        box.style.width = ((slot.box.x1 - slot.box.x0) / W * 100) + '%';
        box.style.height = ((slot.box.y1 - slot.box.y0) / H * 100) + '%';
        preview.appendChild(box);
      }
    }, { once: true });
    img.src = scan.url;

    if (!result.isTracked) continue;
    const list = document.createElement('div');
    list.className = 'scan-slots';
    for (const slot of result.slots) {
      if (slot.raceId === null) continue;
      const race = raceById.get(slot.raceId);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'scan-chip' + (slot.won ? ' won' : '');
      chip.textContent = (slot.won ? '🏆 ' : '') + (race ? race.name : `#${slot.raceId}`);
      chip.title = slot.won
        ? 'Detected as won. Click to mark not won.'
        : 'Detected as not won. Click to mark won.';
      chip.addEventListener('click', () => {
        slot.won = !slot.won;
        renderScans();
      });
      list.appendChild(chip);
    }
    info.appendChild(list);
  }
  updateScanSummary();
}

function updateScanSummary() {
  const pages = effectiveScans();
  let won = 0, newlyWon = 0;
  for (const s of pages.values()) {
    for (const slot of s.result.slots) {
      if (slot.raceId === null || !slot.won) continue;
      won++;
      if (!completed.has(slot.raceId)) newlyWon++;
    }
  }
  document.getElementById('scan-summary').textContent = pages.size
    ? `${pages.size} page${pages.size === 1 ? '' : 's'} · ${won} won · ${newlyWon} new`
    : (scans.length ? 'No usable pages yet' : 'Reading screenshots...');
  document.getElementById('scan-apply').disabled = pages.size === 0;
}

function applyScans() {
  const uncheck = document.getElementById('scan-uncheck').checked;
  const before = completed.size;
  for (const s of effectiveScans().values()) {
    for (const slot of s.result.slots) {
      if (slot.raceId === null) continue;
      if (slot.won) completed.add(slot.raceId);
      else if (uncheck) completed.delete(slot.raceId);
    }
  }
  saveCompleted();
  document.getElementById('scan-dialog').close();
  render();
  if (completed.size > before && completed.size === races.length) celebrate();
}
