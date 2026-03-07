import{j as _,aX as S,k as I}from"./mui-CantZHin.js";function g(t){if(!t)return"unknown";const n=t.toLowerCase().trim();return n==="linux"?"linux":n==="windows"?"windows":n==="darwin"||n==="macos"?"macos":"unknown"}function C(t,n,s,a){const c=g(s),u=t?.trim(),r=n?.trim(),l=a?.agentId?.trim(),p=a?.cloudInstanceId?.trim(),d=a?.hostIp?.trim();return{hostId:u||(r?`${r}::${c}`:void 0)||l||p||d||"unknown",displayName:r||u||"unknown",osType:c}}function O(t){switch(t){case"linux":return"Linux";case"windows":return"Windows";case"macos":return"macOS";case"unknown":return"Unknown";default:return M(t)}}function M(t){throw new Error(`Unhandled host OS type: ${String(t)}`)}function N(t){return t==null?"—":`${(t*100).toFixed(1)}%`}function $(t){return t==null?"—":t.toLocaleString()}function X(t){if(!t)return"—";const n=new Date(t);return Number.isNaN(n.getTime())?t:n.toLocaleString()}function L({label:t,value:n}){return _.jsxs(S,{variant:"outlined",sx:{p:2,flex:1,minWidth:140},children:[_.jsx(I,{variant:"body2",color:"text.secondary",children:t}),_.jsx(I,{variant:"h5",sx:{fontWeight:700,mt:.5},children:n})]})}function A(t){return t.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\*/g,"\\*").replace(/\?/g,"\\?")}const h='CONCAT(COALESCE(host.name, "unknown"), "::", COALESCE(os.type, "unknown"))';function x(t){const n=[`@timestamp >= ${t.timeFrom}`,`@timestamp <= ${t.timeTo}`];if(t.osType&&t.osType!=="unknown"){const s=t.osType==="macos"?"darwin":t.osType;n.push(`os.type == "${s}"`)}if(t.search){const s=A(t.search);n.push(`host.name LIKE "*${s}*"`)}return`FROM metrics-hostmetricsreceiver*
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
    disk_utilization = MAX(system.filesystem.utilization),
    process_count = MAX(system.processes.count),
    agent_id = MAX(agent.id),
    cloud_instance_id = MAX(cloud.instance.id),
    host_ip = MAX(host.ip)
  BY host_key
| SORT last_seen DESC`}function w(t,n){const s=A(t);return`FROM metrics-hostmetricsreceiver*
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
    disk_utilization = system.filesystem.utilization,
    process_count = system.processes.count,
    agent_id = agent.id,
    cloud_instance_id = cloud.instance.id,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count, agent_id, cloud_instance_id, host_ip`}function o(t,n){return t.findIndex(s=>s.name===n)}function i(t,n){if(n<0||n>=t.length)return"";const s=t[n];return typeof s=="string"?s:s!=null?String(s):""}function m(t,n){if(n<0||n>=t.length)return null;const s=t[n];return typeof s=="number"&&Number.isFinite(s)?s:null}function H(t){const n=t.columns??[],s=t.values??[];if(n.length===0||s.length===0)return[];const a=o(n,"host_key"),c=o(n,"host_name"),u=o(n,"os_type"),r=o(n,"os_name"),l=o(n,"os_version"),p=o(n,"last_seen"),d=o(n,"cpu_utilization"),y=o(n,"memory_utilization"),f=o(n,"disk_utilization"),z=o(n,"process_count"),k=o(n,"agent_id"),E=o(n,"cloud_instance_id"),T=o(n,"host_ip");return s.map(e=>({hostId:i(e,a)||"unknown",hostName:i(e,c),osType:g(i(e,u)),osName:i(e,r),osVersion:i(e,l),lastSeen:i(e,p),cpuUtilization:m(e,d),memoryUtilization:m(e,y),diskUtilization:m(e,f),processCount:m(e,z),agentId:i(e,k)||void 0,cloudInstanceId:i(e,E)||void 0,hostIp:i(e,T)||void 0}))}export{L as M,N as a,$ as b,x as c,w as d,X as f,O as o,H as p,C as t};
//# sourceMappingURL=hostHelpers-BN6X5grm.js.map
