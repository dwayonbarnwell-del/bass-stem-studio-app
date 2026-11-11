const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const helper=html.slice(html.indexOf('  function chooseAnalysisMp3Bitrate('),html.indexOf('  function pcmFloatToInt16('));
const context={RUNPOD_RUNSYNC_RAW_SAFE_BYTES:7*1024*1024};
vm.createContext(context);vm.runInContext(helper,context);
const choose=context.chooseAnalysisMp3Bitrate;
const limit=7*1024*1024;
assert.equal(choose(1143.17,limit,32),48,'19-minute sections fit without splitting the arrangement');
assert.equal(choose(1143.17,limit),null,'bass retains its existing 64 kbps minimum');
assert.equal(choose(852.46,limit,32),64);
assert.equal(choose(703.16,limit,32),80);
assert.equal(choose(3600,limit,32),null,'unsafe sizes still rejected');
for(const duration of [305.71,368.02,376.61,469.08,477.91,541.96,545.57,559.32,577.1,654.39,659.71,702.77,703.16,852.46,1143.17]){
  const rate=choose(duration,limit,32);
  assert.ok(rate && duration*rate*1000/8<limit*.99);
}
console.log('Long section uploads: all checks passed.');
