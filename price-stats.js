/* Price-index diagnostics, not a reconstructed grid equity curve. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PriceStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const HOUR = 3600000;
  function normalize(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid price feed');
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(k) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
      const t = Date.parse(k + ':00Z');
      if (Number.isFinite(t) && new Date(t).toISOString().slice(0,16) === k) clean[k] = v;
    }
    if (!Object.keys(clean).length) throw new Error('No valid hourly prices');
    return clean;
  }
  function anchor(keys, data, target) {
    // Resolve only known observations; never move forward to a later bar.
    const i = keys.findLastIndex(k => k <= target);
    if (i < 0 || Date.parse(target + 'Z') - Date.parse(keys[i] + 'Z') >= HOUR) throw new Error('Missing hourly anchor: ' + target);
    return data[keys[i]];
  }
  function quantile(a, q) {
    const sorted = [...a].sort((a,b)=>a-b), x = (sorted.length-1)*q, i = Math.floor(x);
    return sorted[i] + (sorted[Math.ceil(x)]-sorted[i])*(x-i);
  }
  function bootstrap(segments, paths=1000, block=24, seed=20261004) {
    const n = segments.reduce((a,s)=>a+s.length,0);
    const starts = [];
    segments.forEach((s,si)=>{for(let i=0;i+block<=s.length;i++) starts.push([si,i]);});
    if (n < 2*block || starts.length < block) return {available:false, reason:'Need at least 48 adjacent hourly returns and 24 eligible block starts.'};
    let state = seed >>> 0;
    const rng = () => {state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
    const returns=[], drawdowns=[];
    for(let p=0;p<paths;p++) {
      let count=0, logEquity=0, logPeak=0, dd=0;
      while(count<n) {
        const [si,from]=starts[Math.floor(rng()*starts.length)];
        for(let i=0;i<block && count<n;i++,count++) {
          logEquity+=segments[si][from+i]; logPeak=Math.max(logPeak,logEquity);
          dd=Math.max(dd,-Math.expm1(logEquity-logPeak)*100);
        }
      }
      returns.push(Math.expm1(logEquity)*100); drawdowns.push(dd);
    }
    if (!returns.every(Number.isFinite)) return {available:false,reason:'Resampled return overflow.'};
    return {available:true,paths,blockHours:block,seed,sampledHours:n,eligibleStarts:starts.length,
      eligibleReturns:segments.filter(s=>s.length>=block).reduce((a,s)=>a+s.length,0),
      returnLow:quantile(returns,.025),returnHigh:quantile(returns,.975),drawdown95:quantile(drawdowns,.95)};
  }
  function calculate(data, start, stop) {
    const keys=Object.keys(data).filter(k=>k>=start&&k<=stop).sort();
    if (keys.length<3) throw new Error('Insufficient grid-period price history');
    let peak=data[keys[0]], maxDD=0, gaps=0;
    const segments=[[]], rets=[];
    for(let i=0;i<keys.length;i++) {
      const price=data[keys[i]];peak=Math.max(peak,price);maxDD=Math.min(maxDD,(price/peak-1)*100);
      if (!i) continue;
      if(Date.parse(keys[i]+'Z')-Date.parse(keys[i-1]+'Z')!==HOUR) {gaps++;segments.push([]);continue;}
      const r=Math.log(price/data[keys[i-1]]);rets.push(r);segments.at(-1).push(r);
    }
    const n=rets.length;
    if(n<2) throw new Error('Insufficient adjacent hourly returns');
    const meanR=rets.reduce((a,b)=>a+b,0)/n;
    const moment=p=>rets.reduce((a,r)=>a+(r-meanR)**p,0)/n;
    const m2=moment(2), variance=m2*n/(n-1), sorted=[...rets].sort((a,b)=>a-b);
    const idx=Math.floor(.05*(n-1)),tail=sorted.slice(0,idx+1);
    return {n,rets,meanR,stdR:Math.sqrt(variance),maxDD,gaps,
      expectedHours:(Date.parse(stop+'Z')-Date.parse(start+'Z'))/HOUR,
      vol:Math.sqrt(variance*24*365)*100,skew:m2>1e-24?moment(3)/m2**1.5:null,kurt:m2>1e-24?moment(4)/m2**2-3:null,
      var95:sorted[idx]*100,cvar95:tail.reduce((a,b)=>a+b,0)/tail.length*100,
      downsideVol:Math.sqrt(rets.reduce((a,r)=>a+Math.min(0,r)**2,0)/n*24*365)*100,worstHour:sorted[0]*100,
      robustness:bootstrap(segments)};
  }
  return {normalize,anchor,calculate,bootstrap};
});
