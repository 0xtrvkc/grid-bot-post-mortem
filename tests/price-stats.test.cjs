const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../price-stats.js');
const fs=require('node:fs'),vm=require('node:vm');
function feed(n=100,r=.001){const d={};for(let i=0;i<n;i++)d[new Date(Date.UTC(2026,0,1,i)).toISOString().slice(0,16)]=100*Math.exp(r*i);return d;}
function stats(d){const keys=Object.keys(d).sort();return P.calculate(d,keys[0],keys.at(-1));}
test('constant log-return path has analytical compound return and no drawdown',()=>{
 const s=stats(feed());assert.equal(s.n,99);assert.equal(s.maxDD,0);assert.equal(s.skew,null);assert.equal(s.kurt,null);
 assert.ok(Math.abs(s.robustness.returnLow-Math.expm1(.099)*100)<1e-8);assert.equal(s.robustness.drawdown95,0);
});
test('constant losses include the initial equity peak in resampled drawdown',()=>{
 const s=stats(feed(100,-.001));assert.ok(Math.abs(s.robustness.drawdown95+Math.expm1(-.099)*100)<1e-8);
});
test('missing hourly bars are never treated as one-hour changes',()=>{
 const d=feed();delete d[Object.keys(d)[40]];const s=stats(d);assert.equal(s.gaps,1);assert.equal(s.n,97);
 assert.ok(s.rets.every(r=>Math.abs(r-.001)<1e-10));assert.equal(s.robustness.sampledHours,97);
});
test('blocks do not cross gaps and resampling is deterministic',()=>{
 const segments=[Array(30).fill(.001),Array(30).fill(-.001)];const before=JSON.stringify(segments);
 const a=P.bootstrap(segments);assert.deepEqual(a,P.bootstrap(segments));assert.equal(JSON.stringify(segments),before);
 assert.equal(a.available,false); // only 14 eligible starts, below the sample guard
 const b=P.bootstrap([Array(48).fill(.001),Array(48).fill(-.001)]);assert.equal(b.eligibleStarts,50);assert.equal(b.sampledHours,96);
});
test('data validation rejects malformed times, numeric strings and invalid prices',()=>{
 const d=P.normalize({...feed(3),'2026-02-30T00:00':100,'2026-01-01T10:30':100,'2026-01-01T11:00':-1,'2026-01-01T12:00':'100'});
 assert.equal(Object.keys(d).length,3);assert.throws(()=>P.normalize({}));assert.throws(()=>P.normalize([]));
});
test('anchors cannot jump forward or use stale observations',()=>{
 const d=feed(3),keys=Object.keys(d);assert.equal(P.anchor(keys,d,keys[1]),d[keys[1]]);
 assert.throws(()=>P.anchor(keys,d,'2025-12-31T23:00'));assert.throws(()=>P.anchor(keys,d,'2026-01-01T04:00'));
});
test('short and disjoint feeds cannot produce spurious hourly risk figures',()=>{
 assert.throws(()=>stats(feed(2)));const d=feed(10);for(const k of Object.keys(d))if(Number(k.slice(11,13))%2)delete d[k];assert.throws(()=>stats(d));
});
test('UI wiring uses valid modules and labels BTC sensitivity separately from grid ROI',()=>{
 const h=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');assert.match(h,/<script src="price-stats.js"/);assert.match(h,/id="priceRobustness"/);assert.match(h,/not grid ROI/);
 for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
});
function pageHarness() {
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),nodes=new Map();
 for(const m of html.matchAll(/<[^>]+id="([^"]+)"[^>]*>/g))nodes.set(m[1],{
   textContent:'',innerHTML:'',dataset:{},style:{},value:m[0].match(/value="([^"]+)"/)?.[1]||'',
   classList:{add(){},remove(){},toggle(){}},lastElementChild:{textContent:''},querySelector(){return this.lastElementChild;},setAttribute(){},addEventListener(){},insertAdjacentHTML(_,s){this.innerHTML+=s;}
 });
 const context={PriceStats:P,document:{documentElement:{setAttribute(){}},getElementById(id){assert.ok(nodes.has(id),'missing DOM id '+id);return nodes.get(id);},querySelectorAll(){return [];}},localStorage:{getItem(){return null;}},matchMedia(){return {matches:false};},fetch(){return new Promise(()=>{});}};
 vm.createContext(context);for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],context);
 return {context,nodes};
}
test('live calculation and DOM preserve accounting and expose price diagnostics',()=>{
 const {context,nodes}=pageHarness();const d={};
 for(let t=Date.parse('2026-01-07T16:00Z'),i=0;t<=Date.parse('2026-07-15T00:00Z');t+=3600000,i++)d[new Date(t).toISOString().slice(0,16)]=70000*Math.exp(.00001*i);
 context.input=d;const v=vm.runInContext('computeFromData(input)',context);
 assert.ok(Math.abs(v.newTotal-(v.newGridProfit+v.newFloat))<1e-10);assert.ok(Math.abs(v.newBalance-(909.60+v.newTotal))<1e-10);
 context.result=v;vm.runInContext('LAST_DATA=input;renderOngoingAndCompare(result);buildVisuals(result)',context);
 assert.match(nodes.get('priceRobustness').textContent,/1,000 seeded 24-hour/);
 assert.match(nodes.get('priceRobustness').textContent,/not grid ROI/);
 for(const node of nodes.values())assert.doesNotMatch(node.textContent,/NaN|Infinity/);
 vm.runInContext('renderOngoingAndCompare(FALLBACK)',context);assert.match(nodes.get('priceRobustness').textContent,/unavailable for cached figures/);
});
test('flat price feeds render without invalid histogram coordinates',()=>{
 const {context,nodes}=pageHarness();context.flat={rets:[0,0],meanR:0,stdR:0};vm.runInContext('buildHistogram(flat)',context);
 assert.match(nodes.get('histWrap').textContent,/Flat hourly returns/);
});
