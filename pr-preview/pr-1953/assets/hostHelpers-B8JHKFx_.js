import{j as c,aX as C,k as h}from"./mui-CantZHin.js";function y(t){if(!t)return"unknown";const s=t.toLowerCase().trim();return s==="linux"?"linux":s==="windows"?"windows":s==="darwin"||s==="macos"?"macos":"unknown"}function N(t,s,n){const a=y(n),u=t?.trim(),r=s?.trim();return{hostId:u||(r?`${r}::${a}`:"unknown"),displayName:r||u||"unknown",osType:a}}function $(t){switch(t){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return g(t)}}function g(t){throw new Error(`Unhandled host OS type: ${String(t)}`)}function v(t){return t==null?"—":`${(t*100).toFixed(1)}%`}function H(t){return t==null?"—":t.toLocaleString()}function I(t){if(!t)return"—";const s=new Date(t);return Number.isNaN(s.getTime())?t:s.toLocaleString()}function w({label:t,value:s}){return c.jsxs(C,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[c.jsx(h,{variant:"body2",color:"text.secondary",children:t}),c.jsx(h,{variant:"h5",sx:{fontWeight:700,mt:.5},children:s})]})}function d(t){return t.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const l='COALESCE(host.id, CONCAT(COALESCE(host.name, "unknown"), "::", COALESCE(host.os.type, "unknown")))';function x(t){const s=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const n=t.osType==="macos"?"darwin":t.osType;s.push(`host.os.type == "${n}"`)}if(t.search){const n=d(t.search);s.push(`host.name LIKE "*${n}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${s.join(" AND ")}
| EVAL host_key = ${l}
| SORT @timestamp DESC
| DEDUP host_key
| EVAL
    host_id = host.id,
    host_name = host.name,
    os_type = host.os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    disk_utilization = system.filesystem.utilization,
    process_count = system.processes.count
| KEEP host_key, host_id, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count
| SORT last_seen DESC`}function A(t,s){const n=d(t);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${s.timeFrom}
  AND @timestamp <= ${s.timeTo}
  AND ${l} == "${n}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${l},
    host_id = host.id,
    host_name = host.name,
    os_type = host.os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    disk_utilization = system.filesystem.utilization,
    process_count = system.processes.count
| KEEP host_key, host_id, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count`}function e(t,s){return t.findIndex(n=>n.name===s)}function i(t,s){if(s<0||s>=t.length)return"";const n=t[s];return typeof n=="string"?n:n!=null?String(n):""}function m(t,s){if(s<0||s>=t.length)return null;const n=t[s];return typeof n=="number"&&Number.isFinite(n)?n:null}function D(t){const s=t.columns??[],n=t.values??[];if(s.length===0||n.length===0)return[];const a=e(s,"host.id"),u=e(s,"host_key"),r=e(s,"host_id"),p=e(s,"host_name"),_=e(s,"os_type"),f=e(s,"os_name"),E=e(s,"os_version"),z=e(s,"last_seen"),k=e(s,"cpu_utilization"),S=e(s,"memory_utilization"),T=e(s,"disk_utilization"),O=e(s,"process_count");return n.map(o=>({hostId:i(o,a)||i(o,r)||i(o,u)||"unknown",hostName:i(o,p),osType:y(i(o,_)),osName:i(o,f),osVersion:i(o,E),lastSeen:i(o,z),cpuUtilization:m(o,k),memoryUtilization:m(o,S),diskUtilization:m(o,T),processCount:m(o,O)}))}export{w as M,v as a,H as b,x as c,A as d,I as f,$ as o,D as p,N as t};
//# sourceMappingURL=hostHelpers-B8JHKFx_.js.map
