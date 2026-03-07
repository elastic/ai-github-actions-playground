import{j as E,aY as C,k as v}from"./mui-BDStpyZI.js";import{u as g,d as M,i as O,aP as R}from"./index-CCvsvspC.js";import{u as x}from"./useEsQuery-BBA-ykYQ.js";function $(e){if(!e)return"unknown";const t=e.toLowerCase().trim();return t==="linux"?"linux":t==="windows"?"windows":t==="darwin"||t==="macos"?"macos":"unknown"}function w(e,t,n,s){const c=$(n),o=n?.toLowerCase().trim()??"unknown",a=e?.trim(),l=t?.trim(),d=s?.trim();return{hostId:a||(l?`${l}::${o}`:void 0)||d||"unknown",displayName:l||a||"unknown",osType:c}}function D(e){switch(e){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return N(e)}}function N(e){throw new Error(`Unhandled host OS type: ${String(e)}`)}function z(e){return e==null?"—":`${(e*100).toFixed(1)}%`}function B(e){return e==null?"—":e.toLocaleString()}function q(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString()}function U(e){return e==null?"—":e.toFixed(2)}function W({label:e,value:t}){return E.jsxs(C,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[E.jsx(v,{variant:"body2",color:"text.secondary",children:e}),E.jsx(v,{variant:"h5",sx:{fontWeight:700,mt:.5},children:t})]})}function Q({query:e,queryKey:t,buildRequest:n,enabled:s=!0}){const c=g(r=>r.connection),o=g(r=>r.activeProfileId),a=e?.trim()??"",l=s&&!!c&&a.length>0;let d=null,_=null;if(l)try{_=n?n(a):{query:a}}catch(r){d=r instanceof Error?r:new Error(String(r))}const h=l&&d==null,p=M({queryKey:t??["esql",o,c?.url,a,_],queryFn:async({signal:r})=>{if(!c||!_)throw new Error("Cannot execute ES|QL query without an active connection and non-empty query.");return R(c).execute(_,r)},enabled:h,retry:!1,refetchOnWindowFocus:!1,refetchOnReconnect:!1});return x(c,()=>{h&&p.refetch()}),{data:p.data??null,loading:p.isFetching,error:(()=>{if(d!=null)return d.message;if(p.error==null)return null;const r=p.error;return r instanceof Error||O(r)?r.message:String(r)})(),refetch:p.refetch}}function T(e){return e.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const f='CONCAT(COALESCE(host.name, TO_STRING(host.ip), "unknown"), "::", COALESCE(os.type, "unknown"))',H=new Set(["system.disk.io","system.network.io"]);function L(e){return/\.\d/.test(e)?`\`${e}\``:e}function k(e){const t=L(e);return H.has(e)?`SUM(RATE(${t}))`:`MAX(AVG_OVER_TIME(${t}))`}function A(e){const t=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType&&e.osType!=="unknown"){const n=e.osType==="macos"?"darwin":e.osType;t.push(`os.type == "${n}"`)}if(e.search){const n=T(e.search);t.push(`host.name LIKE "*${n}*"`)}return t}function j(e){return`FROM metrics-hostmetricsreceiver*
| WHERE ${A(e).join(" AND ")}
| EVAL host_key = ${f}
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
| SORT last_seen DESC`}function P(e,t){const n=T(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${f} == "${n}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${f},
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
| KEEP host_key, host_name, os_type, os_name, os_version, os_full, last_seen, cpu_utilization, memory_utilization, process_count, load_avg_1m, host_arch, host_ip`}function G(e,t){return`TS metrics-hostmetricsreceiver*
| WHERE ${A(t).join(" AND ")}
| STATS metric_value = ${k(e)}
    BY bucket = BUCKET(@timestamp, 20, ${t.timeFrom}, ${t.timeTo})
| SORT bucket ASC`}function K(e){return`TS metrics-hostmetricsreceiver*
| WHERE ${A(e).join(" AND ")}
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${e.timeFrom}, ${e.timeTo})
| SORT bucket ASC`}function Y(e,t,n){const s=T(e);return`TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${f} == "${s}"
| STATS metric_value = ${k(t)}
    BY bucket = BUCKET(@timestamp, 20, ${n.timeFrom}, ${n.timeTo})
| SORT bucket ASC`}function J(e,t){const n=T(e);return`TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${f} == "${n}"
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${t.timeFrom}, ${t.timeTo})
| SORT bucket ASC`}function Z(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(s=>s.name==="bucket"),n=e.columns.findIndex(s=>s.name==="metric_value");return t<0||n<0?[]:e.values.map(s=>({bucket:String(s[t]??""),value:typeof s[n]=="number"?s[n]:0})).filter(s=>s.bucket)}function ee(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(o=>o.name==="bucket"),n=e.columns.findIndex(o=>o.name==="load_1m"),s=e.columns.findIndex(o=>o.name==="load_5m"),c=e.columns.findIndex(o=>o.name==="load_15m");return t<0?[]:e.values.map(o=>({bucket:String(o[t]??""),load1m:typeof o[n]=="number"?o[n]:0,load5m:typeof o[s]=="number"?o[s]:0,load15m:typeof o[c]=="number"?o[c]:0})).filter(o=>o.bucket)}function u(e,t){return e.findIndex(n=>n.name===t)}function m(e,t){if(t<0||t>=e.length)return"";const n=e[t];return typeof n=="string"?n:n!=null?String(n):""}function y(e,t){if(t<0||t>=e.length)return null;const n=e[t];return typeof n=="number"&&Number.isFinite(n)?n:null}function te(e){const t=e.columns??[],n=e.values??[];if(t.length===0||n.length===0)return[];const s=u(t,"host_key"),c=u(t,"host_name"),o=u(t,"os_type"),a=u(t,"os_name"),l=u(t,"os_version"),d=u(t,"os_full"),_=u(t,"last_seen"),h=u(t,"cpu_utilization"),p=u(t,"memory_utilization"),r=u(t,"process_count"),S=u(t,"load_avg_1m"),I=u(t,"host_arch"),b=u(t,"host_ip");return n.map(i=>({hostId:m(i,s)||"unknown",hostName:m(i,c),osType:$(m(i,o)),osName:m(i,a),osVersion:m(i,l),osFull:m(i,d),lastSeen:m(i,_),cpuUtilization:y(i,h),memoryUtilization:y(i,p),processCount:y(i,r),loadAvg1m:y(i,S),hostArch:m(i,I),hostIp:m(i,b)||void 0}))}export{W as M,z as a,U as b,B as c,K as d,G as e,q as f,Z as g,j as h,te as i,Y as j,J as k,P as l,D as o,ee as p,w as t,Q as u};
//# sourceMappingURL=hostHelpers-DBCYphie.js.map
