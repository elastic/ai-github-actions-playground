import{r}from"./mui-CantZHin.js";function n(t,u=2e3){const e=r.useRef(null);return r.useEffect(()=>()=>{e.current&&(clearTimeout(e.current),e.current=null)},[]),r.useCallback(()=>{e.current&&clearTimeout(e.current),e.current=setTimeout(t,u)},[u,t])}export{n as u};
//# sourceMappingURL=useCopyFeedbackTimeout-9eAFXJIf.js.map
