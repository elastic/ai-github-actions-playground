import{j as p,aX as g,k as d}from"./mui-DwIRiOJj.js";function f(t){if(!t)return"unknown";const n=t.toLowerCase().trim();return n==="linux"?"linux":n==="windows"?"windows":n==="darwin"||n==="macos"?"macos":"unknown"}function O(t,n,s,c){const a=f(s),u=t?.trim(),r=n?.trim(),m=c?.trim();return{hostId:u||(r?`${r}::${a}`:void 0)||m||"unknown",displayName:r||u||"unknown",osType:a}}function v(t){switch(t){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return k(t)}}function k(t){throw new Error(`Unhandled host OS type: ${String(t)}`)}function M(t){return t==null?"—":`${(t*100).toFixed(1)}%`}function N(t){return t==null?"—":t.toLocaleString()}function $(t){if(!t)return"—";const n=new Date(t);return Number.isNaN(n.getTime())?t:n.toLocaleString()}function w({label:t,value:n}){return p.jsxs(g,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[p.jsx(d,{variant:"body2",color:"text.secondary",children:t}),p.jsx(d,{variant:"h5",sx:{fontWeight:700,mt:.5},children:n})]})}function E(t){return t.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const h='CONCAT(COALESCE(host.name, host.ip, "unknown"), "::", COALESCE(os.type, "unknown"))';function C(t){const n=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const s=t.osType==="macos"?"darwin":t.osType;n.push(`os.type == "${s}"`)}if(t.search){const s=E(t.search);n.push(`host.name LIKE "*${s}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${n.join(" AND ")}
| EVAL host_key = ${h}
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
| SORT last_seen DESC`}function I(t,n){const s=E(t);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${h} == "${s}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${h},
    host_name = host.name,
    os_type = os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, process_count, host_ip`}function e(t,n){return t.findIndex(s=>s.name===n)}function i(t,n){if(n<0||n>=t.length)return"";const s=t[n];return typeof s=="string"?s:s!=null?String(s):""}function l(t,n){if(n<0||n>=t.length)return null;const s=t[n];return typeof s=="number"&&Number.isFinite(s)?s:null}function H(t){const n=t.columns??[],s=t.values??[];if(n.length===0||s.length===0)return[];const c=e(n,"host_key"),a=e(n,"host_name"),u=e(n,"os_type"),r=e(n,"os_name"),m=e(n,"os_version"),y=e(n,"last_seen"),_=e(n,"cpu_utilization"),T=e(n,"memory_utilization"),S=e(n,"process_count"),A=e(n,"host_ip");return s.map(o=>({hostId:i(o,c)||"unknown",hostName:i(o,a),osType:f(i(o,u)),osName:i(o,r),osVersion:i(o,m),lastSeen:i(o,y),cpuUtilization:l(o,_),memoryUtilization:l(o,T),processCount:l(o,S),hostIp:i(o,A)||void 0}))}export{w as M,M as a,N as b,C as c,I as d,$ as f,v as o,H as p,O as t};
//# sourceMappingURL=hostHelpers-CEpX8_wx.js.map
