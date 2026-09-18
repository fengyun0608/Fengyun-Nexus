import{D as oe,d as L,i as t,c as n,b as a,S as w,T as u,R as C,F as W,y as $,Z as K,$ as Z,a0 as Q,a1 as ee,a2 as re,m as _,a3 as ie,a4 as j,G as A,H as h,K as I,P as te,a5 as X,V as se,W as le,X as Y,u as ne,n as ae,o as ce,a as de,e as P,f as B,g as S,r as G,h as F,B as M,j as q,t as D,Y as U,k as ue,s as ge,l as fe,v as pe,_ as he}from"./index-BufM0o0k.js";import{T as ve}from"./Tag-BrHMs3fR.js";import{S as H}from"./Space-B86mCga0.js";import{S as ye}from"./Spin-CLwSE2Sh.js";import"./use-compitable-lG_QD6CX.js";function me(e){const{infoColor:v,successColor:y,warningColor:x,errorColor:d,textColor2:s,progressRailColor:i,fontSize:l,fontWeight:g}=e;return{fontSize:l,fontSizeCircle:"28px",fontWeightCircle:g,railColor:i,railHeight:"8px",iconSizeCircle:"36px",iconSizeLine:"18px",iconColor:v,iconColorInfo:v,iconColorSuccess:y,iconColorWarning:x,iconColorError:d,textColorCircle:s,textColorLineInner:"rgb(255, 255, 255)",textColorLineOuter:s,fillColor:v,fillColorInfo:v,fillColorSuccess:y,fillColorWarning:x,fillColorError:d,lineBgProcessing:"linear-gradient(90deg, rgba(255, 255, 255, .3) 0%, rgba(255, 255, 255, .5) 100%)"}}const be={common:oe,self:me},xe=["id"],Ce=["stop-color"],$e=["stop-color"],ke=["viewBox"],Se=["d","stroke-width"],we=["d","stroke-width"],_e={success:(t(),$(re)),error:(t(),$(ee)),warning:(t(),$(Q)),info:(t(),$(Z))};var ze=L({name:"ProgressCircle",props:{clsPrefix:{type:String,required:!0},status:{type:String,required:!0},strokeWidth:{type:Number,required:!0},fillColor:[String,Object],railColor:String,railStyle:[String,Object],percentage:{type:Number,default:0},offsetDegree:{type:Number,default:0},showIndicator:{type:Boolean,required:!0},indicatorTextColor:String,unit:String,viewBoxWidth:{type:Number,required:!0},gapDegree:{type:Number,required:!0},gapOffsetDegree:{type:Number,default:0}},setup(e,{slots:v}){const y=_(()=>{const s="gradient",{fillColor:i}=e;return typeof i=="object"?`${s}-${ie(JSON.stringify(i))}`:s});function x(s,i,l,g){const{gapDegree:m,viewBoxWidth:f,strokeWidth:b}=e,c=50,p=0,o=c,r=0,z=100,R=50+b/2,k=`M ${R},${R} m ${p},${o}
      a ${c},${c} 0 1 1 ${r},-100
      a ${c},${c} 0 1 1 0,${z}`,N=Math.PI*2*c;return{pathString:k,pathStyle:{stroke:g==="rail"?l:typeof e.fillColor=="object"?`url(#${y.value})`:l,strokeDasharray:`${Math.min(s,100)/100*(N-m)}px ${f*8}px`,strokeDashoffset:`-${m/2}px`,transformOrigin:i?"center":void 0,transform:i?`rotate(${i}deg)`:void 0}}}const d=()=>{const s=typeof e.fillColor=="object",i=s?e.fillColor.stops[0]:"",l=s?e.fillColor.stops[1]:"";return s&&(t(),n("defs",null,[a("linearGradient",{id:y.value,x1:"0%",y1:"100%",x2:"100%",y2:"0%"},[a("stop",{offset:"0%","stop-color":i},null,8,Ce),a("stop",{offset:"100%","stop-color":l},null,8,$e)],8,xe)]))};return()=>{const{fillColor:s,railColor:i,strokeWidth:l,offsetDegree:g,status:m,percentage:f,showIndicator:b,indicatorTextColor:c,unit:p,gapOffsetDegree:o,clsPrefix:r}=e,{pathString:z,pathStyle:R}=x(100,0,i,"rail"),{pathString:k,pathStyle:N}=x(f,g,s,"fill"),T=100+l;return t(),n("div",{class:u(`${r}-progress-content`),role:"none"},[a("div",{class:u(`${r}-progress-graph`),"aria-hidden":!0},[a("div",{class:u(`${r}-progress-graph-circle`),style:w({transform:o?`rotate(${o}deg)`:void 0})},[(t(),n("svg",{viewBox:`0 0 ${T} ${T}`},[C(()=>d()),a("g",null,[a("path",{class:u(`${r}-progress-graph-circle-rail`),d:z,"stroke-width":l,"stroke-linecap":"round",fill:"none",style:w(R)},null,14,Se)]),a("g",null,[a("path",{class:u([`${r}-progress-graph-circle-fill`,f===0&&`${r}-progress-graph-circle-fill--empty`]),d:k,"stroke-width":l,"stroke-linecap":"round",fill:"none",style:w(N)},null,14,we)])],8,ke))],6)],2),b?(t(),n("div",{key:0},[v.default?(t(),n("div",{key:0,class:u(`${r}-progress-custom-content`),role:"none"},[C(()=>v.default())],2)):(t(),n(W,{key:1},[m!=="default"?(t(),n("div",{key:0,class:u(`${r}-progress-icon`),"aria-hidden":!0},[(t(),$(K,{clsPrefix:r},{default:()=>_e[m]},1032,["clsPrefix"]))],2)):(t(),n("div",{key:1,class:u(`${r}-progress-text`),style:w({color:c}),role:"none"},[a("span",{class:u(`${r}-progress-text__percentage`)},[C(()=>f)],2),a("span",{class:u(`${r}-progress-text__unit`)},[C(()=>p)],2)],6))],64))])):C(()=>null)],2)}}});const Pe={success:(t(),$(re)),error:(t(),$(ee)),warning:(t(),$(Q)),info:(t(),$(Z))};var Be=L({name:"ProgressLine",props:{clsPrefix:{type:String,required:!0},percentage:{type:Number,default:0},railColor:String,railStyle:[String,Object],fillColor:[String,Object],status:{type:String,required:!0},indicatorPlacement:{type:String,required:!0},indicatorTextColor:String,unit:{type:String,default:"%"},processing:{type:Boolean,required:!0},showIndicator:{type:Boolean,required:!0},height:[String,Number],railBorderRadius:[String,Number],fillBorderRadius:[String,Number]},setup(e,{slots:v}){const y=_(()=>j(e.height)),x=_(()=>{var i,l;return typeof e.fillColor=="object"?`linear-gradient(to right, ${(i=e.fillColor)==null?void 0:i.stops[0]} , ${(l=e.fillColor)==null?void 0:l.stops[1]})`:e.fillColor}),d=_(()=>e.railBorderRadius!==void 0?j(e.railBorderRadius):e.height!==void 0?j(e.height,{c:.5}):""),s=_(()=>e.fillBorderRadius!==void 0?j(e.fillBorderRadius):e.railBorderRadius!==void 0?j(e.railBorderRadius):e.height!==void 0?j(e.height,{c:.5}):"");return()=>{const{indicatorPlacement:i,railColor:l,railStyle:g,percentage:m,unit:f,indicatorTextColor:b,status:c,showIndicator:p,processing:o,clsPrefix:r}=e;return t(),n("div",{class:u(`${r}-progress-content`),role:"none"},[a("div",{class:u(`${r}-progress-graph`),"aria-hidden":!0},[a("div",{class:u([`${r}-progress-graph-line`,{[`${r}-progress-graph-line--indicator-${i}`]:!0}])},[a("div",{class:u(`${r}-progress-graph-line-rail`),style:w([{backgroundColor:l,height:y.value,borderRadius:d.value},g])},[a("div",{class:u([`${r}-progress-graph-line-fill`,o&&`${r}-progress-graph-line-fill--processing`]),style:w({maxWidth:`${e.percentage}%`,background:x.value,height:y.value,lineHeight:y.value,borderRadius:s.value})},[i==="inside"?(t(),n("div",{key:0,class:u(`${r}-progress-graph-line-indicator`),style:w({color:b})},[v.default?(t(),n(W,{key:0},[C(()=>v.default())],64)):(t(),n(W,{key:1},[C(()=>`${m}${f}`)],64))],6)):C(()=>null)],6)],6)],2)],2),p&&i==="outside"?(t(),n("div",{key:0},[v.default?(t(),n("div",{key:0,class:u(`${r}-progress-custom-content`),style:w({color:b}),role:"none"},[C(()=>v.default())],6)):(t(),n(W,{key:1},[c==="default"?(t(),n("div",{key:0,role:"none",class:u(`${r}-progress-icon ${r}-progress-icon--as-text`),style:w({color:b})},[C(()=>m),C(()=>f)],6)):(t(),n("div",{key:1,class:u(`${r}-progress-icon`),"aria-hidden":!0},[(t(),$(K,{clsPrefix:r},{default:()=>Pe[c]},1032,["clsPrefix"]))],2))],64))])):C(()=>null)],2)}}});const Re=["id"],Ne=["stop-color"],Ie=["stop-color"],De=["d","stroke-width"],We=["d","stroke-width"],Te=["viewBox"];function J(e,v,y=100){return`m ${y/2} ${y/2-e} a ${e} ${e} 0 1 1 0 ${2*e} a ${e} ${e} 0 1 1 0 -${2*e}`}var je=L({name:"ProgressMultipleCircle",props:{clsPrefix:{type:String,required:!0},viewBoxWidth:{type:Number,required:!0},percentage:{type:Array,default:[0]},strokeWidth:{type:Number,required:!0},circleGap:{type:Number,required:!0},showIndicator:{type:Boolean,required:!0},fillColor:{type:Array,default:()=>[]},railColor:{type:Array,default:()=>[]},railStyle:{type:Array,default:()=>[]}},setup(e,{slots:v}){const y=_(()=>e.percentage.map((d,s)=>`${Math.PI*d/100*(e.viewBoxWidth/2-e.strokeWidth/2*(1+2*s)-e.circleGap*s)*2}, ${e.viewBoxWidth*8}`)),x=(d,s)=>{const i=e.fillColor[s],l=typeof i=="object"?i.stops[0]:"",g=typeof i=="object"?i.stops[1]:"";return typeof e.fillColor[s]=="object"&&(t(),n("linearGradient",{id:`gradient-${s}`,x1:"100%",y1:"0%",x2:"0%",y2:"100%"},[a("stop",{offset:"0%","stop-color":l},null,8,Ne),a("stop",{offset:"100%","stop-color":g},null,8,Ie)],8,Re))};return()=>{const{viewBoxWidth:d,strokeWidth:s,circleGap:i,showIndicator:l,fillColor:g,railColor:m,railStyle:f,percentage:b,clsPrefix:c}=e;return t(),n("div",{class:u(`${c}-progress-content`),role:"none"},[a("div",{class:u(`${c}-progress-graph`),"aria-hidden":!0},[a("div",{class:u(`${c}-progress-graph-circle`)},[(t(),n("svg",{viewBox:`0 0 ${d} ${d}`},[a("defs",null,[C(()=>b.map((p,o)=>x(p,o)))]),C(()=>b.map((p,o)=>(t(),n("g",{key:o},[a("path",{class:u(`${c}-progress-graph-circle-rail`),d:J(d/2-s/2*(1+2*o)-i*o,s,d),"stroke-width":s,"stroke-linecap":"round",fill:"none",style:w([{strokeDashoffset:0,stroke:m[o]},f[o]])},null,14,De),a("path",{class:u([`${c}-progress-graph-circle-fill`,p===0&&`${c}-progress-graph-circle-fill--empty`]),d:J(d/2-s/2*(1+2*o)-i*o,s,d),"stroke-width":s,"stroke-linecap":"round",fill:"none",style:w({strokeDasharray:y.value[o],strokeDashoffset:0,stroke:typeof g[o]=="object"?`url(#gradient-${o})`:g[o]})},null,14,We)]))))],8,Te))],2)],2),l&&v.default?(t(),n("div",{key:0},[a("div",{class:u(`${c}-progress-text`)},[C(()=>v.default())],2)])):C(()=>null)],2)}}}),Oe=A([h("progress",{display:"inline-block"},[h("progress-icon",`
 color: var(--n-icon-color);
 transition: color .3s var(--n-bezier);
 `),I("line",`
 width: 100%;
 display: block;
 `,[h("progress-content",`
 display: flex;
 align-items: center;
 `,[h("progress-graph",{flex:1})]),h("progress-custom-content",{marginLeft:"14px"}),h("progress-icon",`
 width: 30px;
 padding-left: 14px;
 height: var(--n-icon-size-line);
 line-height: var(--n-icon-size-line);
 font-size: var(--n-icon-size-line);
 `,[I("as-text",`
 color: var(--n-text-color-line-outer);
 text-align: center;
 width: 40px;
 font-size: var(--n-font-size);
 padding-left: 4px;
 transition: color .3s var(--n-bezier);
 `)])]),I("circle, dashboard",{width:"120px"},[h("progress-custom-content",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 justify-content: center;
 `),h("progress-text",`
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
 `),h("progress-icon",`
 position: absolute;
 left: 50%;
 top: 50%;
 transform: translateX(-50%) translateY(-50%);
 display: flex;
 align-items: center;
 color: var(--n-icon-color);
 font-size: var(--n-icon-size-circle);
 `)]),I("multiple-circle",`
 width: 200px;
 color: inherit;
 `,[h("progress-text",`
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
 `)]),h("progress-content",{position:"relative"}),h("progress-graph",{position:"relative"},[h("progress-graph-circle",[A("svg",{verticalAlign:"bottom"}),h("progress-graph-circle-fill",`
 stroke: var(--n-fill-color);
 transition:
 opacity .3s var(--n-bezier),
 stroke .3s var(--n-bezier),
 stroke-dasharray .3s var(--n-bezier);
 `,[I("empty",{opacity:0})]),h("progress-graph-circle-rail",`
 transition: stroke .3s var(--n-bezier);
 overflow: hidden;
 stroke: var(--n-rail-color);
 `)]),h("progress-graph-line",[I("indicator-inside",[h("progress-graph-line-rail",`
 height: 16px;
 line-height: 16px;
 border-radius: 10px;
 `,[h("progress-graph-line-fill",`
 height: inherit;
 border-radius: 10px;
 `),h("progress-graph-line-indicator",`
 background: #0000;
 white-space: nowrap;
 text-align: right;
 margin-left: 14px;
 margin-right: 14px;
 height: inherit;
 font-size: 12px;
 color: var(--n-text-color-line-inner);
 transition: color .3s var(--n-bezier);
 `)])]),I("indicator-inside-label",`
 height: 16px;
 display: flex;
 align-items: center;
 `,[h("progress-graph-line-rail",`
 flex: 1;
 transition: background-color .3s var(--n-bezier);
 `),h("progress-graph-line-indicator",`
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
 `)]),h("progress-graph-line-rail",`
 position: relative;
 overflow: hidden;
 height: var(--n-rail-height);
 border-radius: 5px;
 background-color: var(--n-rail-color);
 transition: background-color .3s var(--n-bezier);
 `,[h("progress-graph-line-fill",`
 background: var(--n-fill-color);
 position: relative;
 border-radius: 5px;
 height: inherit;
 width: 100%;
 max-width: 0%;
 transition:
 background-color .3s var(--n-bezier),
 max-width .2s var(--n-bezier);
 `,[I("processing",[A("&::after",`
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
 `)]);const qe=["aria-valuenow","role"],Le={...te.props,processing:Boolean,type:{type:String,default:"line"},gapDegree:Number,gapOffsetDegree:Number,status:{type:String,default:"default"},railColor:[String,Array],railStyle:[String,Array],color:[String,Array,Object],viewBoxWidth:{type:Number,default:100},strokeWidth:{type:Number,default:7},percentage:[Number,Array],unit:{type:String,default:"%"},showIndicator:{type:Boolean,default:!0},indicatorPosition:{type:String,default:"outside"},indicatorPlacement:{type:String,default:"outside"},indicatorTextColor:String,circleGap:{type:Number,default:1},height:Number,borderRadius:[String,Number],fillBorderRadius:[String,Number],offsetDegree:Number};var Ae=L({name:"Progress",props:Le,setup(e){const v=_(()=>e.indicatorPlacement||e.indicatorPosition),y=_(()=>{if(e.gapDegree||e.gapDegree===0)return e.gapDegree;if(e.type==="dashboard")return 75}),{mergedClsPrefixRef:x,inlineThemeDisabled:d}=se(e),s=te("Progress","-progress",Oe,be,e,x),i=_(()=>{const{status:g}=e,{common:{cubicBezierEaseInOut:m},self:{fontSize:f,fontSizeCircle:b,railColor:c,railHeight:p,iconSizeCircle:o,iconSizeLine:r,textColorCircle:z,textColorLineInner:R,textColorLineOuter:k,lineBgProcessing:N,fontWeightCircle:T,[Y("iconColor",g)]:V,[Y("fillColor",g)]:O}}=s.value;return{"--n-bezier":m,"--n-fill-color":O,"--n-font-size":f,"--n-font-size-circle":b,"--n-font-weight-circle":T,"--n-icon-color":V,"--n-icon-size-circle":o,"--n-icon-size-line":r,"--n-line-bg-processing":N,"--n-rail-color":c,"--n-rail-height":p,"--n-text-color-circle":z,"--n-text-color-line-inner":R,"--n-text-color-line-outer":k}}),l=d?le("progress",_(()=>e.status[0]),i,e):void 0;return{mergedClsPrefix:x,mergedIndicatorPlacement:v,gapDeg:y,cssVars:d?void 0:i,themeClass:l==null?void 0:l.themeClass,onRender:l==null?void 0:l.onRender}},render(){const{type:e,cssVars:v,indicatorTextColor:y,showIndicator:x,status:d,railColor:s,railStyle:i,color:l,percentage:g,viewBoxWidth:m,strokeWidth:f,mergedIndicatorPlacement:b,unit:c,borderRadius:p,fillBorderRadius:o,height:r,processing:z,circleGap:R,mergedClsPrefix:k,gapDeg:N,gapOffsetDegree:T,themeClass:V,$slots:O,onRender:E}=this;return E==null||E(),t(),n("div",{class:u([V,`${k}-progress`,`${k}-progress--${e}`,`${k}-progress--${d}`]),style:w(v),"aria-valuemax":100,"aria-valuemin":0,"aria-valuenow":g,role:e==="circle"||e==="line"||e==="dashboard"?"progressbar":"none"},[e==="circle"||e==="dashboard"?(t(),$(ze,{key:0,clsPrefix:k,status:d,showIndicator:x,indicatorTextColor:y,railColor:s,fillColor:l,railStyle:i,offsetDegree:this.offsetDegree,percentage:g,viewBoxWidth:m,strokeWidth:f,gapDegree:N===void 0?e==="dashboard"?75:0:N,gapOffsetDegree:T,unit:c},X(O),1032,["clsPrefix","status","showIndicator","indicatorTextColor","railColor","fillColor","railStyle","offsetDegree","percentage","viewBoxWidth","strokeWidth","gapDegree","gapOffsetDegree","unit"])):(t(),n(W,{key:1},[e==="line"?(t(),$(Be,{key:0,clsPrefix:k,status:d,showIndicator:x,indicatorTextColor:y,railColor:s,fillColor:l,railStyle:i,percentage:g,processing:z,indicatorPlacement:b,unit:c,fillBorderRadius:o,railBorderRadius:p,height:r},X(O),1032,["clsPrefix","status","showIndicator","indicatorTextColor","railColor","fillColor","railStyle","percentage","processing","indicatorPlacement","unit","fillBorderRadius","railBorderRadius","height"])):(t(),n(W,{key:1},[e==="multiple-circle"?(t(),$(je,{key:0,clsPrefix:k,strokeWidth:f,railColor:s,fillColor:l,railStyle:i,viewBoxWidth:m,percentage:g,showIndicator:x,circleGap:R},X(O),1032,["clsPrefix","strokeWidth","railColor","fillColor","railStyle","viewBoxWidth","percentage","showIndicator","circleGap"])):C(()=>null)],64))],64))],14,qe)}});const Ge={class:"page"},Me={key:0,class:"err"},Ve={key:1,class:"muted"},Ee={key:2,class:"grid-2"},Xe=["onClick"],Ye={class:"hint"},Fe={class:"mono"},Ue=L({__name:"EnvTasksView",setup(e){const v={pending:"待执行",running:"运行中",paused:"已暂停",done:"已完成",failed:"失败"},y=ne(),x=pe(),d=ae(),s=G(!0),i=G(""),l=G([]),g=G("");let m;const f=_(()=>l.value.find(p=>p.id===g.value)||l.value[0]);async function b(){try{const p=await F("/v1/admin/env-tasks",{token:y.token});l.value=p.items||[],!g.value&&l.value.length&&(g.value=l.value[0].id),i.value=""}catch(p){i.value=p instanceof Error?p.message:String(p)}finally{s.value=!1}}async function c(p,o){try{await F(`/v1/admin/env-tasks/${encodeURIComponent(p)}/status`,{method:"POST",token:y.token,body:JSON.stringify({status:o})}),d.success("已更新状态"),await b()}catch(r){d.error(r instanceof Error?r.message:String(r))}}return ce(()=>{b(),m=window.setInterval(()=>void b(),2500)}),de(()=>{m&&window.clearInterval(m)}),(p,o)=>(t(),n("div",Ge,[o[7]||(o[7]=a("header",{class:"page-head"},[a("h1",null,"环境任务"),a("p",{class:"muted"},"安装进度与命令输出会刷在下方。")],-1)),P(S(H),{style:{"margin-bottom":"12px"}},{default:B(()=>[P(S(M),{onClick:o[0]||(o[0]=r=>S(x).push("/env-setup"))},{default:B(()=>[...o[3]||(o[3]=[q("环境配置",-1)])]),_:1}),P(S(M),{onClick:b},{default:B(()=>[...o[4]||(o[4]=[q("刷新",-1)])]),_:1})]),_:1}),P(S(ye),{show:s.value},{default:B(()=>[i.value?(t(),n("p",Me,D(i.value),1)):l.value.length?(t(),n("div",Ee,[P(S(U),{title:"队列",size:"small"},{default:B(()=>[(t(!0),n(W,null,ue(l.value,r=>{var z;return t(),n("div",{key:r.id,class:ge(["task-row",{on:((z=f.value)==null?void 0:z.id)===r.id}]),onClick:R=>g.value=r.id},[a("div",null,[a("strong",null,D(r.runtime)+" "+D(r.version),1),a("p",Ye,D(r.mode)+" · "+D(r.id),1)]),P(S(ve),{size:"small"},{default:B(()=>[q(D(v[r.status]||r.status),1)]),_:2},1024)],10,Xe)}),128))]),_:1}),f.value?(t(),$(S(U),{key:0,title:"实时安装",size:"small"},{default:B(()=>[P(S(Ae),{type:"line",percentage:Math.round(f.value.progress||0)},null,8,["percentage"]),P(S(H),{style:{margin:"10px 0"}},{default:B(()=>[P(S(M),{size:"small",disabled:f.value.status!=="running",onClick:o[1]||(o[1]=r=>c(f.value.id,"paused"))},{default:B(()=>[...o[5]||(o[5]=[q(" 暂停 ",-1)])]),_:1},8,["disabled"]),P(S(M),{size:"small",disabled:f.value.status!=="paused"&&f.value.status!=="pending",onClick:o[2]||(o[2]=r=>c(f.value.id,"running"))},{default:B(()=>[...o[6]||(o[6]=[q(" 继续 ",-1)])]),_:1},8,["disabled"])]),_:1}),a("pre",Fe,D((f.value.logs||[]).join(`
`)||"等待安装输出…"),1)]),_:1})):fe("",!0)])):(t(),n("p",Ve,"暂无任务"))]),_:1},8,["show"])]))}}),er=he(Ue,[["__scopeId","data-v-3b93e9ec"]]);export{er as default};
