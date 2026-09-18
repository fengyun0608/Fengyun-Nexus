import{D as ie,d as M,i as o,c,b as a,S as B,T as h,R as k,F as q,y as _,Z,$ as Q,a0 as ee,a1 as re,a2 as te,m as N,a3 as se,a4 as j,G as A,H as y,K as D,P as oe,a5 as X,V as le,W as ne,X as F,u as ae,n as ce,o as de,a as ue,e as P,f as z,g as S,r as G,h as Y,B as W,j as I,t as T,Y as U,k as ge,s as fe,l as H,p as pe,v as he,_ as ve}from"./index-iR9yFhZF.js";import{T as ye}from"./Tag-C1dBs9WP.js";import{S as J}from"./Space-CM6rKc5w.js";import{S as me}from"./Spin-DfuxkiAw.js";import"./use-compitable-B_UVvkMo.js";function be(e){const{infoColor:m,successColor:v,warningColor:x,errorColor:g,textColor2:l,progressRailColor:s,fontSize:i,fontWeight:d}=e;return{fontSize:i,fontSizeCircle:"28px",fontWeightCircle:d,railColor:s,railHeight:"8px",iconSizeCircle:"36px",iconSizeLine:"18px",iconColor:m,iconColorInfo:m,iconColorSuccess:v,iconColorWarning:x,iconColorError:g,textColorCircle:l,textColorLineInner:"rgb(255, 255, 255)",textColorLineOuter:l,fillColor:m,fillColorInfo:m,fillColorSuccess:v,fillColorWarning:x,fillColorError:g,lineBgProcessing:"linear-gradient(90deg, rgba(255, 255, 255, .3) 0%, rgba(255, 255, 255, .5) 100%)"}}const Ce={common:ie,self:be},xe=["id"],ke=["stop-color"],$e=["stop-color"],Se=["viewBox"],we=["d","stroke-width"],_e=["d","stroke-width"],ze={success:(o(),_(te)),error:(o(),_(re)),warning:(o(),_(ee)),info:(o(),_(Q))};var Pe=M({name:"ProgressCircle",props:{clsPrefix:{type:String,required:!0},status:{type:String,required:!0},strokeWidth:{type:Number,required:!0},fillColor:[String,Object],railColor:String,railStyle:[String,Object],percentage:{type:Number,default:0},offsetDegree:{type:Number,default:0},showIndicator:{type:Boolean,required:!0},indicatorTextColor:String,unit:String,viewBoxWidth:{type:Number,required:!0},gapDegree:{type:Number,required:!0},gapOffsetDegree:{type:Number,default:0}},setup(e,{slots:m}){const v=N(()=>{const l="gradient",{fillColor:s}=e;return typeof s=="object"?`${l}-${se(JSON.stringify(s))}`:l});function x(l,s,i,d){const{gapDegree:C,viewBoxWidth:f,strokeWidth:b}=e,u=50,$=0,p=u,t=0,r=100,n=50+b/2,w=`M ${n},${n} m ${$},${p}
      a ${u},${u} 0 1 1 ${t},-100
      a ${u},${u} 0 1 1 0,${r}`,R=Math.PI*2*u;return{pathString:w,pathStyle:{stroke:d==="rail"?i:typeof e.fillColor=="object"?`url(#${v.value})`:i,strokeDasharray:`${Math.min(l,100)/100*(R-C)}px ${f*8}px`,strokeDashoffset:`-${C/2}px`,transformOrigin:s?"center":void 0,transform:s?`rotate(${s}deg)`:void 0}}}const g=()=>{const l=typeof e.fillColor=="object",s=l?e.fillColor.stops[0]:"",i=l?e.fillColor.stops[1]:"";return l&&(o(),c("defs",null,[a("linearGradient",{id:v.value,x1:"0%",y1:"100%",x2:"100%",y2:"0%"},[a("stop",{offset:"0%","stop-color":s},null,8,ke),a("stop",{offset:"100%","stop-color":i},null,8,$e)],8,xe)]))};return()=>{const{fillColor:l,railColor:s,strokeWidth:i,offsetDegree:d,status:C,percentage:f,showIndicator:b,indicatorTextColor:u,unit:$,gapOffsetDegree:p,clsPrefix:t}=e,{pathString:r,pathStyle:n}=x(100,0,s,"rail"),{pathString:w,pathStyle:R}=x(f,d,l,"fill"),O=100+i;return o(),c("div",{class:h(`${t}-progress-content`),role:"none"},[a("div",{class:h(`${t}-progress-graph`),"aria-hidden":!0},[a("div",{class:h(`${t}-progress-graph-circle`),style:B({transform:p?`rotate(${p}deg)`:void 0})},[(o(),c("svg",{viewBox:`0 0 ${O} ${O}`},[k(()=>g()),a("g",null,[a("path",{class:h(`${t}-progress-graph-circle-rail`),d:r,"stroke-width":i,"stroke-linecap":"round",fill:"none",style:B(n)},null,14,we)]),a("g",null,[a("path",{class:h([`${t}-progress-graph-circle-fill`,f===0&&`${t}-progress-graph-circle-fill--empty`]),d:w,"stroke-width":i,"stroke-linecap":"round",fill:"none",style:B(R)},null,14,_e)])],8,Se))],6)],2),b?(o(),c("div",{key:0},[m.default?(o(),c("div",{key:0,class:h(`${t}-progress-custom-content`),role:"none"},[k(()=>m.default())],2)):(o(),c(q,{key:1},[C!=="default"?(o(),c("div",{key:0,class:h(`${t}-progress-icon`),"aria-hidden":!0},[(o(),_(Z,{clsPrefix:t},{default:()=>ze[C]},1032,["clsPrefix"]))],2)):(o(),c("div",{key:1,class:h(`${t}-progress-text`),style:B({color:u}),role:"none"},[a("span",{class:h(`${t}-progress-text__percentage`)},[k(()=>f)],2),a("span",{class:h(`${t}-progress-text__unit`)},[k(()=>$)],2)],6))],64))])):k(()=>null)],2)}}});const Be={success:(o(),_(te)),error:(o(),_(re)),warning:(o(),_(ee)),info:(o(),_(Q))};var Re=M({name:"ProgressLine",props:{clsPrefix:{type:String,required:!0},percentage:{type:Number,default:0},railColor:String,railStyle:[String,Object],fillColor:[String,Object],status:{type:String,required:!0},indicatorPlacement:{type:String,required:!0},indicatorTextColor:String,unit:{type:String,default:"%"},processing:{type:Boolean,required:!0},showIndicator:{type:Boolean,required:!0},height:[String,Number],railBorderRadius:[String,Number],fillBorderRadius:[String,Number]},setup(e,{slots:m}){const v=N(()=>j(e.height)),x=N(()=>{var s,i;return typeof e.fillColor=="object"?`linear-gradient(to right, ${(s=e.fillColor)==null?void 0:s.stops[0]} , ${(i=e.fillColor)==null?void 0:i.stops[1]})`:e.fillColor}),g=N(()=>e.railBorderRadius!==void 0?j(e.railBorderRadius):e.height!==void 0?j(e.height,{c:.5}):""),l=N(()=>e.fillBorderRadius!==void 0?j(e.fillBorderRadius):e.railBorderRadius!==void 0?j(e.railBorderRadius):e.height!==void 0?j(e.height,{c:.5}):"");return()=>{const{indicatorPlacement:s,railColor:i,railStyle:d,percentage:C,unit:f,indicatorTextColor:b,status:u,showIndicator:$,processing:p,clsPrefix:t}=e;return o(),c("div",{class:h(`${t}-progress-content`),role:"none"},[a("div",{class:h(`${t}-progress-graph`),"aria-hidden":!0},[a("div",{class:h([`${t}-progress-graph-line`,{[`${t}-progress-graph-line--indicator-${s}`]:!0}])},[a("div",{class:h(`${t}-progress-graph-line-rail`),style:B([{backgroundColor:i,height:v.value,borderRadius:g.value},d])},[a("div",{class:h([`${t}-progress-graph-line-fill`,p&&`${t}-progress-graph-line-fill--processing`]),style:B({maxWidth:`${e.percentage}%`,background:x.value,height:v.value,lineHeight:v.value,borderRadius:l.value})},[s==="inside"?(o(),c("div",{key:0,class:h(`${t}-progress-graph-line-indicator`),style:B({color:b})},[m.default?(o(),c(q,{key:0},[k(()=>m.default())],64)):(o(),c(q,{key:1},[k(()=>`${C}${f}`)],64))],6)):k(()=>null)],6)],6)],2)],2),$&&s==="outside"?(o(),c("div",{key:0},[m.default?(o(),c("div",{key:0,class:h(`${t}-progress-custom-content`),style:B({color:b}),role:"none"},[k(()=>m.default())],6)):(o(),c(q,{key:1},[u==="default"?(o(),c("div",{key:0,role:"none",class:h(`${t}-progress-icon ${t}-progress-icon--as-text`),style:B({color:b})},[k(()=>C),k(()=>f)],6)):(o(),c("div",{key:1,class:h(`${t}-progress-icon`),"aria-hidden":!0},[(o(),_(Z,{clsPrefix:t},{default:()=>Be[u]},1032,["clsPrefix"]))],2))],64))])):k(()=>null)],2)}}});const Ne=["id"],Ie=["stop-color"],De=["stop-color"],We=["d","stroke-width"],Te=["d","stroke-width"],qe=["viewBox"];function K(e,m,v=100){return`m ${v/2} ${v/2-e} a ${e} ${e} 0 1 1 0 ${2*e} a ${e} ${e} 0 1 1 0 -${2*e}`}var Oe=M({name:"ProgressMultipleCircle",props:{clsPrefix:{type:String,required:!0},viewBoxWidth:{type:Number,required:!0},percentage:{type:Array,default:[0]},strokeWidth:{type:Number,required:!0},circleGap:{type:Number,required:!0},showIndicator:{type:Boolean,required:!0},fillColor:{type:Array,default:()=>[]},railColor:{type:Array,default:()=>[]},railStyle:{type:Array,default:()=>[]}},setup(e,{slots:m}){const v=N(()=>e.percentage.map((g,l)=>`${Math.PI*g/100*(e.viewBoxWidth/2-e.strokeWidth/2*(1+2*l)-e.circleGap*l)*2}, ${e.viewBoxWidth*8}`)),x=(g,l)=>{const s=e.fillColor[l],i=typeof s=="object"?s.stops[0]:"",d=typeof s=="object"?s.stops[1]:"";return typeof e.fillColor[l]=="object"&&(o(),c("linearGradient",{id:`gradient-${l}`,x1:"100%",y1:"0%",x2:"0%",y2:"100%"},[a("stop",{offset:"0%","stop-color":i},null,8,Ie),a("stop",{offset:"100%","stop-color":d},null,8,De)],8,Ne))};return()=>{const{viewBoxWidth:g,strokeWidth:l,circleGap:s,showIndicator:i,fillColor:d,railColor:C,railStyle:f,percentage:b,clsPrefix:u}=e;return o(),c("div",{class:h(`${u}-progress-content`),role:"none"},[a("div",{class:h(`${u}-progress-graph`),"aria-hidden":!0},[a("div",{class:h(`${u}-progress-graph-circle`)},[(o(),c("svg",{viewBox:`0 0 ${g} ${g}`},[a("defs",null,[k(()=>b.map(($,p)=>x($,p)))]),k(()=>b.map(($,p)=>(o(),c("g",{key:p},[a("path",{class:h(`${u}-progress-graph-circle-rail`),d:K(g/2-l/2*(1+2*p)-s*p,l,g),"stroke-width":l,"stroke-linecap":"round",fill:"none",style:B([{strokeDashoffset:0,stroke:C[p]},f[p]])},null,14,We),a("path",{class:h([`${u}-progress-graph-circle-fill`,$===0&&`${u}-progress-graph-circle-fill--empty`]),d:K(g/2-l/2*(1+2*p)-s*p,l,g),"stroke-width":l,"stroke-linecap":"round",fill:"none",style:B({strokeDasharray:v.value[p],strokeDashoffset:0,stroke:typeof d[p]=="object"?`url(#gradient-${p})`:d[p]})},null,14,Te)]))))],8,qe))],2)],2),i&&m.default?(o(),c("div",{key:0},[a("div",{class:h(`${u}-progress-text`)},[k(()=>m.default())],2)])):k(()=>null)],2)}}}),je=A([y("progress",{display:"inline-block"},[y("progress-icon",`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 `),D("line",`
 width: 100%;
 display: block;
 `,[y("progress-content",`
 display: flex;
 align-items: center;
 `,[y("progress-graph",{flex:1})]),y("progress-custom-content",{marginLeft:"14px"}),y("progress-icon",`
 width: 30px;
 padding-left: 14px;
 height: var(--n-icon-size-line);
 line-height: var(--n-icon-size-line);
 font-size: var(--n-icon-size-line);
 `,[D("as-text",`
 color: var(--n-text-color-line-outer);
 text-align: center;
 width: 40px;
 font-size: var(--n-font-size);
 padding-left: 4px;
 transition: color .3s var(--n-bezier);
 `)])]),D("circle, dashboard",{width:"120px"},[y("progress-custom-content",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 `),y("progress-text",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: inherit;
 font-size: var(--n-font-size-circle);
 color: var(--n-text-color-circle);
 font-weight: var(--n-font-weight-circle);
 transition: color .3s var(--n-bezier);
 white-space: nowrap;
 `),y("progress-icon",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: var(--n-icon-color);
 font-size: var(--n-icon-size-circle);
 `)]),D("multiple-circle",`
 width: 200px;
 color: inherit;
 `,[y("progress-text",`
 font-weight: var(--n-font-weight-circle);
 color: var(--n-text-color-circle);
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 transition: color .3s var(--n-bezier);
 `)]),y("progress-content",{position:"relative"}),y("progress-graph",{position:"relative"},[y("progress-graph-circle",[A("svg",{verticalAlign:"bottom"}),y("progress-graph-circle-fill",`
 stroke: var(--n-fill-color);
 transition:
 opacity .3s var(--n-bezier),
 stroke .3s var(--n-bezier),
 stroke-dasharray .3s var(--n-bezier);
 `,[D("empty",{opacity:0})]),y("progress-graph-circle-rail",`
 transition: stroke .3s var(--n-bezier);
 overflow: hidden;
 stroke: var(--n-rail-color);
 `)]),y("progress-graph-line",[D("indicator-inside",[y("progress-graph-line-rail",`
 height: 16px;
 line-height: 16px;
 border-radius: 10px;
 `,[y("progress-graph-line-fill",`
 height: inherit;
 border-radius: 10px;
 `),y("progress-graph-line-indicator",`
 background: #0000;
 white-space: nowrap;
 text-align: right;
 margin-left: 14px;
 margin-right: 14px;
 height: inherit;
 font-size: 12px;
 color: var(--n-text-color-line-inner);
 transition: color .3s var(--n-bezier);
 `)])]),D("indicator-inside-label",`
 height: 16px;
 display: flex;
 align-items: center;
 `,[y("progress-graph-line-rail",`
 flex: 1;
 transition: background-color .3s var(--n-bezier);
 `),y("progress-graph-line-indicator",`
 background: var(--n-fill-color);
 font-size: 12px;
 transform: translateZ(0);
 display: flex;
 vertical-align: middle;
 height: 16px;
 line-height: 16px;
 padding: 0 10px;
 border-radius: 10px;
 position: absolute;
 white-space: nowrap;
 color: var(--n-text-color-line-inner);
 transition:
 right .2s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `)]),y("progress-graph-line-rail",`
 position: relative;
 overflow: hidden;
 height: var(--n-rail-height);
 border-radius: 5px;
 background-color: var(--n-rail-color);
 transition: background-color .3s var(--n-bezier);
 `,[y("progress-graph-line-fill",`
 background: var(--n-fill-color);
 position: relative;
 border-radius: 5px;
 height: inherit;
 width: 100%;
 max-width: 0%;
 transition:
 background-color .3s var(--n-bezier),
 max-width .2s var(--n-bezier);
 `,[D("processing",[A("&::after",`
 content: "";
 background-image: var(--n-line-bg-processing);
 animation: progress-processing-animation 2s var(--n-bezier) infinite;
 `)])])])])])]),A("@keyframes progress-processing-animation",`
 0% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 100%;
 opacity: 1;
 }
 66% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 100% {
 position: absolute;
 left: 0;
 top: 0;
 bottom: 0;
 right: 0;
 opacity: 0;
 }
 `)]);const Le=["aria-valuenow","role"],Me={...oe.props,processing:Boolean,type:{type:String,default:"line"},gapDegree:Number,gapOffsetDegree:Number,status:{type:String,default:"default"},railColor:[String,Array],railStyle:[String,Array],color:[String,Array,Object],viewBoxWidth:{type:Number,default:100},strokeWidth:{type:Number,default:7},percentage:[Number,Array],unit:{type:String,default:"%"},showIndicator:{type:Boolean,default:!0},indicatorPosition:{type:String,default:"outside"},indicatorPlacement:{type:String,default:"outside"},indicatorTextColor:String,circleGap:{type:Number,default:1},height:Number,borderRadius:[String,Number],fillBorderRadius:[String,Number],offsetDegree:Number};var Ae=M({name:"Progress",props:Me,setup(e){const m=N(()=>e.indicatorPlacement||e.indicatorPosition),v=N(()=>{if(e.gapDegree||e.gapDegree===0)return e.gapDegree;if(e.type==="dashboard")return 75}),{mergedClsPrefixRef:x,inlineThemeDisabled:g}=le(e),l=oe("Progress","-progress",je,Ce,e,x),s=N(()=>{const{status:d}=e,{common:{cubicBezierEaseInOut:C},self:{fontSize:f,fontSizeCircle:b,railColor:u,railHeight:$,iconSizeCircle:p,iconSizeLine:t,textColorCircle:r,textColorLineInner:n,textColorLineOuter:w,lineBgProcessing:R,fontWeightCircle:O,[F("iconColor",d)]:E,[F("fillColor",d)]:L}}=l.value;return{"--n-bezier":C,"--n-fill-color":L,"--n-font-size":f,"--n-font-size-circle":b,"--n-font-weight-circle":O,"--n-icon-color":E,"--n-icon-size-circle":p,"--n-icon-size-line":t,"--n-line-bg-processing":R,"--n-rail-color":u,"--n-rail-height":$,"--n-text-color-circle":r,"--n-text-color-line-inner":n,"--n-text-color-line-outer":w}}),i=g?ne("progress",N(()=>e.status[0]),s,e):void 0;return{mergedClsPrefix:x,mergedIndicatorPlacement:m,gapDeg:v,cssVars:g?void 0:s,themeClass:i==null?void 0:i.themeClass,onRender:i==null?void 0:i.onRender}},render(){const{type:e,cssVars:m,indicatorTextColor:v,showIndicator:x,status:g,railColor:l,railStyle:s,color:i,percentage:d,viewBoxWidth:C,strokeWidth:f,mergedIndicatorPlacement:b,unit:u,borderRadius:$,fillBorderRadius:p,height:t,processing:r,circleGap:n,mergedClsPrefix:w,gapDeg:R,gapOffsetDegree:O,themeClass:E,$slots:L,onRender:V}=this;return V==null||V(),o(),c("div",{class:h([E,`${w}-progress`,`${w}-progress--${e}`,`${w}-progress--${g}`]),style:B(m),"aria-valuemax":100,"aria-valuemin":0,"aria-valuenow":d,role:e==="circle"||e==="line"||e==="dashboard"?"progressbar":"none"},[e==="circle"||e==="dashboard"?(o(),_(Pe,{key:0,clsPrefix:w,status:g,showIndicator:x,indicatorTextColor:v,railColor:l,fillColor:i,railStyle:s,offsetDegree:this.offsetDegree,percentage:d,viewBoxWidth:C,strokeWidth:f,gapDegree:R===void 0?e==="dashboard"?75:0:R,gapOffsetDegree:O,unit:u},X(L),1032,["clsPrefix","status","showIndicator","indicatorTextColor","railColor","fillColor","railStyle","offsetDegree","percentage","viewBoxWidth","strokeWidth","gapDegree","gapOffsetDegree","unit"])):(o(),c(q,{key:1},[e==="line"?(o(),_(Re,{key:0,clsPrefix:w,status:g,showIndicator:x,indicatorTextColor:v,railColor:l,fillColor:i,railStyle:s,percentage:d,processing:r,indicatorPlacement:b,unit:u,fillBorderRadius:p,railBorderRadius:$,height:t},X(L),1032,["clsPrefix","status","showIndicator","indicatorTextColor","railColor","fillColor","railStyle","percentage","processing","indicatorPlacement","unit","fillBorderRadius","railBorderRadius","height"])):(o(),c(q,{key:1},[e==="multiple-circle"?(o(),_(Oe,{key:0,clsPrefix:w,strokeWidth:f,railColor:l,fillColor:i,railStyle:s,viewBoxWidth:C,percentage:d,showIndicator:x,circleGap:n},X(L),1032,["clsPrefix","strokeWidth","railColor","fillColor","railStyle","viewBoxWidth","percentage","showIndicator","circleGap"])):k(()=>null)],64))],64))],14,Le)}});const Ge={class:"page"},Ee={key:0,class:"err"},Ve={key:1,class:"muted"},Xe={key:2,class:"grid-2"},Ye=["onClick"],Fe={class:"task-main"},Ue={class:"hint"},He={class:"mono"},Je=M({__name:"EnvTasksView",setup(e){const m={pending:"待执行",running:"运行中",paused:"已暂停",done:"已完成",failed:"失败",cancelled:"已取消"},v=ae(),x=he(),g=ce(),l=G(!0),s=G(""),i=G([]),d=G("");let C;const f=N(()=>i.value.find(t=>t.id===d.value)||i.value[0]);async function b(){var t;try{const r=await Y("/v1/admin/env-tasks",{token:v.token});i.value=r.items||[],d.value&&!i.value.some(n=>n.id===d.value)&&(d.value=((t=i.value[0])==null?void 0:t.id)||""),!d.value&&i.value.length&&(d.value=i.value[0].id),s.value=""}catch(r){s.value=r instanceof Error?r.message:String(r)}finally{l.value=!1}}async function u(t,r){try{await Y(`/v1/admin/env-tasks/${encodeURIComponent(t)}/status`,{method:"POST",token:v.token,body:JSON.stringify({status:r})}),g.success(r==="cancelled"?"已取消":"已更新状态"),await b()}catch(n){g.error(n instanceof Error?n.message:String(n))}}async function $(t){try{await Y(`/v1/admin/env-tasks/${encodeURIComponent(t)}/remove`,{method:"POST",token:v.token,body:"{}"}),g.success("已删除"),d.value===t&&(d.value=""),await b()}catch(r){g.error(r instanceof Error?r.message:String(r))}}function p(t){return t.status==="pending"||t.status==="running"||t.status==="paused"}return de(()=>{b(),C=window.setInterval(()=>void b(),2500)}),ue(()=>{C&&window.clearInterval(C)}),(t,r)=>(o(),c("div",Ge,[r[14]||(r[14]=a("header",{class:"page-head"},[a("h1",null,"环境任务"),a("p",{class:"muted"},"安装进度与命令输出会刷在下方。排队或安装中可取消/删除。")],-1)),P(S(J),{style:{"margin-bottom":"12px"}},{default:z(()=>[P(S(W),{onClick:r[0]||(r[0]=n=>S(x).push("/env-setup"))},{default:z(()=>[...r[6]||(r[6]=[I("环境配置",-1)])]),_:1}),P(S(W),{onClick:b},{default:z(()=>[...r[7]||(r[7]=[I("刷新",-1)])]),_:1})]),_:1}),P(S(me),{show:l.value},{default:z(()=>[s.value?(o(),c("p",Ee,T(s.value),1)):i.value.length?(o(),c("div",Xe,[P(S(U),{title:"队列",size:"small"},{default:z(()=>[(o(!0),c(q,null,ge(i.value,n=>{var w;return o(),c("div",{key:n.id,class:fe(["task-row",{on:((w=f.value)==null?void 0:w.id)===n.id}]),onClick:R=>d.value=n.id},[a("div",Fe,[a("strong",null,T(n.runtime)+" "+T(n.version),1),a("p",Ue,T(n.mode)+" · "+T(n.id),1)]),a("div",{class:"task-actions",onClick:r[1]||(r[1]=pe(()=>{},["stop"]))},[P(S(ye),{size:"small"},{default:z(()=>[I(T(m[n.status]||n.status),1)]),_:2},1024),p(n)?(o(),_(S(W),{key:0,size:"tiny",quaternary:"",onClick:R=>u(n.id,"cancelled")},{default:z(()=>[...r[8]||(r[8]=[I(" 取消 ",-1)])]),_:1},8,["onClick"])):H("",!0),P(S(W),{size:"tiny",quaternary:"",type:"error",onClick:R=>$(n.id)},{default:z(()=>[...r[9]||(r[9]=[I(" 删除 ",-1)])]),_:1},8,["onClick"])])],10,Ye)}),128))]),_:1}),f.value?(o(),_(S(U),{key:0,title:"实时安装",size:"small"},{default:z(()=>[P(S(Ae),{type:"line",percentage:Math.round(f.value.progress||0)},null,8,["percentage"]),P(S(J),{style:{margin:"10px 0"}},{default:z(()=>[P(S(W),{size:"small",disabled:f.value.status!=="running",onClick:r[2]||(r[2]=n=>u(f.value.id,"paused"))},{default:z(()=>[...r[10]||(r[10]=[I(" 暂停 ",-1)])]),_:1},8,["disabled"]),P(S(W),{size:"small",disabled:f.value.status!=="paused"&&f.value.status!=="pending",onClick:r[3]||(r[3]=n=>u(f.value.id,"running"))},{default:z(()=>[...r[11]||(r[11]=[I(" 继续 ",-1)])]),_:1},8,["disabled"]),P(S(W),{size:"small",disabled:!p(f.value),onClick:r[4]||(r[4]=n=>u(f.value.id,"cancelled"))},{default:z(()=>[...r[12]||(r[12]=[I(" 取消 ",-1)])]),_:1},8,["disabled"]),P(S(W),{size:"small",type:"error",secondary:"",onClick:r[5]||(r[5]=n=>$(f.value.id))},{default:z(()=>[...r[13]||(r[13]=[I(" 删除 ",-1)])]),_:1})]),_:1}),a("pre",He,T((f.value.logs||[]).join(`
`)||"等待安装输出…"),1)]),_:1})):H("",!0)])):(o(),c("p",Ve,"暂无任务"))]),_:1},8,["show"])]))}}),tr=ve(Je,[["__scopeId","data-v-4e78941a"]]);export{tr as default};
