import{j as S,b2 as R,k}from"./mui-hXvMhbqI.js";import{i as $,u as x,k as F,b9 as H,aF as b,aG as f,aH as c}from"./index-DHdh7mfu.js";import{u as N}from"./useEsQuery-DSbixzGU.js";function C(e){if(!e)return"unknown";const t=e.toLowerCase().trim();return t==="linux"?"linux":t==="windows"?"windows":t==="darwin"||t==="macos"?"macos":"unknown"}function z(e,t,n,i){const r=C(n),l=n?.toLowerCase().trim()??"unknown",o=e?.trim(),p=t?.trim(),d=i?.trim();return{hostId:o||(p?`${p}::${l}`:void 0)||d||"unknown",displayName:p||o||"unknown",osType:r}}function q(e){switch(e){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return L(e)}}function L(e){throw new Error(`Unhandled host OS type: ${String(e)}`)}function U(e){return e==null?"—":`${(e*100).toFixed(1)}%`}function W(e){return e==null?"—":e.toLocaleString()}function G(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString()}function Q(e){return e==null?"—":e.toFixed(2)}function j(e){return e==null?"—":e<1024?`${e.toFixed(1)} B/s`:e<1024*1024?`${(e/1024).toFixed(1)} KB/s`:e<1024*1024*1024?`${(e/1024/1024).toFixed(2)} MB/s`:`${(e/1024/1024/1024).toFixed(2)} GB/s`}function K({label:e,value:t}){return S.jsxs(R,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[S.jsx(k,{variant:"body2",color:"text.secondary",children:e}),S.jsx(k,{variant:"h5",sx:{fontWeight:700,mt:.5},children:t})]})}function P({query:e,queryKey:t,buildRequest:n,enabled:i=!0}){const r=$(s=>s.connection),l=$(s=>s.activeProfileId),o=e?.trim()??"",p=i&&!!r&&o.length>0;let d=null,h=null;if(p)try{h=n?n(o):{query:o}}catch(s){d=s instanceof Error?s:new Error(String(s))}const y=p&&d==null,_=x({queryKey:t??["esql",l,r?.url,o,h],queryFn:async({signal:s})=>{if(!r||!h)throw new Error("Cannot execute ES|QL query without an active connection and non-empty query.");return H(r).execute(h,s)},enabled:y,retry:!1,refetchOnWindowFocus:!1,refetchOnReconnect:!1});return N(r,()=>{y&&_.refetch()}),{data:_.data??null,loading:_.isFetching,error:(()=>{if(d!=null)return d.message;if(_.error==null)return null;const s=_.error;return s instanceof DOMException&&s.name==="AbortError"?null:s instanceof Error||F(s)?s.message:String(s)})(),refetch:_.refetch}}function A(e){return e.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const E='CONCAT(COALESCE(host.name, TO_STRING(host.ip), "unknown"), "::", COALESCE(os.type, "unknown"))',w=new Set(["system.disk.io","system.network.io"]);function V(e){return/\.\d/.test(e)?`\`${e}\``:e}function M(e){const t=V(e);return w.has(e)?`SUM(RATE(${t}))`:`MAX(AVG_OVER_TIME(${t}))`}function g(e){const t=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType)if(e.osType==="unknown")t.push('os.type == "unknown"');else{const n=e.osType==="macos"?"darwin":e.osType;t.push(`os.type == "${n}"`)}if(e.search){const n=A(e.search);t.push(`host.name LIKE "*${n}*"`)}return t}function Y(e){return`FROM metrics-hostmetricsreceiver*
| WHERE ${g(e).join(" AND ")}
| EVAL host_key = ${E}
| STATS
    host_name = MAX(host.name),
    os_type = MAX(os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    os_full = MAX(host.os.full),
    last_seen = MAX(@timestamp),
    cpu_utilization = MAX(system.cpu.utilization),
    memory_utilization = MAX(system.memory.utilization),
    process_count = MAX(system.processes.count),
    load_avg_1m = MAX(\`system.cpu.load_average.1m\`),
    host_arch = MAX(host.arch),
    host_ip = MAX(host.ip)
  BY host_key
| SORT last_seen DESC`}function J(e,t){const n=A(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${E} == "${n}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${E},
    host_name = host.name,
    os_type = os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    os_full = host.os.full,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    load_avg_1m = \`system.cpu.load_average.1m\`,
    host_arch = host.arch,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, os_full, last_seen, cpu_utilization, memory_utilization, process_count, load_avg_1m, host_arch, host_ip`}function Z(e,t){return`TS metrics-hostmetricsreceiver*
| WHERE ${g(t).join(" AND ")}
| STATS metric_value = ${M(e)}
    BY bucket = BUCKET(@timestamp, 20, ${t.timeFrom}, ${t.timeTo})
| SORT bucket ASC`}function ee(e){return`TS metrics-hostmetricsreceiver*
| WHERE ${g(e).join(" AND ")}
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${e.timeFrom}, ${e.timeTo})
| SORT bucket ASC`}function te(e,t,n){const i=A(e);return`TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${E} == "${i}"
| STATS metric_value = ${M(t)}
    BY bucket = BUCKET(@timestamp, 20, ${n.timeFrom}, ${n.timeTo})
| SORT bucket ASC`}function ne(e,t){const n=A(e);return`TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${E} == "${n}"
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${t.timeFrom}, ${t.timeTo})
| SORT bucket ASC`}function oe(e){if(!e?.columns||!e.values)return[];const t=b(e.columns),n=f(t,"bucket"),i=f(t,"metric_value");return n<0||i<0?[]:e.values.map(r=>({bucket:String(c(r,n)??""),value:typeof c(r,i)=="number"?c(r,i):0})).filter(r=>r.bucket)}function se(e){if(!e?.columns||!e.values)return[];const t=b(e.columns),n=f(t,"bucket"),i=f(t,"load_1m"),r=f(t,"load_5m"),l=f(t,"load_15m");return n<0?[]:e.values.map(o=>({bucket:String(c(o,n)??""),load1m:typeof c(o,i)=="number"?c(o,i):0,load5m:typeof c(o,r)=="number"?c(o,r):0,load15m:typeof c(o,l)=="number"?c(o,l):0})).filter(o=>o.bucket)}function a(e,t){return e.findIndex(n=>n.name===t)}function m(e,t){if(t<0||t>=e.length)return"";const n=e[t];return typeof n=="string"?n:n!=null?String(n):""}function T(e,t){if(t<0||t>=e.length)return null;const n=e[t];return typeof n=="number"&&Number.isFinite(n)?n:null}function re(e){const t=e.columns??[],n=e.values??[];if(t.length===0||n.length===0)return[];const i=a(t,"host_key"),r=a(t,"host_name"),l=a(t,"os_type"),o=a(t,"os_name"),p=a(t,"os_version"),d=a(t,"os_full"),h=a(t,"last_seen"),y=a(t,"cpu_utilization"),_=a(t,"memory_utilization"),s=a(t,"process_count"),v=a(t,"load_avg_1m"),O=a(t,"host_arch"),I=a(t,"host_ip");return n.map(u=>({hostId:m(u,i)||"unknown",hostName:m(u,r),osType:C(m(u,l)),osName:m(u,o),osVersion:m(u,p),osFull:m(u,d),lastSeen:m(u,h),cpuUtilization:T(u,y),memoryUtilization:T(u,_),processCount:T(u,s),loadAvg1m:T(u,v),hostArch:m(u,O),hostIp:m(u,I)||void 0}))}export{K as M,U as a,Q as b,W as c,ee as d,Z as e,G as f,oe as g,j as h,Y as i,re as j,ne as k,te as l,J as m,q as o,se as p,z as t,P as u};
//# sourceMappingURL=hostHelpers-B9lVH0B0.js.map
