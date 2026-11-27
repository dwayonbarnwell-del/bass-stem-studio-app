const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({window: {}, localStorage: {getItem: () => null}});
const scripts = [...fs.readFileSync('index.html', 'utf8').matchAll(/src="\.\/ear-source\/([^"?]+)\?[^"]+"/g)];
for (const [, file] of scripts) {
  vm.runInContext(fs.readFileSync('ear-source/' + file, 'utf8'), context, {filename: file});
  if (file === 'practice-series-rc373.js') break;
}
const {BassPracticeCore: practice, BassFillCore: fills, BassPracticeCatalogue: catalogue,
  BassStudyGroups: groups, BassPracticeSeries: series, BassAccompaniment: accompaniment,
  BassUploadedCore: uploads, BassRecordedPhrases: phrases} = context.window;
const kinds = {basslines: practice.lines, runs: practice.runs, fills: fills.styles};
const genres = new Set(Object.keys(context.window.BassGenreScores).concat('gospel', 'reggae'));
const patterns = [];
for (const [kind, rows] of Object.entries(kinds)) {
  const counts = new Map();
  for (const [idea, row] of rows.entries()) {
    if (!catalogue.visible(kind, row.id) || (kind !== 'basslines' && !groups.visible(kind, idea))) continue;
    const parts = kind === 'basslines' ? practice.phrases(row.degrees).length : 1;
    for (let part = 0; part < parts; part++) {
      if (!catalogue.visible(kind, row.id + '/' + part)) continue;
      let genre = kind === 'basslines' ? accompaniment.category(row) : groups.groupOf(kind, idea);
      if (genre === 'african-praise') genre = 'praise';
      if (row.curated?.recordedStudy && ['World Methods','Bass Lady','Bassmatics'].includes(row.curated.recordedStudy.family)) continue;
      counts.set(genre, (counts.get(genre) || 0) + 1);
      patterns.push({kind, idea, part, id: row.id, added: !!row.id?.startsWith('study382-')});
    }
  }
  if (kind === 'basslines') {
    counts.set('reggae', uploads.items.filter(r => r.group === 'reggae' && catalogue.visible('uploaded', r.id))
      .filter(r => phrases[r.id]?.some((_, i) => catalogue.visible('uploaded',r.id+'/'+i))).length);
  }
  for (const genre of genres) assert(counts.get(genre) >= 20, kind + ' ' + genre);
}
const contours = new Map();
patterns.sort((a,b) => Number(a.added) - Number(b.added));
for (const p of patterns) {
  const plan = practice.make(p.kind, {...p, key: 0, from: 1, to: 4, bpm: 90});
  const anchor = plan.bass[0].midi;
  const contour = plan.bass.map(n => n.midi - anchor).join(',');
  if (p.added) {
    assert(!contours.has(contour), p.id + ' repeats the melody of ' + contours.get(contour));
    assert(series.label(p.kind,p.idea,p.part)?.startsWith('Practice '));
    assert(plan.bass.every(n => n.length > 0 && n.midi >= 23 && n.midi <= 59));
  }
  contours.set(contour,p.id);
}
console.log(genres.size + ' genres meet the minimum across basslines, runs and fills.');
