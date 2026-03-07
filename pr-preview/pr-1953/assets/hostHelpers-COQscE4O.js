import{j as p,aX as O,k as I}from"./mui-CantZHin.js";function E(t){if(!t)return"unknown";const n=t.toLowerCase().trim();return n==="linux"?"linux":n==="windows"?"windows":n==="darwin"||n==="macos"?"macos":"unknown"}function $(t,n,s,a){const r=E(s),u=t?.trim(),c=n?.trim(),d=a?.agentId?.trim(),l=a?.cloudInstanceId?.trim(),_=a?.hostIp?.trim();return{hostId:u||(c?`${c}::${r}`:void 0)||d||l||_||"unknown",displayName:c||u||"unknown",osType:r}}function A(t){switch(t){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return L(t)}}function L(t){throw new Error(`Unhandled host OS type: ${String(t)}`)}function H(t){return t==null?"—":`${(t*100).toFixed(1)}%`}function x(t){return t==null?"—":t.toLocaleString()}function D(t){if(!t)return"—";const n=new Date(t);return Number.isNaN(n.getTime())?t:n.toLocaleString()}function R({label:t,value:n}){return p.jsxs(O,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[p.jsx(I,{variant:"body2",color:"text.secondary",children:t}),p.jsx(I,{variant:"h5",sx:{fontWeight:700,mt:.5},children:n})]})}function g(t){return t.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const h='COALESCE(host.id, CONCAT(COALESCE(host.name, "unknown"), "::", COALESCE(host.os.type, "unknown")))';function b(t){const n=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const s=t.osType==="macos"?"darwin":t.osType;n.push(`host.os.type == "${s}"`)}if(t.search){const s=g(t.search);n.push(`host.name LIKE "*${s}*"`)}return`FROM metrics-hostmetricsreceiver*
| WHERE ${n.join(" AND ")}
| EVAL host_key = ${h}
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
    process_count = system.processes.count,
    agent_id = agent.id,
    cloud_instance_id = cloud.instance.id,
    host_ip = host.ip
| KEEP host_key, host_id, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count, agent_id, cloud_instance_id, host_ip
| SORT last_seen DESC`}function w(t,n){const s=g(t);return`FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${n.timeFrom}
  AND @timestamp <= ${n.timeTo}
  AND ${h} == "${s}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${h},
    host_id = host.id,
    host_name = host.name,
    os_type = host.os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    disk_utilization = system.filesystem.utilization,
    process_count = system.processes.count,
    agent_id = agent.id,
    cloud_instance_id = cloud.instance.id,
    host_ip = host.ip
| KEEP host_key, host_id, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count, agent_id, cloud_instance_id, host_ip`}function e(t,n){return t.findIndex(s=>s.name===n)}function i(t,n){if(n<0||n>=t.length)return"";const s=t[n];return typeof s=="string"?s:s!=null?String(s):""}function m(t,n){if(n<0||n>=t.length)return null;const s=t[n];return typeof s=="number"&&Number.isFinite(s)?s:null}function P(t){const n=t.columns??[],s=t.values??[];if(n.length===0||s.length===0)return[];const a=e(n,"host.id"),r=e(n,"host_key"),u=e(n,"host_id"),c=e(n,"host_name"),d=e(n,"os_type"),l=e(n,"os_name"),_=e(n,"os_version"),y=e(n,"last_seen"),f=e(n,"cpu_utilization"),z=e(n,"memory_utilization"),k=e(n,"disk_utilization"),S=e(n,"process_count"),T=e(n,"agent_id"),C=e(n,"cloud_instance_id"),v=e(n,"host_ip");return s.map(o=>({hostId:i(o,a)||i(o,u)||i(o,r)||"unknown",hostName:i(o,c),osType:E(i(o,d)),osName:i(o,l),osVersion:i(o,_),lastSeen:i(o,y),cpuUtilization:m(o,f),memoryUtilization:m(o,z),diskUtilization:m(o,k),processCount:m(o,S),agentId:i(o,T)||void 0,cloudInstanceId:i(o,C)||void 0,hostIp:i(o,v)||void 0}))}export{R as M,H as a,x as b,b as c,w as d,D as f,A as o,P as p,$ as t};
//# sourceMappingURL=hostHelpers-COQscE4O.js.map
