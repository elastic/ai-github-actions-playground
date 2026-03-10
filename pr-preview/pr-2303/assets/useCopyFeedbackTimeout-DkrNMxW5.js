import{r}from"./mui-BD-Ru0_0.js";function n(t,u=2e3){const e=r.useRef(null);return r.useEffect(()=>()=>{e.current&&(clearTimeout(e.current),e.current=null)},[]),r.useCallback(()=>{e.current&&clearTimeout(e.current),e.current=setTimeout(t,u)},[u,t])}export{n as u};
//# sourceMappingURL=useCopyFeedbackTimeout-DkrNMxW5.js.map
