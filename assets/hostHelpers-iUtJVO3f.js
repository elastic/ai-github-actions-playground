import{j as T,aY as k,k as E}from"./mui-DBy1Ah-X.js";import{e as S,g as b,i as $,aT as g}from"./index-BcY8q29U.js";import{u as I}from"./useEsQuery-I2qptX10.js";function v(e){if(!e)return"unknown";const t=e.toLowerCase().trim();return t==="linux"?"linux":t==="windows"?"windows":t==="darwin"||t==="macos"?"macos":"unknown"}function N(e,t,n,s){const r=v(n),o=n?.toLowerCase().trim()??"unknown",u=e?.trim(),m=t?.trim(),l=s?.trim();return{hostId:u||(m?`${m}::${o}`:void 0)||l||"unknown",displayName:m||u||"unknown",osType:r}}function L(e){switch(e){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return C(e)}}function C(e){throw new Error(`Unhandled host OS type: ${String(e)}`)}function D(e){return e==null?"—":`${(e*100).toFixed(1)}%`}function H(e){return e==null?"—":e.toLocaleString()}function w(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString()}function M({label:e,value:t}){return T.jsxs(k,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[T.jsx(E,{variant:"body2",color:"text.secondary",children:e}),T.jsx(E,{variant:"h5",sx:{fontWeight:700,mt:.5},children:t})]})}function V({query:e,queryKey:t,buildRequest:n,enabled:s=!0}){const r=S(i=>i.connection),o=S(i=>i.activeProfileId),u=e?.trim()??"",m=s&&!!r&&u.length>0;let l=null,d=null;if(m)try{d=n?n(u):{query:u}}catch(i){l=i instanceof Error?i:new Error(String(i))}const _=m&&l==null,p=b({queryKey:t??["esql",o,r?.url,u,d],queryFn:async({signal:i})=>{if(!r||!d)throw new Error("Cannot execute ES|QL query without an active connection and non-empty query.");return g(r).execute(d,i)},enabled:_,retry:!1,refetchOnWindowFocus:!1,refetchOnReconnect:!1});return I(r,()=>{_&&p.refetch()}),{data:p.data??null,loading:p.isFetching,error:(()=>{if(l!=null)return l.message;if(p.error==null)return null;const i=p.error;return i instanceof Error||$(i)?i.message:String(i)})(),refetch:p.refetch}}function h(e){return e.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const f='CONCAT(COALESCE(host.name, TO_STRING(host.ip), "unknown"), "::", COALESCE(os.type, "unknown"))';function F(e){const t=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType&&e.osType!=="unknown"){const n=e.osType==="macos"?"darwin":e.osType;t.push(`os.type == "${n}"`)}if(e.search){const n=h(e.search);t.push(`host.name LIKE "*${n}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${t.join(" AND ")}
| EVAL host_key = ${f}
| STATS
    host_name = MAX(host.name),
    os_type = MAX(os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    last_seen = MAX(@timestamp),
    cpu_utilization = MAX(system.cpu.utilization),
    memory_utilization = MAX(system.memory.utilization),
    process_count = MAX(system.processes.count),
    host_ip = MAX(host.ip)
  BY host_key
| SORT last_seen DESC`}function z(e,t){const n=h(e);return`FROM metrics-hostmetricsreceiver*
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
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, process_count, host_ip`}function q(e,t,n="30 seconds"){const s=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const r=t.osType==="macos"?"darwin":t.osType;s.push(`os.type == "${r}"`)}if(t.search){const r=h(t.search);s.push(`host.name LIKE "*${r}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${s.join(" AND ")}
| EVAL bucket = DATE_TRUNC(${n}, @timestamp)
| STATS metric_value = AVG(${e}) BY bucket
| SORT bucket ASC`}function Q(e,t="30 seconds"){const n=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType&&e.osType!=="unknown"){const s=e.osType==="macos"?"darwin":e.osType;n.push(`os.type == "${s}"`)}if(e.search){const s=h(e.search);n.push(`host.name LIKE "*${s}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${n.join(" AND ")}
| EVAL bucket = DATE_TRUNC(${t}, @timestamp)
| STATS
    load_1m = AVG(system.cpu.load_average.1m),
    load_5m = AVG(system.cpu.load_average.5m),
    load_15m = AVG(system.cpu.load_average.15m)
  BY bucket
| SORT bucket ASC`}function W(e,t,n,s="30 seconds"){const r=h(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${f} == "${r}"
| EVAL bucket = DATE_TRUNC(${s}, @timestamp)
| STATS metric_value = AVG(${t}) BY bucket
| SORT bucket ASC`}function X(e,t,n="30 seconds"){const s=h(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${f} == "${s}"
| EVAL bucket = DATE_TRUNC(${n}, @timestamp)
| STATS
    load_1m = AVG(system.cpu.load_average.1m),
    load_5m = AVG(system.cpu.load_average.5m),
    load_15m = AVG(system.cpu.load_average.15m)
  BY bucket
| SORT bucket ASC`}function j(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(s=>s.name==="bucket"),n=e.columns.findIndex(s=>s.name==="metric_value");return t<0||n<0?[]:e.values.map(s=>({bucket:String(s[t]??""),value:typeof s[n]=="number"?s[n]:0})).filter(s=>s.bucket)}function B(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(o=>o.name==="bucket"),n=e.columns.findIndex(o=>o.name==="load_1m"),s=e.columns.findIndex(o=>o.name==="load_5m"),r=e.columns.findIndex(o=>o.name==="load_15m");return t<0?[]:e.values.map(o=>({bucket:String(o[t]??""),load1m:typeof o[n]=="number"?o[n]:0,load5m:typeof o[s]=="number"?o[s]:0,load15m:typeof o[r]=="number"?o[r]:0})).filter(o=>o.bucket)}function a(e,t){return e.findIndex(n=>n.name===t)}function y(e,t){if(t<0||t>=e.length)return"";const n=e[t];return typeof n=="string"?n:n!=null?String(n):""}function A(e,t){if(t<0||t>=e.length)return null;const n=e[t];return typeof n=="number"&&Number.isFinite(n)?n:null}function G(e){const t=e.columns??[],n=e.values??[];if(t.length===0||n.length===0)return[];const s=a(t,"host_key"),r=a(t,"host_name"),o=a(t,"os_type"),u=a(t,"os_name"),m=a(t,"os_version"),l=a(t,"last_seen"),d=a(t,"cpu_utilization"),_=a(t,"memory_utilization"),p=a(t,"process_count"),i=a(t,"host_ip");return n.map(c=>({hostId:y(c,s)||"unknown",hostName:y(c,r),osType:v(y(c,o)),osName:y(c,u),osVersion:y(c,m),lastSeen:y(c,l),cpuUtilization:A(c,d),memoryUtilization:A(c,_),processCount:A(c,p),hostIp:y(c,i)||void 0}))}export{M,D as a,H as b,Q as c,q as d,j as e,w as f,F as g,G as h,W as i,X as j,z as k,L as o,B as p,N as t,V as u};
//# sourceMappingURL=hostHelpers-iUtJVO3f.js.map
