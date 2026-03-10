import{r,j as e,B as c,b4 as D,k as p,n as g,bM as F,h as X,I as z,b5 as V,ag as J,ad as Z}from"./mui-CRj5xwDF.js";import{bI as ee,bJ as te,bK as se,M as ne,aK as oe,bL as G,ay as ie,d as re,i as ae,l as le,R as ce}from"./index-tHs3w0YX.js";import{c as ue,h as de,f as he}from"./ai-sdk-BNySMn_0.js";import{P as O}from"./PageContainer-DLbeV479.js";import{P as U}from"./PageHeader-C26Qs-AP.js";import"./perses-C60x-TXE.js";import"./codemirror-DkccPSvx.js";import"./echarts-D97nCBS2.js";const v=20,ye=6e4,me=10,fe=/^\s*my guess:\s*/im;function ge(t){const s=v-t;return`You are a playful, curious detective playing **20 Questions** against a human who is thinking of something inside their Elasticsearch cluster. It could be a specific log entry, an index, a field value, an error, a service, a host — anything that lives in the cluster.

## Game Rules
- You have asked **${t}** questions so far. You have **${s}** remaining.
- You may ask at most **${v}** yes/no questions total.
- The user will answer each question honestly (yes, no, or a short clarification).
- You win if you correctly identify what the user is thinking of before running out of questions.
- When you are confident, say **"My guess:"** followed by your specific answer.
- After guessing, wait for the user to confirm whether you are correct.

## Tools
You have access to Elasticsearch tools:
- **run_esql_query** — Run ES|QL queries to explore data, count records, list distinct values, etc.
- **get_index_info** — Inspect index mappings, settings, and stats.
- **get_cluster_health** — Check cluster health and node statistics.

## Strategy: Information-Theoretic Binary Splitting
Your goal is to **maximize information gain per question**. Each question should eliminate
roughly **half** the remaining possibility space — like a binary search.

### How to split effectively
Think in **dimensions**, not individual candidates. Narrow one dimension at a time:

| Phase | Dimension | Example question |
|-------|-----------|------------------|
| 1. Kind | Structural vs data | "Is it a piece of data (document/value) rather than a structural element (index/field/mapping)?" |
| 2. Signal type | logs / metrics / traces | "Does it come from trace data?" |
| 3. Recency | Time-based split | "Did it occur in the last 24 hours?" |
| 4. Cardinality | High vs low volume | "Does the thing you're thinking of appear more than 10,000 times?" |
| 5. Category group | Split by attribute | "Is the service name in the first half alphabetically (a–m)?" |
| 6. Specific attribute | Field value / content | "Does it contain an error or exception?" |
| 7. Identity | Final narrowing | "Is it the 'connection timeout' error from payment-service?" |

### Critical rules
- **NEVER enumerate candidates one by one.** If you have 10 services, do NOT ask about each
  service individually. Instead, split them: "Is the service one of [redis, postgres, api-gateway,
  frontend-web, auth-service]?" (the top 5 by volume). One question eliminates half the list.
- **Use multiple dimensions.** Don't just narrow by service name. Cross-cut with time ranges,
  field types, numeric thresholds, status codes, log levels, etc. Each dimension is an
  independent axis of information.
- **Run aggregation queries to find the split point.** Before asking, query to find the median
  or natural grouping. For example, query \`STATS count = COUNT(*) BY service.name\` then split
  services into two groups of roughly equal total count.
- **Ask about properties, not identities.** Early questions should be about characteristics
  ("Is it numeric?", "Does it relate to errors?", "Is it from an external-facing service?")
  rather than specific names. Properties cross-cut many candidates at once.
- **Only guess a specific item when you have ≤3 candidates left**, or when you are highly
  confident based on converging evidence.

### Turn structure
1. **Query** the cluster to understand the current possibility space.
2. **Identify the best split** — which question divides the remaining candidates closest to 50/50?
3. **Ask** exactly one numbered question.
4. After the user answers, **refine** your mental model and repeat.

## Question Guidelines
- Ask exactly **one** question per turn. Number it (e.g. "**Question 3:**").
`+(s===1?`- You have only one question left: ask exactly one numbered yes/no question OR provide your final guess now using "My guess:".
`:"")+`- Questions must be answerable with yes/no or a very short answer.
- Run queries when you need new information. Do NOT re-run a query you already ran — you have
  full access to previous tool results in the conversation history.
- Do NOT repeat a question you already asked.

## Personality & Response Format
- **Be playful and conversational**, like a curious detective having fun. Show personality!
- Weave your findings into the narrative naturally. Instead of listing stats, say things like:
  "Interesting — I see 11 services leaving traces in this cluster. I'm thinking you might be
  thinking about one of them..." or "Ooh, so it's not logs or metrics — that narrows things
  down to the tracing side of the house!"
- **Keep it short** — 2-3 sentences of commentary + your question. No raw data dumps.
- Use ES|QL syntax (piped query language, NOT SQL) in fenced \`\`\`esql code blocks.

## ES|QL Reference
Below is a complete ES|QL syntax guide. Use it to write correct queries.

`+se}const pe=/^(?:[-*]\s*)?(?:(?:question\s*\d*[:.)-]?\s*)|(?:q[:.)-]?\s*)|(?:\d+[).:-]\s*)|(?:who|what|when|where|why|how|is|are|am|was|were|can|could|do|does|did|will|would|should|has|have|had|may|might|must)\b)/i;function xe(t){const s=t.match(/\bquestion\s+\d+\s*[:\b]/gi);return s&&s.length>0?s.length:t.split(`
`).map(o=>o.trim()).filter(o=>o.endsWith("?")&&o.length>0&&o.length<=120&&!o.startsWith("(")&&!o.startsWith("|")&&!o.startsWith("//")&&!o.startsWith("```")&&pe.test(o)).length}function ve(t,s,a){const[o,l]=r.useState("idle"),[n,u]=r.useState([]),[f,b]=r.useState(0),[j,S]=r.useState(!1),[Y,q]=r.useState(null),N=r.useRef(null),W=r.useRef([]),C=r.useRef(!1),R=r.useRef([]);r.useEffect(()=>{W.current=n,N.current?.scrollIntoView({behavior:"smooth"})},[n]);const x=r.useRef(0),E=r.useCallback((h,d)=>{u(i=>i.map(m=>m.id!==h?m:{...m,...d.content!==void 0?{content:d.content}:{},...d.toolCalls!==void 0?{toolCalls:d.toolCalls}:{}}))},[]),k=r.useCallback(async h=>{if(!s||C.current)return!1;C.current=!0,q(null),S(!0);const d=crypto.randomUUID();u(i=>[...i,{id:d,role:"assistant",content:"",toolCalls:[]}]);try{const i=ue({apiKey:t.apiKey,...t.provider==="openrouter"?{baseURL:"https://openrouter.ai/api/v1"}:{}}),m=t.provider==="openrouter"?i.chat(t.model):i(t.model),I=ee(s),A=ge(x.current),K={role:"user",content:h},Q=[...R.current,K],P=de({model:m,system:A,messages:Q,tools:I,stopWhen:he(me),abortSignal:AbortSignal.timeout(ye)});let T="",w=[];for await(const y of P.fullStream)y.type==="text-delta"?(T+=y.text,E(d,{content:T})):y.type==="tool-call"?(w=[...w,{toolCallId:y.toolCallId,name:y.toolName}],E(d,{toolCalls:w})):y.type==="tool-result"&&(w=w.map(M=>M.toolCallId===y.toolCallId?{...M,result:te(y.toolName,y.output)}:M),E(d,{toolCalls:w}));const $=(await P.response).messages;R.current=[...Q,...$];const L=xe(T);if(L>0){const y=Math.max(0,v-x.current);x.current+=Math.min(L,y),b(x.current)}const _=fe.test(T);return _&&l("guessing"),_}catch(i){const m=i instanceof DOMException&&(i.name==="AbortError"||i.name==="TimeoutError")?"Request timed out. Please try again.":i instanceof Error?i.message:String(i);return u(I=>I.filter(A=>A.id!==d)),q(m),!1}finally{C.current=!1,S(!1)}},[t,s,E]),B=r.useCallback(async()=>{if(!s||!a||C.current)return;q(null),u([]),b(0),x.current=0,R.current=[],l("playing");const h="I'm thinking of something in my Elasticsearch cluster. Start the game — explore the cluster and ask your first question!";u([{id:crypto.randomUUID(),role:"user",content:h}]),await k(h)},[s,a,k]),H=r.useCallback(async h=>{if(C.current)return;const d={id:crypto.randomUUID(),role:"user",content:h};if(u(i=>[...i,d]),o==="guessing"){const i=h.toLowerCase().trim(),m=i==="yes"||i==="yes, that's correct!";l(m?"won":"lost"),u(I=>[...I,{id:crypto.randomUUID(),role:"system",content:m?`🎉 The AI guessed it in ${x.current} questions!`:"The AI's guess was wrong. Better luck next time!"}]);return}if(x.current>=v){await k(h+`

(You have used all your questions. Make your final guess now.)`);return}await k(h)},[o,k]);return{status:o,messages:n,questionCount:f,loading:j,error:Y,messagesEndRef:N,startGame:B,handleAnswer:H}}const we=["p","br","strong","em","code","pre","ul","ol","li","blockquote"];function be({toolCalls:t}){return t.length===0?null:e.jsx(c,{sx:{mb:.5},children:t.map(s=>e.jsx(p,{variant:"caption",sx:{display:"block",color:"text.secondary"},children:s.result?`✓ ${G(s.name)} — ${s.result}`:`⏳ ${G(s.name)}…`},s.toolCallId))})}function je({msg:t,isActive:s}){const a=t.role==="user"?"flex-end":t.role==="system"?"center":"flex-start",o=t.role==="user"?"primary.main":t.role==="system"?"action.selected":"action.hover",l=t.role==="user"?"primary.contrastText":"text.primary",n=t.toolCalls??[];return e.jsx(c,{sx:{display:"flex",justifyContent:a},children:e.jsxs(D,{elevation:0,sx:{maxWidth:t.role==="system"?"90%":"75%",py:1,px:2,borderRadius:2,bgcolor:o,color:l},children:[e.jsx(be,{toolCalls:n}),t.role==="assistant"?t.content?e.jsx(c,{sx:{typography:"body2"},children:e.jsx(ne,{remarkPlugins:[oe],allowedElements:we,skipHtml:!0,children:t.content})}):s&&n.length===0?e.jsx(p,{variant:"body2",color:"text.secondary",children:"Thinking…"}):null:e.jsx(p,{variant:"body2",sx:{whiteSpace:"pre-wrap",...t.role==="system"?{fontStyle:"italic"}:{}},children:t.content})]})})}function Ce({status:t,onAnswer:s}){const[a,o]=r.useState(""),l=()=>{const n=a.trim();n&&(s(n),o(""))};return t==="guessing"?e.jsxs(c,{sx:{display:"flex",gap:1,justifyContent:"center"},children:[e.jsx(g,{variant:"contained",color:"success",onClick:()=>s("Yes, that's correct!"),children:"✅ Correct!"}),e.jsx(g,{variant:"contained",color:"error",onClick:()=>s("No, that's wrong."),children:"❌ Wrong"})]}):e.jsxs(c,{sx:{display:"flex",flexDirection:"column",gap:1},children:[e.jsxs(c,{sx:{display:"flex",gap:1,justifyContent:"center"},children:[e.jsx(g,{variant:"contained",onClick:()=>s("Yes"),children:"Yes"}),e.jsx(g,{variant:"outlined",onClick:()=>s("No"),children:"No"})]}),e.jsxs(c,{sx:{display:"flex",gap:1},children:[e.jsx(X,{fullWidth:!0,size:"small","aria-label":"Your answer",placeholder:"Or type a more detailed answer…",value:a,onChange:n=>o(n.target.value),onKeyDown:n=>{n.key==="Enter"&&!n.shiftKey&&(n.preventDefault(),l())}}),e.jsx(z,{color:"primary",onClick:l,disabled:!a.trim(),"aria-label":"Send answer",children:e.jsx(V,{})})]})]})}function ke({game:t}){const{status:s,messages:a,loading:o,error:l,messagesEndRef:n,startGame:u,handleAnswer:f}=t,b=s==="won"||s==="lost";return l?e.jsxs(c,{sx:{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",alignItems:"center",gap:2},children:[e.jsx(D,{variant:"outlined",sx:{p:2,maxWidth:480,borderColor:"error.dark",bgcolor:"error.main",color:"error.contrastText"},children:e.jsx(p,{variant:"body2",children:l})}),e.jsx(g,{variant:"contained",onClick:u,children:"Try Again"})]}):s==="idle"?e.jsxs(c,{sx:{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",alignItems:"center",gap:2},children:[e.jsx(p,{variant:"h6",color:"text.secondary",children:"How to Play"}),e.jsxs(p,{variant:"body2",color:"text.secondary",sx:{maxWidth:480,textAlign:"center"},children:["Think of something in your Elasticsearch cluster — a specific log entry, an index, a service, a host, an error message, or anything else that lives in the data. Click"," ",e.jsx("strong",{children:"New Game"})," and the AI will query the cluster and ask you up to"," ",v," yes/no questions to figure out what you're thinking of."]})]}):e.jsxs(c,{sx:{display:"flex",flex:1,flexDirection:"column",minHeight:0,gap:1},children:[e.jsxs(D,{variant:"outlined",role:"log","aria-live":"polite","aria-relevant":"additions text","aria-busy":o,sx:{display:"flex",flex:1,flexDirection:"column",gap:1.5,minHeight:0,overflowY:"auto",p:2},children:[a.map((j,S)=>e.jsx(je,{msg:j,isActive:o&&j.role==="assistant"&&S===a.length-1},j.id)),e.jsx("div",{ref:n})]}),!b&&!o&&e.jsx(Ce,{status:s,onAnswer:f}),o&&e.jsx(c,{sx:{display:"flex",justifyContent:"center",py:1},children:e.jsx(F,{sx:{width:120}})}),b&&e.jsx(c,{sx:{display:"flex",justifyContent:"center",py:1},children:e.jsx(g,{variant:"contained",onClick:u,children:"Play Again"})})]})}function De(){const{config:t,isConfigured:s}=ie(re(f=>({config:f.config,isConfigured:f.isConfigured}))),a=ae(f=>f.connection),o=le(),l=s(),n=ve(t,a,l),u=n.status==="won"||n.status==="lost";return l?e.jsxs(O,{gap:1.5,children:[e.jsx(U,{title:"20 Questions",description:"Think of something in your cluster — the AI queries Elasticsearch to guess what it is",actions:e.jsxs(c,{sx:{display:"flex",gap:1,alignItems:"center"},children:[(n.status==="playing"||n.status==="guessing")&&e.jsx(Z,{label:`${n.questionCount} / ${v} questions`,color:n.questionCount>=v-5?"warning":"default"}),e.jsx(g,{variant:"contained",onClick:n.startGame,disabled:n.loading,children:n.status==="idle"?"New Game":u?"Play Again":"Restart"})]})}),e.jsx(ke,{game:n})]}):e.jsxs(O,{children:[e.jsx(U,{title:"20 Questions",description:"Think of something in your cluster — the AI queries Elasticsearch to guess what it is"}),e.jsxs(c,{sx:{display:"flex",flex:1,flexDirection:"column",gap:2,justifyContent:"center",alignItems:"center"},children:[e.jsx(p,{variant:"subtitle1",color:"text.secondary",children:"LLM provider not configured"}),e.jsx(p,{variant:"body2",color:"text.secondary",sx:{mb:1},children:"Configure an API key in Settings to play 20 Questions."}),e.jsx(g,{variant:"contained",startIcon:e.jsx(J,{}),onClick:()=>o(ce.settings.path),children:"Go to Settings"})]})]})}export{De as default};
//# sourceMappingURL=TwentyQuestionsPage-B0PhlZdG.js.map
