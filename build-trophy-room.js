// One-time helper: builds data/trophy-room.json (page layout of race IDs,
// matching the in-game Trophy Room order) from a hand-transcribed mapping
// of umamusume_trophy_room_order.md to races.json IDs.
// Run with: node build-trophy-room.js
const fs = require('fs');
const path = require('path');

const races = require('./data/races.json');
const byName = new Map(races.map(r => [r.name, r.id]));

function id(name) {
  const found = byName.get(name);
  if (!found) throw new Error(`No race found named "${name}"`);
  return found;
}

// Each page is a flat array of 15 slots (3 wide x 5 tall), in reading order
// (left-to-right, top-to-bottom). `null` = empty slot (no trophy there).
const pages = [
  // ---- G1 ----
  [
    id('February Stakes'), id('Takamatsunomiya Kinen'), id('Osaka Hai'),
    id('Oka Sho'), id('Satsuki Sho'), id('Tenno Sho (Spring)'),
    id('NHK Mile Cup'), id('Victoria Mile'), id('Japanese Oaks'),
    id('Tokyo Yushun (Japanese Derby)'), id('Yasuda Kinen'), id('Takarazuka Kinen'),
    id('Sprinters Stakes'), id('Shuka Sho'), id('Kikuka Sho'),
  ],
  [
    id('Tenno Sho (Autumn)'), id('Queen Elizabeth II Cup'), id('Mile Championship'),
    id('Japan Cup'), id('Champions Cup'), id('Hanshin Juvenile Fillies'),
    id('Asahi Hai Futurity Stakes'), id('Arima Kinen'), id('Hopeful Stakes'),
    id('Tokyo Daishoten'), id('JBC Classic'), id('JBC Sprint'),
    id('JBC Ladies’ Classic'), id('Japan Dirt Derby'), id('Teio Sho'),
  ],
  [
    id('Kawasaki Kinen'), id('Zen-Nippon Junior Yushun'), id('Kashiwa Kinen'),
    id('M.C. Nambu Hai'), null, null,
    null, null, null,
    null, null, null,
    null, null, null,
  ],
  // ---- G2 ----
  [
    id('Nikkei Shinshun Hai'), id('Tokai Stakes'), id('American JCC'),
    id('Kyoto Kinen'), id('Nakayama Kinen'), id('Tulip Sho'),
    id('Yayoi Sho'), id('Kinko Sho'), id('Fillies\' Revue'),
    id('Hanshin Daishoten'), id('Spring Stakes'), id('Nikkei Sho'),
    id('Hanshin Umamusume Stakes'), id('New Zealand Trophy'), id('Milers Cup'),
  ],
  [
    id('Flora Stakes'), id('Aoba Sho'), id('Kyoto Shimbun Hai'),
    id('Keio Hai Spring Cup'), id('Meguro Kinen'), id('Sapporo Kinen'),
    id('Centaur Stakes'), id('Rose Stakes'), id('St. Lite Kinen'),
    id('Kobe Shimbun Hai'), id('All Comers'), id('Mainichi Okan'),
    id('Kyoto Daishoten'), id('Fuchu Umamusume Stakes'), id('Fuji Stakes'),
  ],
  [
    id('Swan Stakes'), id('Keio Hai Junior Stakes'), id('Copa Republica Argentina'),
    id('Daily Hai Junior Stakes'), id('Stayers Stakes'), id('Hanshin Cup'),
    id('Ladies\' Prelude'), id('Tokyo Hai'), id('Empress Hai'),
    id('Kanto Oaks'), id('Diolite Kinen'), id('Sazanka TV Hai'),
    null, null, null,
  ],
  // ---- G3 ----
  [
    id('Arlington Cup'), id('Hankyu Hai'), id('Ocean Stakes'),
    id('Nakayama Umamusume Stakes'), id('Falcon Stakes'), id('Flower Cup'),
    id('Mainichi Hai'), id('March Stakes'), id('Lord Derby Challenge Trophy'),
    id('Antares Stakes'), id('Fukushima Umamusume Stakes'), id('Niigata Daishoten'),
    id('Heian Stakes'), id('Aoi Stakes'), id('Naruo Kinen'),
  ],
  [
    id('Kyoto Kimpai'), id('Nakayama Kimpai'), id('Shinzan Kinen'),
    id('Fairy Stakes'), id('Aichi Hai'), id('Keisei Hai'),
    id('Silk Road Stakes'), id('Negishi Stakes'), id('Kisaragi Sho'),
    id('Tokyo Shimbun Hai'), id('Queen Cup'), id('Kyodo News Hai'),
    id('Kyoto Umamusume Stakes'), id('Diamond Stakes'), id('Kokura Daishoten'),
  ],
  [
    id('Mermaid Stakes'), id('Epsom Cup'), id('Unicorn Stakes'),
    id('Hakodate Sprint Stakes'), id('CBC Sho'), id('Radio Nikkei Sho'),
    id('Procyon Stakes'), id('Tanabata Sho'), id('Hakodate Kinen'),
    id('Chukyo Kinen'), id('Hakodate Junior Stakes'), id('Ibis Summer Dash'),
    id('Queen Stakes'), id('Kokura Kinen'), id('Leopard Stakes'),
  ],
  [
    id('Sekiya Kinen'), id('Elm Stakes'), id('Kitakyushu Kinen'),
    id('Niigata Junior Stakes'), id('Keeneland Cup'), id('Sapporo Junior Stakes'),
    id('Kokura Junior Stakes'), id('Niigata Kinen'), id('Shion Stakes'),
    id('Keisei Hai Autumn Handicap'), id('Sirius Stakes'), id('Saudi Arabia Royal Cup'),
    id('Artemis Stakes'), id('Fantasy Stakes'), id('Miyako Stakes'),
  ],
  [
    id('Musashino Stakes'), id('Fukushima Kinen'), id('Tokyo Sports Hai Junior Stakes'),
    id('Kyoto Junior Stakes'), id('Keihan Hai'), id('Challenge Cup'),
    id('Chunichi Shimbun Hai'), id('Capella Stakes'), id('Turquoise Stakes'),
    id('TCK Jo-o Hai'), id('Tokyo Sprint'), id('Sparking Lady Cup'),
    id('Marine Cup'), id('Queen Sho'), id('Mercury Cup'),
  ],
  [
    id('Cluster Cup'), null, null,
    null, null, null,
    null, null, null,
    null, null, null,
    null, null, null,
  ],
];

// --- Validation: every G1/G2/G3 race must appear exactly once ---
const used = pages.flat().filter(x => x !== null);
const usedSet = new Set(used);
if (used.length !== usedSet.size) throw new Error('Duplicate race id in trophy room pages');

const gradedIds = races.filter(r => ['G1', 'G2', 'G3'].includes(r.grade)).map(r => r.id);
const gradedSet = new Set(gradedIds);

const missing = gradedIds.filter(rid => !usedSet.has(rid));
const extra = used.filter(rid => !gradedSet.has(rid));
if (missing.length) throw new Error(`Missing races from trophy room: ${missing.join(', ')}`);
if (extra.length) throw new Error(`Trophy room references unknown race ids: ${extra.join(', ')}`);

const gradeBoundary = { g1End: 3, g2End: 6 }; // page indices marking where G1 pages end and G2 pages end
const output = { pageSize: 15, cols: 3, pages, gradeBoundary };

const outDir = path.join(__dirname, 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'trophy-room.json'), JSON.stringify(output, null, 2));

console.log(`Wrote ${pages.length} trophy room pages (${used.length} races) to data/trophy-room.json`);
