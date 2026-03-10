import{r as a,j as e,B as u,b2 as D,k as p,n as g,bM as B,h as K,I as $,b3 as H,ag as F,ad as X}from"./mui-hXvMhbqI.js";import{bI as z,bJ as V,bK as J,M as Z,aK as ee,bL as N,ay as te,d as se,i as ne,l as oe,R as ie}from"./index-BdhD-rvK.js";import{c as re,h as ae,f as le}from"./ai-sdk-BNySMn_0.js";import{P as U}from"./PageContainer-B-Di_yS_.js";import{P as _}from"./PageHeader-CpVpYygm.js";import"./perses-CkerAPsu.js";import"./codemirror-WwuEBBZ8.js";import"./echarts-D97nCBS2.js";const v=20,ce=6e4,ue=10,de=/^\s*my guess:\s*/im;function he(t){const s=v-t;return`You are a playful, curious detective playing **20 Questions** against a human who is thinking of something inside their Elasticsearch cluster. It could be a specific log entry, an index, a field value, an error, a service, a host — anything that lives in the cluster.

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
- ALWAYS run at least one query per turn — use real cluster data to inform your questions.
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

`+J}const me=/^(?:[-*]\s*)?(?:(?:question\s*\d*[:.)-]?\s*)|(?:q[:.)-]?\s*)|(?:\d+[).:-]\s*)|(?:who|what|when|where|why|how|is|are|am|was|were|can|could|do|does|did|will|would|should|has|have|had|may|might|must)\b)/i;function ye(t){const s=t.match(/\bquestion\s+\d+\s*[:\b]/gi);return s&&s.length>0?s.length:t.split(`
`).map(o=>o.trim()).filter(o=>o.endsWith("?")&&o.length>0&&o.length<=120&&!o.startsWith("(")&&!o.startsWith("|")&&!o.startsWith("//")&&!o.startsWith("```")&&me.test(o)).length}function fe(t,s,l){const[o,c]=a.useState("idle"),[n,m]=a.useState([]),[f,j]=a.useState(0),[C,E]=a.useState(!1),[G,A]=a.useState(null),P=a.useRef(null),R=a.useRef([]),k=a.useRef(!1);a.useEffect(()=>{R.current=n,P.current?.scrollIntoView({behavior:"smooth"})},[n]);const x=a.useRef(0),q=a.useCallback((y,d)=>{m(i=>i.map(h=>h.id!==y?h:{...h,...d.content!==void 0?{content:d.content}:{},...d.toolCalls!==void 0?{toolCalls:d.toolCalls}:{}}))},[]),I=a.useCallback(async y=>{if(!s||k.current)return!1;k.current=!0,A(null),E(!0);const d=crypto.randomUUID();m(i=>[...i,{id:d,role:"assistant",content:"",toolCalls:[]}]);try{const i=re({apiKey:t.apiKey,...t.provider==="openrouter"?{baseURL:"https://openrouter.ai/api/v1"}:{}}),h=t.provider==="openrouter"?i.chat(t.model):i(t.model),w=z(s),S=he(x.current),W=ae({model:h,system:S,messages:y.filter(r=>r.role!=="system").map(r=>({role:r.role,content:r.content})),tools:w,stopWhen:le(ue),abortSignal:AbortSignal.timeout(ce)});let T="",b=[];for await(const r of W.fullStream)r.type==="text-delta"?(T+=r.text,q(d,{content:T})):r.type==="tool-call"?(b=[...b,{toolCallId:r.toolCallId,name:r.toolName}],q(d,{toolCalls:b})):r.type==="tool-result"&&(b=b.map(M=>M.toolCallId===r.toolCallId?{...M,result:V(r.toolName,r.output)}:M),q(d,{toolCalls:b}));const Q=ye(T);if(Q>0){const r=Math.max(0,v-x.current);x.current+=Math.min(Q,r),j(x.current)}const L=de.test(T);return L&&c("guessing"),L}catch(i){const h=i instanceof DOMException&&(i.name==="AbortError"||i.name==="TimeoutError")?"Request timed out. Please try again.":i instanceof Error?i.message:String(i);return m(w=>w.filter(S=>S.id!==d)),A(h),!1}finally{k.current=!1,E(!1)}},[t,s,q]),O=a.useCallback(async()=>{if(!s||!l||k.current)return;A(null),m([]),j(0),x.current=0,c("playing");const y={id:crypto.randomUUID(),role:"user",content:"I'm thinking of something in my Elasticsearch cluster. Start the game — explore the cluster and ask your first question!"};await I([y])},[s,l,I]),Y=a.useCallback(async y=>{if(k.current)return;const d={id:crypto.randomUUID(),role:"user",content:y},i=[...R.current,d];if(m(i),o==="guessing"){const h=y.toLowerCase().trim(),w=h==="yes"||h==="yes, that's correct!";c(w?"won":"lost"),m(S=>[...S,{id:crypto.randomUUID(),role:"system",content:w?`🎉 The AI guessed it in ${x.current} questions!`:"The AI's guess was wrong. Better luck next time!"}]);return}if(x.current>=v){const h={id:crypto.randomUUID(),role:"user",content:y+`

(You have used all your questions. Make your final guess now.)`};await I([...R.current,h]);return}await I(i)},[o,I]);return{status:o,messages:n,questionCount:f,loading:C,error:G,messagesEndRef:P,startGame:O,handleAnswer:Y}}const ge=["p","br","strong","em","code","pre","ul","ol","li","blockquote"];function pe({toolCalls:t}){return t.length===0?null:e.jsx(u,{sx:{mb:.5},children:t.map(s=>e.jsx(p,{variant:"caption",sx:{display:"block",color:"text.secondary"},children:s.result?`✓ ${N(s.name)} — ${s.result}`:`⏳ ${N(s.name)}…`},s.toolCallId))})}function xe({msg:t,isActive:s}){const l=t.role==="user"?"flex-end":t.role==="system"?"center":"flex-start",o=t.role==="user"?"primary.main":t.role==="system"?"action.selected":"action.hover",c=t.role==="user"?"primary.contrastText":"text.primary",n=t.toolCalls??[];return e.jsx(u,{sx:{display:"flex",justifyContent:l},children:e.jsxs(D,{elevation:0,sx:{maxWidth:t.role==="system"?"90%":"75%",py:1,px:2,borderRadius:2,bgcolor:o,color:c},children:[e.jsx(pe,{toolCalls:n}),t.role==="assistant"?t.content?e.jsx(u,{sx:{typography:"body2"},children:e.jsx(Z,{remarkPlugins:[ee],allowedElements:ge,skipHtml:!0,children:t.content})}):s&&n.length===0?e.jsx(p,{variant:"body2",color:"text.secondary",children:"Thinking…"}):null:e.jsx(p,{variant:"body2",sx:{whiteSpace:"pre-wrap",...t.role==="system"?{fontStyle:"italic"}:{}},children:t.content})]})})}function ve({status:t,onAnswer:s}){const[l,o]=a.useState(""),c=()=>{const n=l.trim();n&&(s(n),o(""))};return t==="guessing"?e.jsxs(u,{sx:{display:"flex",gap:1,justifyContent:"center"},children:[e.jsx(g,{variant:"contained",color:"success",onClick:()=>s("Yes, that's correct!"),children:"✅ Correct!"}),e.jsx(g,{variant:"contained",color:"error",onClick:()=>s("No, that's wrong."),children:"❌ Wrong"})]}):e.jsxs(u,{sx:{display:"flex",flexDirection:"column",gap:1},children:[e.jsxs(u,{sx:{display:"flex",gap:1,justifyContent:"center"},children:[e.jsx(g,{variant:"contained",onClick:()=>s("Yes"),children:"Yes"}),e.jsx(g,{variant:"outlined",onClick:()=>s("No"),children:"No"})]}),e.jsxs(u,{sx:{display:"flex",gap:1},children:[e.jsx(K,{fullWidth:!0,size:"small","aria-label":"Your answer",placeholder:"Or type a more detailed answer…",value:l,onChange:n=>o(n.target.value),onKeyDown:n=>{n.key==="Enter"&&!n.shiftKey&&(n.preventDefault(),c())}}),e.jsx($,{color:"primary",onClick:c,disabled:!l.trim(),"aria-label":"Send answer",children:e.jsx(H,{})})]})]})}function we({game:t}){const{status:s,messages:l,loading:o,error:c,messagesEndRef:n,startGame:m,handleAnswer:f}=t,j=s==="won"||s==="lost";return c?e.jsxs(u,{sx:{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",alignItems:"center",gap:2},children:[e.jsx(D,{variant:"outlined",sx:{p:2,maxWidth:480,borderColor:"error.dark",bgcolor:"error.main",color:"error.contrastText"},children:e.jsx(p,{variant:"body2",children:c})}),e.jsx(g,{variant:"contained",onClick:m,children:"Try Again"})]}):s==="idle"?e.jsxs(u,{sx:{display:"flex",flex:1,flexDirection:"column",justifyContent:"center",alignItems:"center",gap:2},children:[e.jsx(p,{variant:"h6",color:"text.secondary",children:"How to Play"}),e.jsxs(p,{variant:"body2",color:"text.secondary",sx:{maxWidth:480,textAlign:"center"},children:["Think of something in your Elasticsearch cluster — a specific log entry, an index, a service, a host, an error message, or anything else that lives in the data. Click"," ",e.jsx("strong",{children:"New Game"})," and the AI will query the cluster and ask you up to"," ",v," yes/no questions to figure out what you're thinking of."]})]}):e.jsxs(u,{sx:{display:"flex",flex:1,flexDirection:"column",minHeight:0,gap:1},children:[e.jsxs(D,{variant:"outlined",role:"log","aria-live":"polite","aria-relevant":"additions text","aria-busy":o,sx:{display:"flex",flex:1,flexDirection:"column",gap:1.5,minHeight:0,overflowY:"auto",p:2},children:[l.map((C,E)=>e.jsx(xe,{msg:C,isActive:o&&C.role==="assistant"&&E===l.length-1},C.id)),e.jsx("div",{ref:n})]}),!j&&!o&&e.jsx(ve,{status:s,onAnswer:f}),o&&e.jsx(u,{sx:{display:"flex",justifyContent:"center",py:1},children:e.jsx(B,{sx:{width:120}})}),j&&e.jsx(u,{sx:{display:"flex",justifyContent:"center",py:1},children:e.jsx(g,{variant:"contained",onClick:m,children:"Play Again"})})]})}function Te(){const{config:t,isConfigured:s}=te(se(f=>({config:f.config,isConfigured:f.isConfigured}))),l=ne(f=>f.connection),o=oe(),c=s(),n=fe(t,l,c),m=n.status==="won"||n.status==="lost";return c?e.jsxs(U,{gap:1.5,children:[e.jsx(_,{title:"20 Questions",description:"Think of something in your cluster — the AI queries Elasticsearch to guess what it is",actions:e.jsxs(u,{sx:{display:"flex",gap:1,alignItems:"center"},children:[(n.status==="playing"||n.status==="guessing")&&e.jsx(X,{label:`${n.questionCount} / ${v} questions`,color:n.questionCount>=v-5?"warning":"default"}),e.jsx(g,{variant:"contained",onClick:n.startGame,disabled:n.loading,children:n.status==="idle"?"New Game":m?"Play Again":"Restart"})]})}),e.jsx(we,{game:n})]}):e.jsxs(U,{children:[e.jsx(_,{title:"20 Questions",description:"Think of something in your cluster — the AI queries Elasticsearch to guess what it is"}),e.jsxs(u,{sx:{display:"flex",flex:1,flexDirection:"column",gap:2,justifyContent:"center",alignItems:"center"},children:[e.jsx(p,{variant:"subtitle1",color:"text.secondary",children:"LLM provider not configured"}),e.jsx(p,{variant:"body2",color:"text.secondary",sx:{mb:1},children:"Configure an API key in Settings to play 20 Questions."}),e.jsx(g,{variant:"contained",startIcon:e.jsx(F,{}),onClick:()=>o(ie.settings.path),children:"Go to Settings"})]})]})}export{Te as default};
//# sourceMappingURL=TwentyQuestionsPage-z9W_ynvB.js.map
