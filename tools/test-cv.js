// Accuracy harness for trophy-cv.js against the labelled screenshots in CV/.
//   CV/Completed_dataset  - every trophy on each page is won
//   CV/Incomplete_dataset - no trophies won
//   CV/Test_dataset       - mixed; ground truth in answer.json
// Run: node tools/test-cv.js [--verbose]
const fs = require('fs');
const path = require('path');
const { decodePng } = require('./png');
const { analyzeTrophyScreenshot } = require('../trophy-cv');

const ROOT = path.join(__dirname, '..');
const layout = require('../data/trophy-room.json');
const verbose = process.argv.includes('--verbose');

const datasets = [
  { dir: 'CV/Completed_dataset', truth: () => true },
  { dir: 'CV/Incomplete_dataset', truth: () => false },
  (() => {
    const ans = new Set(require('../CV/Test_dataset/answer.json').completed);
    return { dir: 'CV/Test_dataset', truth: id => ans.has(id) };
  })(),
];

let total = 0, wrong = 0, failedImages = 0;
let minWon = Infinity, maxLost = -Infinity;
for (const ds of datasets) {
  const files = fs.readdirSync(path.join(ROOT, ds.dir)).filter(f => f.endsWith('.png')).sort();
  for (const f of files) {
    const img = decodePng(path.join(ROOT, ds.dir, f));
    const res = analyzeTrophyScreenshot(img, layout);
    if (!res.ok) {
      failedImages++;
      console.log(`FAIL  ${ds.dir}/${f}: ${res.error}`);
      continue;
    }
    const errs = [];
    for (const s of res.slots) {
      if (s.raceId === null) continue;
      total++;
      const expected = ds.truth(s.raceId);
      if (expected) minWon = Math.min(minWon, s.score);
      else maxLost = Math.max(maxLost, s.score);
      if (s.won !== expected) {
        wrong++;
        errs.push(`${s.raceId} expected ${expected ? 'won' : 'not won'} (score ${s.score.toFixed(3)})`);
      }
    }
    const tag = errs.length ? 'ERR ' : 'ok  ';
    console.log(`${tag}  ${ds.dir}/${f}: page ${res.pageIndex}/${res.dotCount}, pitch ${res.dots.pitch.toFixed(1)}` +
      (errs.length ? '\n        ' + errs.join('\n        ') : ''));
    if (verbose) {
      console.log('        scores: ' + res.slots.map(s => s.score.toFixed(3)).join(' '));
    }
  }
}
console.log(`\n${total - wrong}/${total} slots correct, ${failedImages} images failed.`);
console.log(`Lowest won score ${minWon.toFixed(3)}, highest not-won score ${maxLost.toFixed(3)}`);
process.exit(wrong || failedImages ? 1 : 0);
