function e(t,B="n/a"){if(t===null)return B;if(t===0)return"0 B";const o=["B","KB","MB","GB","TB","PB"],n=Math.min(Math.floor(Math.log(t)/Math.log(1024)),o.length-1),r=t/Math.pow(1024,n);return`${r.toFixed(r>=10||n===0?0:1)} ${o[n]}`}export{e as f};
//# sourceMappingURL=formatBytes-DTIEmw1p.js.map
