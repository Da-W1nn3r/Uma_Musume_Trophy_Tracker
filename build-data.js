// One-time data pipeline: converts raw gametora race_instances JSON into
// data/races.json for the tracker app. Run with: node build-data.js
//
// To refresh source data (gametora updates it as new races/scenarios ship):
//   1. curl https://gametora.com/data/manifests/umamusume.json -o raw/manifest.json
//   2. Look up the current hash for "race_instances" in that manifest
//   3. curl https://gametora.com/data/umamusume/race_instances.<hash>.json -o raw/race_instances.json
//   4. node build-data.js
const fs = require('fs');
const path = require('path');

const instances = require('./raw/race_instances.json');

const TRACK_NAMES = {
  10001: 'Sapporo',
  10002: 'Hakodate',
  10003: 'Niigata',
  10004: 'Fukushima',
  10005: 'Nakayama',
  10006: 'Tokyo',
  10007: 'Chukyo',
  10008: 'Kyoto',
  10009: 'Hanshin',
  10010: 'Kokura',
  10101: 'Oi',
  10103: 'Kawasaki',
  10104: 'Funabashi',
  10105: 'Morioka',
  10201: 'Longchamp',
};

const GRADE_NAMES = { 100: 'G1', 200: 'G2', 300: 'G3' };
const DIRECTION_NAMES = { 1: 'Right', 2: 'Left' };

const graded = instances.filter(r => {
  const g = r.details && r.details.grade;
  if (![100, 200, 300].includes(g)) return false;
  if (r.details.track === 99999) return false; // scenario finale battles, no fixed course
  if (Array.isArray(r.details.unreleased_servers) && r.details.unreleased_servers.includes('en')) return false; // not on global yet
  return true;
});

const byRaceId = new Map();

for (const inst of graded) {
  const d = inst.details;
  const key = d.race_id;
  if (!byRaceId.has(key)) {
    byRaceId.set(key, {
      id: d.race_id,
      name: d.name_en,
      grade: GRADE_NAMES[d.grade],
      track: TRACK_NAMES[d.track] || `Track ${d.track}`,
      surface: d.terrain === 1 ? 'Turf' : 'Dirt',
      distance: d.distance,
      direction: DIRECTION_NAMES[d.direction] || null,
      occurrences: [],
    });
  }
  const race = byRaceId.get(key);
  const occ = { year: inst.year, month: inst.month, half: inst.half };
  if (!race.occurrences.some(o => o.year === occ.year && o.month === occ.month && o.half === occ.half)) {
    race.occurrences.push(occ);
  }
}

const races = [...byRaceId.values()].sort((a, b) => {
  const gradeOrder = { G1: 0, G2: 1, G3: 2 };
  if (gradeOrder[a.grade] !== gradeOrder[b.grade]) return gradeOrder[a.grade] - gradeOrder[b.grade];
  const am = Math.min(...a.occurrences.map(o => o.month * 2 + o.half));
  const bm = Math.min(...b.occurrences.map(o => o.month * 2 + o.half));
  return am - bm;
});

for (const r of races) {
  r.occurrences.sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.half - b.half));
}

const outDir = path.join(__dirname, 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'races.json'), JSON.stringify(races, null, 2));

console.log(`Wrote ${races.length} unique races to data/races.json`);
const byGrade = races.reduce((acc, r) => { acc[r.grade] = (acc[r.grade] || 0) + 1; return acc; }, {});
console.log('By grade:', byGrade);
