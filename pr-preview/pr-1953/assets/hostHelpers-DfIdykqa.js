import{j as T,aX as k,k as S}from"./mui-DwIRiOJj.js";import{u as E,d as $,aP as b}from"./index-CHIZNH_o.js";import{u as g}from"./useEsQuery-D_9vPT0r.js";function v(e){if(!e)return"unknown";const t=e.toLowerCase().trim();return t==="linux"?"linux":t==="windows"?"windows":t==="darwin"||t==="macos"?"macos":"unknown"}function x(e,t,n,s){const i=v(n),o=e?.trim(),u=t?.trim(),y=s?.trim();return{hostId:o||(u?`${u}::${i}`:void 0)||y||"unknown",displayName:u||o||"unknown",osType:i}}function N(e){switch(e){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return I(e)}}function I(e){throw new Error(`Unhandled host OS type: ${String(e)}`)}function L(e){return e==null?"—":`${(e*100).toFixed(1)}%`}function D(e){return e==null?"—":e.toLocaleString()}function H(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString()}function M({label:e,value:t}){return T.jsxs(k,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[T.jsx(S,{variant:"body2",color:"text.secondary",children:e}),T.jsx(S,{variant:"h5",sx:{fontWeight:700,mt:.5},children:t})]})}function V({query:e,queryKey:t,buildRequest:n,enabled:s=!0}){const i=E(r=>r.connection),o=E(r=>r.activeProfileId),u=e?.trim()??"",y=s&&!!i&&u.length>0;let l=null,p=null;if(y)try{p=n?n(u):{query:u}}catch(r){l=r instanceof Error?r:new Error(String(r))}const f=y&&l==null,a=$({queryKey:t??["esql",o,i?.url,u,p],queryFn:async({signal:r})=>{if(!i||!p)throw new Error("Cannot execute ES|QL query without an active connection and non-empty query.");return b(i).execute(p,r)},enabled:f,retry:!1,refetchOnWindowFocus:!1,refetchOnReconnect:!1});return g(i,()=>{f&&a.refetch()}),{data:a.data??null,loading:a.isFetching,error:l!=null?l.message:a.error==null?null:a.error instanceof Error?a.error.message:String(a.error),refetch:a.refetch}}function h(e){return e.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const _='CONCAT(COALESCE(host.name, host.ip, "unknown"), "::", COALESCE(os.type, "unknown"))';function w(e){const t=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType&&e.osType!=="unknown"){const n=e.osType==="macos"?"darwin":e.osType;t.push(`os.type == "${n}"`)}if(e.search){const n=h(e.search);t.push(`host.name LIKE "*${n}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${t.join(" AND ")}
| EVAL host_key = ${_}
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
| SORT last_seen DESC`}function F(e,t){const n=h(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${_} == "${n}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${_},
    host_name = host.name,
    os_type = os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, process_count, host_ip`}function z(e,t,n="30 seconds"){const s=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const i=t.osType==="macos"?"darwin":t.osType;s.push(`os.type == "${i}"`)}if(t.search){const i=h(t.search);s.push(`host.name LIKE "*${i}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${s.join(" AND ")}
| EVAL bucket = DATE_TRUNC(${n}, @timestamp)
| STATS metric_value = AVG(${e}) BY bucket
| SORT bucket ASC`}function q(e,t="30 seconds"){const n=[`@timestamp >= ${e.timeFrom}`,`@timestamp <= ${e.timeTo}`];if(e.osType&&e.osType!=="unknown"){const s=e.osType==="macos"?"darwin":e.osType;n.push(`os.type == "${s}"`)}if(e.search){const s=h(e.search);n.push(`host.name LIKE "*${s}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${n.join(" AND ")}
| EVAL bucket = DATE_TRUNC(${t}, @timestamp)
| STATS
    load_1m = AVG(system.cpu.load_average.1m),
    load_5m = AVG(system.cpu.load_average.5m),
    load_15m = AVG(system.cpu.load_average.15m)
  BY bucket
| SORT bucket ASC`}function X(e,t,n,s="30 seconds"){const i=h(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${_} == "${i}"
| EVAL bucket = DATE_TRUNC(${s}, @timestamp)
| STATS metric_value = AVG(${t}) BY bucket
| SORT bucket ASC`}function Q(e,t,n="30 seconds"){const s=h(e);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${t.timeFrom}
  AND @timestamp <= ${t.timeTo}
  AND ${_} == "${s}"
| EVAL bucket = DATE_TRUNC(${n}, @timestamp)
| STATS
    load_1m = AVG(system.cpu.load_average.1m),
    load_5m = AVG(system.cpu.load_average.5m),
    load_15m = AVG(system.cpu.load_average.15m)
  BY bucket
| SORT bucket ASC`}function W(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(s=>s.name==="bucket"),n=e.columns.findIndex(s=>s.name==="metric_value");return t<0||n<0?[]:e.values.map(s=>({bucket:String(s[t]??""),value:typeof s[n]=="number"?s[n]:0})).filter(s=>s.bucket)}function j(e){if(!e?.columns||!e.values)return[];const t=e.columns.findIndex(o=>o.name==="bucket"),n=e.columns.findIndex(o=>o.name==="load_1m"),s=e.columns.findIndex(o=>o.name==="load_5m"),i=e.columns.findIndex(o=>o.name==="load_15m");return t<0?[]:e.values.map(o=>({bucket:String(o[t]??""),load1m:typeof o[n]=="number"?o[n]:0,load5m:typeof o[s]=="number"?o[s]:0,load15m:typeof o[i]=="number"?o[i]:0})).filter(o=>o.bucket)}function m(e,t){return e.findIndex(n=>n.name===t)}function d(e,t){if(t<0||t>=e.length)return"";const n=e[t];return typeof n=="string"?n:n!=null?String(n):""}function A(e,t){if(t<0||t>=e.length)return null;const n=e[t];return typeof n=="number"&&Number.isFinite(n)?n:null}function B(e){const t=e.columns??[],n=e.values??[];if(t.length===0||n.length===0)return[];const s=m(t,"host_key"),i=m(t,"host_name"),o=m(t,"os_type"),u=m(t,"os_name"),y=m(t,"os_version"),l=m(t,"last_seen"),p=m(t,"cpu_utilization"),f=m(t,"memory_utilization"),a=m(t,"process_count"),r=m(t,"host_ip");return n.map(c=>({hostId:d(c,s)||"unknown",hostName:d(c,i),osType:v(d(c,o)),osName:d(c,u),osVersion:d(c,y),lastSeen:d(c,l),cpuUtilization:A(c,p),memoryUtilization:A(c,f),processCount:A(c,a),hostIp:d(c,r)||void 0}))}export{M,L as a,D as b,q as c,z as d,W as e,H as f,w as g,B as h,X as i,Q as j,F as k,N as o,j as p,x as t,V as u};
//# sourceMappingURL=hostHelpers-DfIdykqa.js.map
