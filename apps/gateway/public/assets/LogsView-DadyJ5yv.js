import{T as Ve}from"./Tag-CTmP00t9.js";import{c7 as qt,bC as xe,bl as Yt,d as ae,aH as Kt,bR as Zt,r as $,ap as nt,b as j,av as Jt,h as i,c as f,O as x,U as ne,Q as k,aq as ot,bg as Qt,S as ye,F as H,s as W,a9 as it,aP as ea,bf as ta,x as de,aA as aa,E as r,J as C,K as l,G as L,L as ra,B as st,M as lt,a5 as ke,P as Ne,ag as De,bS as ze,V as na,at as oa,X as ia,v as ce,o as dt,aF as sa,Y as la,bZ as da,b1 as ca,b2 as ba,c8 as fa,c9 as ua,q as be,$ as q,c1 as ge,aw as pa,a2 as Y,Z as me,u as va,a8 as ha,e as Q,w as K,f as Z,a as Ue,i as $e,t as ee,C as Xe,k as Ge,j as qe,_ as ga}from"./index-DWf2TY1V.js";import{S as ma}from"./Space-Cg922bFz.js";import{u as Ye,S as xa}from"./Spin-DmjWF8p4.js";import{C as ya}from"./ChevronRight-CRiNr55k.js";import{c as wa,a as Ke,o as Ca}from"./cssr-CYxKhJMa.js";var Sa=/\s/;function Ta(e){for(var n=e.length;n--&&Sa.test(e.charAt(n)););return n}var Ra=/^\s+/;function ka(e){return e&&e.slice(0,Ta(e)+1).replace(Ra,"")}var Ze=NaN,za=/^[-+]0x[0-9a-f]+$/i,$a=/^0b[01]+$/i,_a=/^0o[0-7]+$/i,Pa=parseInt;function Je(e){if(typeof e=="number")return e;if(qt(e))return Ze;if(xe(e)){var n=typeof e.valueOf=="function"?e.valueOf():e;e=xe(n)?n+"":n}if(typeof e!="string")return e===0?e:+e;e=ka(e);var s=$a.test(e);return s||_a.test(e)?Pa(e.slice(2),s?2:8):za.test(e)?Ze:+e}var _e=function(){return Yt.Date.now()},Ba="Expected a function",La=Math.max,Wa=Math.min;function Aa(e,n,s){var p,c,y,u,b,h,v=0,S=!1,m=!1,P=!0;if(typeof e!="function")throw new TypeError(Ba);n=Je(n)||0,xe(s)&&(S=!!s.leading,m="maxWait"in s,y=m?La(Je(s.maxWait)||0,n):y,P="trailing"in s?!!s.trailing:P);function F(g){var B=p,U=c;return p=c=void 0,v=g,u=e.apply(U,B),u}function A(g){return v=g,b=setTimeout(E,n),S?F(g):u}function _(g){var B=g-h,U=g-v,M=n-B;return m?Wa(M,y-U):M}function N(g){var B=g-h,U=g-v;return h===void 0||B>=n||B<0||m&&U>=y}function E(){var g=_e();if(N(g))return J(g);b=setTimeout(E,_(g))}function J(g){return b=void 0,P&&p?F(g):(p=c=void 0,u)}function re(){b!==void 0&&clearTimeout(b),v=0,p=h=c=b=void 0}function G(){return b===void 0?u:J(_e())}function D(){var g=_e(),B=N(g);if(p=arguments,c=this,h=g,B){if(b===void 0)return A(h);if(m)return clearTimeout(b),b=setTimeout(E,n),F(h)}return b===void 0&&(b=setTimeout(E,n)),u}return D.cancel=re,D.flush=G,D}var Ea="Expected a function";function Ia(e,n,s){var p=!0,c=!0;if(typeof e!="function")throw new TypeError(Ea);return xe(s)&&(p="leading"in s?!!s.leading:p,c="trailing"in s?!!s.trailing:c),Aa(e,n,{leading:p,maxWait:n,trailing:c})}const Oa=Ke(".v-x-scroll",{overflow:"auto",scrollbarWidth:"none"},[Ke("&::-webkit-scrollbar",{width:0,height:0})]),ja=ae({name:"XScroll",props:{disabled:Boolean,onScroll:Function},setup(){const e=$(null);function n(c){!(c.currentTarget.offsetWidth<c.currentTarget.scrollWidth)||c.deltaY===0||(c.currentTarget.scrollLeft+=c.deltaY+c.deltaX,c.preventDefault())}const s=Zt();return Oa.mount({id:"vueuc/x-scroll",head:!0,anchorMetaName:wa,ssr:s}),Object.assign({selfRef:e,handleWheel:n},{scrollTo(...c){var y;(y=e.value)===null||y===void 0||y.scrollTo(...c)}})},render(){return Kt("div",{ref:"selfRef",onScroll:this.onScroll,onWheel:this.disabled?void 0:this.handleWheel,class:"v-x-scroll"},this.$slots)}});var Ha=ae({name:"ChevronLeft",render(){return(()=>{const e=nt("dfe229c2639b2082");return e[0]||(e[0]=j("svg",{viewBox:"0 0 16 16",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[j("path",{d:"M10.3536 3.14645C10.5488 3.34171 10.5488 3.65829 10.3536 3.85355L6.20711 8L10.3536 12.1464C10.5488 12.3417 10.5488 12.6583 10.3536 12.8536C10.1583 13.0488 9.84171 13.0488 9.64645 12.8536L5.14645 8.35355C4.95118 8.15829 4.95118 7.84171 5.14645 7.64645L9.64645 3.14645C9.84171 2.95118 10.1583 2.95118 10.3536 3.14645Z",fill:"currentColor"})],-1))})()}}),Fa=ae({name:"Add",render(){return(()=>{const e=nt("b30130fbba5c5b23");return e[0]||(e[0]=j("svg",{width:"512",height:"512",viewBox:"0 0 512 512",fill:"none",xmlns:"http://www.w3.org/2000/svg"},[j("path",{d:"M256 112V400M400 256H112",stroke:"currentColor","stroke-width":"32","stroke-linecap":"round","stroke-linejoin":"round"})],-1))})()}});const We=Jt("n-tabs"),ct={tab:[String,Number,Object,Function],name:{type:[String,Number],required:!0},disabled:Boolean,displayDirective:{type:String,default:"if"},closable:{type:Boolean,default:void 0},tabProps:Object,label:[String,Number,Object,Function]};var Qe=ae({__TAB_PANE__:!0,name:"TabPane",alias:["TabPanel"],props:ct,slots:Object,setup(e){const n=ot(We,null);return n||Qt("tab-pane","`n-tab-pane` must be placed inside `n-tabs`."),{style:n.paneStyleRef,class:n.paneClassRef,mergedClsPrefix:n.mergedClsPrefixRef}},render(){return i(),f("div",{class:k([`${this.mergedClsPrefix}-tab-pane`,this.class]),style:ne(this.style)},[x(()=>{var e,n;return(n=(e=this.$slots).default)==null?void 0:n.call(e)})],6)}});const Ma=["data-name","data-disabled"],Va={internalLeftPadded:Boolean,internalAddable:Boolean,internalCreatedByPane:Boolean,...aa(ct,["displayDirective"])};var Le=ae({__TAB__:!0,inheritAttrs:!1,name:"Tab",props:Va,setup(e){const{mergedClsPrefixRef:n,valueRef:s,typeRef:p,closableRef:c,tabStyleRef:y,addTabStyleRef:u,tabClassRef:b,addTabClassRef:h,tabChangeIdRef:v,onBeforeLeaveRef:S,triggerRef:m,handleAdd:P,activateTab:F,handleClose:A}=ot(We);return{trigger:m,mergedClosable:de(()=>{if(e.internalAddable)return!1;const{closable:_}=e;return _===void 0?c.value:_}),style:y,addStyle:u,tabClass:b,addTabClass:h,clsPrefix:n,value:s,type:p,handleClose(_){_.stopPropagation(),!e.disabled&&A(e.name)},activateTab(){if(e.disabled)return;if(e.internalAddable){P();return}const{name:_}=e,N=++v.id;if(_!==s.value){const{value:E}=S;E?Promise.resolve(E(e.name,s.value)).then(J=>{J&&v.id===N&&F(_)}):F(_)}}}},render(){const{internalAddable:e,clsPrefix:n,name:s,disabled:p,label:c,tab:y,value:u,mergedClosable:b,trigger:h,$slots:{default:v}}=this,S=c??y;return i(),f("div",{class:k(`${n}-tabs-tab-wrapper`)},[this.internalLeftPadded?(i(),f("div",{key:0,class:k(`${n}-tabs-tab-pad`)},null,2)):x(()=>null),(i(),f("div",ye({key:s,"data-name":s,"data-disabled":p?!0:void 0},ye({class:[`${n}-tabs-tab`,u===s&&`${n}-tabs-tab--active`,p&&`${n}-tabs-tab--disabled`,b&&`${n}-tabs-tab--closable`,e&&`${n}-tabs-tab--addable`,e?this.addTabClass:this.tabClass],onClick:h==="click"?this.activateTab:void 0,onMouseenter:h==="hover"?this.activateTab:void 0,style:e?this.addStyle:this.style},this.internalCreatedByPane?this.tabProps||{}:this.$attrs)),[j("span",{class:k(`${n}-tabs-tab__label`)},[e?(i(),f(H,{key:0},[j("div",{class:k(`${n}-tabs-tab__height-placeholder`)}," ",2),(i(),W(it,{clsPrefix:n},{default:()=>(i(),W(Fa))},1032,["clsPrefix"]))],64)):(i(),f(H,{key:1},[v?(i(),f(H,{key:0},[x(()=>v())],64)):(i(),f(H,{key:1},[typeof S=="object"?(i(),f(H,{key:0},[x(()=>S)],64)):(i(),f(H,{key:1},[x(()=>ea(S??s))],64))],64))],64))],2),b&&this.type==="card"?(i(),W(ta,{key:0,clsPrefix:n,class:k(`${n}-tabs-tab__close`),onClick:this.handleClose,disabled:p},null,8,["clsPrefix","class","onClick","disabled"])):x(()=>null)],16,Ma))],2)}}),Na=r("tabs",`
 box-sizing: border-box;
 width: 100%;
 display: flex;
 flex-direction: column;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
`,[C("&.transition-disabled",[r("tabs-tab",`
 transition: none !important;
 `),r("tabs-nav-scroll-content",`
 transition: none !important;
 `),r("tabs-tab-pad",`
 transition: none !important;
 `)]),l("segment-type",[r("tabs-rail",[C("&.transition-disabled",[r("tabs-capsule",`
 transition: none;
 `)])])]),l("top",[r("tab-pane",`
 padding: var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left);
 `)]),l("left",[r("tab-pane",`
 padding: var(--n-pane-padding-right) var(--n-pane-padding-bottom) var(--n-pane-padding-left) var(--n-pane-padding-top);
 `)]),l("left, right",`
 flex-direction: row;
 `,[r("tabs-bar",`
 width: 2px;
 right: 0;
 transition:
 top .2s var(--n-bezier),
 max-height .2s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `),r("tabs-tab",`
 padding: var(--n-tab-padding-vertical); 
 `)]),l("right",`
 flex-direction: row-reverse;
 `,[r("tab-pane",`
 padding: var(--n-pane-padding-left) var(--n-pane-padding-top) var(--n-pane-padding-right) var(--n-pane-padding-bottom);
 `),r("tabs-bar",`
 left: 0;
 `)]),l("bottom",`
 flex-direction: column-reverse;
 justify-content: flex-end;
 `,[r("tab-pane",`
 padding: var(--n-pane-padding-bottom) var(--n-pane-padding-right) var(--n-pane-padding-top) var(--n-pane-padding-left);
 `),r("tabs-bar",`
 top: 0;
 `)]),r("tabs-rail",`
 position: relative;
 padding: 3px;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 background-color: var(--n-color-segment);
 transition: background-color .3s var(--n-bezier);
 display: flex;
 align-items: center;
 `,[r("tabs-capsule",`
 border-radius: var(--n-tab-border-radius);
 position: absolute;
 left: 0;
 top: 0;
 pointer-events: none;
 background-color: var(--n-tab-color-segment);
 box-shadow: 0 1px 3px 0 rgba(0, 0, 0, .08);
 transition: transform 0.3s var(--n-bezier);
 `),r("tabs-tab-wrapper",`
 flex-basis: 0;
 flex-grow: 1;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[r("tabs-tab",`
 overflow: hidden;
 border-radius: var(--n-tab-border-radius);
 width: 100%;
 display: flex;
 align-items: center;
 justify-content: center;
 `,[l("active",`
 font-weight: var(--n-font-weight-strong);
 color: var(--n-tab-text-color-active);
 `),C("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])])]),l("flex",[r("tabs-nav",`
 width: 100%;
 position: relative;
 `,[r("tabs-wrapper",`
 width: 100%;
 `,[r("tabs-tab",`
 margin-right: 0;
 `)])])]),r("tabs-nav",`
 box-sizing: border-box;
 line-height: 1.5;
 display: flex;
 transition: border-color .3s var(--n-bezier);
 `,[L("prefix, suffix",`
 display: flex;
 align-items: center;
 `),L("prefix","padding-right: 16px;"),L("suffix","padding-left: 16px;")]),l("top, bottom",[C(">",[r("tabs-nav",[r("tabs-nav-scroll-wrapper",[C("&::before",`
 top: 0;
 bottom: 0;
 left: 0;
 width: 20px;
 `),C("&::after",`
 top: 0;
 bottom: 0;
 right: 0;
 width: 20px;
 `),l("shadow-start",[C("&::before",`
 box-shadow: inset 10px 0 8px -8px rgba(0, 0, 0, .12);
 `)]),l("shadow-end",[C("&::after",`
 box-shadow: inset -10px 0 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),l("left, right",[r("tabs-nav-scroll-content",`
 flex-direction: column;
 `),C(">",[r("tabs-nav",[r("tabs-nav-scroll-wrapper",[C("&::before",`
 top: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),C("&::after",`
 bottom: 0;
 left: 0;
 right: 0;
 height: 20px;
 `),l("shadow-start",[C("&::before",`
 box-shadow: inset 0 10px 8px -8px rgba(0, 0, 0, .12);
 `)]),l("shadow-end",[C("&::after",`
 box-shadow: inset 0 -10px 8px -8px rgba(0, 0, 0, .12);
 `)])])])])]),r("tabs-nav-scroll-wrapper",`
 flex: 1;
 position: relative;
 overflow: hidden;
 `,[r("tabs-nav-y-scroll",`
 height: 100%;
 width: 100%;
 overflow-y: auto; 
 scrollbar-width: none;
 `,[C("&::-webkit-scrollbar, &::-webkit-scrollbar-track-piece, &::-webkit-scrollbar-thumb",`
 width: 0;
 height: 0;
 display: none;
 `)]),C("&::before, &::after",`
 transition: box-shadow .3s var(--n-bezier);
 pointer-events: none;
 content: "";
 position: absolute;
 z-index: 1;
 `),C("&.transition-disabled",[C("&::before, &::after",`
 transition: none;
 `)])]),r("tabs-nav-scroll-content",`
 display: flex;
 position: relative;
 min-width: 100%;
 min-height: 100%;
 width: fit-content;
 box-sizing: border-box;
 `),r("tabs-wrapper",`
 display: inline-flex;
 flex-wrap: nowrap;
 position: relative;
 `),r("tabs-tab-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 flex-shrink: 0;
 flex-grow: 0;
 `),r("tabs-tab",`
 cursor: pointer;
 white-space: nowrap;
 flex-wrap: nowrap;
 display: inline-flex;
 align-items: center;
 color: var(--n-tab-text-color);
 font-size: var(--n-tab-font-size);
 background-clip: padding-box;
 padding: var(--n-tab-padding);
 transition:
 box-shadow .3s var(--n-bezier),
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[l("disabled",{cursor:"not-allowed"}),L("close",`
 margin-inline-start: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),L("label",`
 display: flex;
 align-items: center;
 z-index: 1;
 `)]),r("tabs-bar",`
 position: absolute;
 bottom: 0;
 height: 2px;
 border-radius: 1px;
 background-color: var(--n-bar-color);
 transition:
 left .2s var(--n-bezier),
 max-width .2s var(--n-bezier),
 opacity .3s var(--n-bezier),
 background-color .3s var(--n-bezier);
 `,[C("&.transition-disabled",`
 transition: none;
 `),l("disabled",`
 background-color: var(--n-tab-text-color-disabled)
 `)]),r("tabs-pane-wrapper",`
 position: relative;
 overflow: hidden;
 transition: max-height .2s var(--n-bezier);
 `),r("tab-pane",`
 color: var(--n-pane-text-color);
 width: 100%;
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 opacity .2s var(--n-bezier);
 left: 0;
 right: 0;
 top: 0;
 `,[C("&.next-transition-leave-active, &.prev-transition-leave-active, &.next-transition-enter-active, &.prev-transition-enter-active",`
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 transform .2s var(--n-bezier),
 opacity .2s var(--n-bezier);
 `),C("&.next-transition-leave-active, &.prev-transition-leave-active",`
 position: absolute;
 `),C("&.next-transition-enter-from, &.prev-transition-leave-to",`
 transform: translateX(32px);
 opacity: 0;
 `),C("&.next-transition-leave-to, &.prev-transition-enter-from",`
 transform: translateX(-32px);
 opacity: 0;
 `),C("&.next-transition-leave-from, &.next-transition-enter-to, &.prev-transition-leave-from, &.prev-transition-enter-to",`
 transform: translateX(0);
 opacity: 1;
 `)]),r("tabs-tab-pad",`
 box-sizing: border-box;
 width: var(--n-tab-gap);
 flex-grow: 0;
 flex-shrink: 0;
 `),l("line-type, bar-type",[r("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 box-sizing: border-box;
 vertical-align: bottom;
 `,[C("&:hover",{color:"var(--n-tab-text-color-hover)"}),l("active",`
 color: var(--n-tab-text-color-active);
 font-weight: var(--n-tab-font-weight-active);
 `),l("disabled",{color:"var(--n-tab-text-color-disabled)"})])]),r("tabs-nav",[L("prefix, suffix",`
 border-color: var(--n-tab-border-color);
 `),r("tabs-nav-scroll-content",`
 border-color: var(--n-tab-border-color);
 `),l("line-type",[l("top",[L("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),r("tabs-nav-scroll-content",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),r("tabs-bar",`
 bottom: -1px;
 `)]),l("left",[L("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),r("tabs-nav-scroll-content",`
 border-right: 1px solid var(--n-tab-border-color);
 `),r("tabs-bar",`
 right: -1px;
 `)]),l("right",[L("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),r("tabs-nav-scroll-content",`
 border-left: 1px solid var(--n-tab-border-color);
 `),r("tabs-bar",`
 left: -1px;
 `)]),l("bottom",[L("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),r("tabs-nav-scroll-content",`
 border-top: 1px solid var(--n-tab-border-color);
 `),r("tabs-bar",`
 top: -1px;
 `)]),L("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),r("tabs-nav-scroll-content",`
 transition: border-color .3s var(--n-bezier);
 `),r("tabs-bar",`
 border-radius: 0;
 `)]),l("card-type",[L("prefix, suffix",`
 transition: border-color .3s var(--n-bezier);
 `),r("tabs-pad",`
 flex-grow: 1;
 transition: border-color .3s var(--n-bezier);
 `),r("tabs-tab-pad",`
 transition: border-color .3s var(--n-bezier);
 `),r("tabs-tab",`
 font-weight: var(--n-tab-font-weight);
 border: 1px solid var(--n-tab-border-color);
 background-color: var(--n-tab-color);
 box-sizing: border-box;
 position: relative;
 vertical-align: bottom;
 display: flex;
 justify-content: space-between;
 font-size: var(--n-tab-font-size);
 color: var(--n-tab-text-color);
 `,[l("addable",`
 padding-left: 8px;
 padding-right: 8px;
 font-size: 16px;
 justify-content: center;
 `,[L("height-placeholder",`
 width: 0;
 font-size: var(--n-tab-font-size);
 `),ra("disabled",[C("&:hover",`
 color: var(--n-tab-text-color-hover);
 `)])]),l("closable","padding-inline-end: 8px;"),l("active",`
 background-color: #0000;
 font-weight: var(--n-tab-font-weight-active);
 color: var(--n-tab-text-color-active);
 `),l("disabled","color: var(--n-tab-text-color-disabled);")])]),l("left, right",`
 flex-direction: column; 
 `,[L("prefix, suffix",`
 padding: var(--n-tab-padding-vertical);
 `),r("tabs-wrapper",`
 flex-direction: column;
 `),r("tabs-tab-wrapper",`
 flex-direction: column;
 `,[r("tabs-tab-pad",`
 height: var(--n-tab-gap-vertical);
 width: 100%;
 `)])]),l("top",[l("card-type",[r("tabs-scroll-padding","border-bottom: 1px solid var(--n-tab-border-color);"),L("prefix, suffix",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),r("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-top-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-bottom: 1px solid #0000;
 `)]),r("tabs-tab-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `),r("tabs-pad",`
 border-bottom: 1px solid var(--n-tab-border-color);
 `)])]),l("left",[l("card-type",[r("tabs-scroll-padding","border-right: 1px solid var(--n-tab-border-color);"),L("prefix, suffix",`
 border-right: 1px solid var(--n-tab-border-color);
 `),r("tabs-tab",`
 border-top-left-radius: var(--n-tab-border-radius);
 border-bottom-left-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-right: 1px solid #0000;
 `)]),r("tabs-tab-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `),r("tabs-pad",`
 border-right: 1px solid var(--n-tab-border-color);
 `)])]),l("right",[l("card-type",[r("tabs-scroll-padding","border-left: 1px solid var(--n-tab-border-color);"),L("prefix, suffix",`
 border-left: 1px solid var(--n-tab-border-color);
 `),r("tabs-tab",`
 border-top-right-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-left: 1px solid #0000;
 `)]),r("tabs-tab-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `),r("tabs-pad",`
 border-left: 1px solid var(--n-tab-border-color);
 `)])]),l("bottom",[l("card-type",[r("tabs-scroll-padding","border-top: 1px solid var(--n-tab-border-color);"),L("prefix, suffix",`
 border-top: 1px solid var(--n-tab-border-color);
 `),r("tabs-tab",`
 border-bottom-left-radius: var(--n-tab-border-radius);
 border-bottom-right-radius: var(--n-tab-border-radius);
 `,[l("active",`
 border-top: 1px solid #0000;
 `)]),r("tabs-tab-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `),r("tabs-pad",`
 border-top: 1px solid var(--n-tab-border-color);
 `)])])]),r("tabs-scroll-button",[l("start",`
 padding-left: 10px;
 padding-right: 6px;
 `),l("end",`
 padding-right: 10px;
 padding-left: 6px;
 `),l("up",`
 padding-bottom: 10px;
 `),l("down",`
 padding-top: 10px;
 `)])]),et=ae({name:"TabsButton",props:{type:{type:String,default:"next"},mergedClsPrefix:{type:String,required:!0},vertical:Boolean,disabled:Boolean,rtl:Boolean,theme:Object,themeOverrides:Object,onClick:Function},setup(e){return{handleClick:()=>{var s;e.disabled||(s=e.onClick)==null||s.call(e,e.type)}}},render(){const{mergedClsPrefix:e,disabled:n,type:s,vertical:p,rtl:c,theme:y,themeOverrides:u,handleClick:b}=this,h=s==="next",v=p?h:c?!h:h;return i(),W(st,{text:!0,disabled:n,size:"small",theme:y,themeOverrides:u,onClick:b,class:k([`${e}-tabs-scroll-button`,!p&&s==="prev"&&`${e}-tabs-scroll-button--start`,!p&&s==="next"&&`${e}-tabs-scroll-button--end`,p&&s==="prev"&&`${e}-tabs-scroll-button--up`,p&&s==="next"&&`${e}-tabs-scroll-button--down`])},{icon:()=>(i(),W(it,{clsPrefix:e,style:ne(p?{transform:"rotate(90deg)"}:void 0)},{default:()=>v?(i(),W(ya,{key:1})):(i(),W(Ha,{key:2}))},1032,["clsPrefix","style"]))},1032,["disabled","theme","themeOverrides","onClick","class"])}});const Pe=Ia,Da={...lt.props,value:[String,Number],defaultValue:[String,Number],trigger:{type:String,default:"click"},type:{type:String,default:"bar"},closable:Boolean,justifyContent:String,size:String,placement:{type:String,default:"top"},tabStyle:[String,Object],tabClass:String,addTabStyle:[String,Object],addTabClass:String,barWidth:Number,paneClass:String,paneStyle:[String,Object],paneWrapperClass:String,paneWrapperStyle:[String,Object],addable:[Boolean,Object],tabsPadding:{type:Number,default:0},animated:Boolean,onBeforeLeave:Function,onAdd:Function,"onUpdate:value":[Function,Array],onUpdateValue:[Function,Array],onClose:[Function,Array],labelSize:String,activeName:[String,Number],onActiveNameChange:[Function,Array],showScrollButton:Boolean,centerActiveTab:Boolean};var Ua=ae({name:"Tabs",props:Da,slots:Object,setup(e,{slots:n}){var Fe,Me;const{mergedClsPrefixRef:s,inlineThemeDisabled:p,mergedComponentPropsRef:c,mergedRtlRef:y}=na(e),u=oa("Tabs",y,s),b=de(()=>{const{placement:t}=e;return t==="start"?u!=null&&u.value?"right":"left":t==="end"?u!=null&&u.value?"left":"right":t}),h=lt("Tabs","-tabs",Na,ua,e,s),v=$(null),S=$(null),m=$(null),P=$(null),F=$(null),A=$(null),_=$(null),N=$(!0),E=$(!0),J=Ye(e,["labelSize","size"]),re=de(()=>{var a,o;if(J.value)return J.value;const t=(o=(a=c==null?void 0:c.value)==null?void 0:a.Tabs)==null?void 0:o.size;return t||"medium"}),G=Ye(e,["activeName","value"]),D=$(G.value??e.defaultValue??(n.default?(Me=(Fe=ke(n.default())[0])==null?void 0:Fe.props)==null?void 0:Me.name:null)),g=ia(G,D),B={id:0},U=de(()=>{if(!(!e.justifyContent||e.type==="card"))return{display:"flex",justifyContent:e.justifyContent}});ce(g,()=>{B.id=0,I(),be(()=>{we()})});function M(){var a;const{value:t}=g;return t===null?null:(a=v.value)==null?void 0:a.querySelector(`[data-name="${t}"]`)}function fe(t){if(e.type==="card")return;const{value:a}=m;if(!a)return;const o=a.style.opacity==="0";if(t){const d=`${s.value}-tabs-bar--disabled`,{barWidth:w}=e,z=b.value;if(t.dataset.disabled==="true"?a.classList.add(d):a.classList.remove(d),["top","bottom"].includes(z)){if(T(["top","maxHeight","height"]),typeof w=="number"&&t.offsetWidth>=w){const R=Math.floor((t.offsetWidth-w)/2)+t.offsetLeft;a.style.left=`${R}px`,a.style.maxWidth=`${w}px`}else a.style.left=`${t.offsetLeft}px`,a.style.maxWidth=`${t.offsetWidth}px`;a.style.width="8192px",o&&(a.style.transition="none"),a.offsetWidth,o&&(a.style.transition="",a.style.opacity="1")}else{if(T(["left","maxWidth","width"]),typeof w=="number"&&t.offsetHeight>=w){const R=Math.floor((t.offsetHeight-w)/2)+t.offsetTop;a.style.top=`${R}px`,a.style.maxHeight=`${w}px`}else a.style.top=`${t.offsetTop}px`,a.style.maxHeight=`${t.offsetHeight}px`;a.style.height="8192px",o&&(a.style.transition="none"),a.offsetHeight,o&&(a.style.transition="",a.style.opacity="1")}}}function X(){if(e.type==="card")return;const{value:t}=m;t&&(t.style.opacity="0")}function T(t){const{value:a}=m;if(a)for(const o of t)a.style[o]=""}function I(){if(e.type==="card")return;const t=M();t?fe(t):X()}function oe(t,a,o,d){const w=t.getBoundingClientRect(),z=a.getBoundingClientRect(),R=o?"left":"top",O=o?"right":"bottom";let V=0;d?V=(z[R]+z[O])/2-(w[R]+w[O])/2:z[R]<w[R]?V=z[R]-w[R]:z[O]>w[O]&&(V=z[O]-w[O]),V!==0&&t.scrollBy({[R]:V,behavior:"smooth"})}function we(){var o;const t=["top","bottom"].includes(b.value),a=M();if(a)if(t){const d=(o=A.value)==null?void 0:o.$el;if(!d)return;oe(d,a,t,e.centerActiveTab)}else{const{value:d}=_;if(!d)return;oe(d,a,t,e.centerActiveTab)}}const ue=$(null);let Ce=0,te=null;function bt(t){const a=ue.value;if(a){Ce=t.getBoundingClientRect().height;const o=`${Ce}px`,d=()=>{a.style.height=o,a.style.maxHeight=o};te?(d(),te(),te=null):te=d}}function ft(t){const a=ue.value;if(a){const o=t.getBoundingClientRect().height,d=()=>{document.body.offsetHeight,a.style.maxHeight=`${o}px`,a.style.height=`${Math.max(Ce,o)}px`};te?(te(),te=null,d()):te=d}}function ut(){const t=ue.value;if(t){t.style.maxHeight="",t.style.height="";const{paneWrapperStyle:a}=e;if(typeof a=="string")t.style.cssText=a;else if(a){const{maxHeight:o,height:d}=a;o!==void 0&&(t.style.maxHeight=o),d!==void 0&&(t.style.height=d)}}}const Ae={value:[]},Ee=$("next");function pt(t){const a=g.value;let o="next";for(const d of Ae.value){if(d===a)break;if(d===t){o="prev";break}}Ee.value=o,vt(t)}function vt(t){const{onActiveNameChange:a,onUpdateValue:o,"onUpdate:value":d}=e;a&&me(a,t),o&&me(o,t),d&&me(d,t),D.value=t}function ht(t){const{onClose:a}=e;a&&me(a,t)}function gt(t){if(["top","bottom"].includes(b.value)){const{value:a}=A;if(!a)return;const o=a.$el;if(!o)return;const d=o.offsetWidth,w=!!(u!=null&&u.value),z=t==="next"?d:-d;o.scrollBy({left:w?-z:z,behavior:"smooth"})}else{const{value:a}=_;if(!a)return;const o=a.offsetHeight,d=t==="next"?a.scrollTop+o:a.scrollTop-o;a.scrollTo({top:d,left:0,behavior:"smooth"})}}let Se=!0;function Te(){const{value:t}=m;if(!t)return;Se&&(Se=!1);const a="transition-disabled";t.classList.add(a),I(),t.classList.remove(a)}const ie=$(null);function pe({transitionDisabled:t}){const a=v.value;if(!a)return;t&&a.classList.add("transition-disabled");const o=M();o&&ie.value&&(ie.value.style.width=`${o.offsetWidth}px`,ie.value.style.height=`${o.offsetHeight}px`,ie.value.style.transform=`translate(${o.offsetLeft}px, ${o.offsetTop}px)`,t&&ie.value.offsetWidth),t&&a.classList.remove("transition-disabled")}ce([g],()=>{e.type==="segment"&&be(()=>{pe({transitionDisabled:!1})})}),dt(()=>{e.type==="segment"&&pe({transitionDisabled:!0})});let Ie=0;function mt(t){var o;if(t.contentRect.width===0&&t.contentRect.height===0||Ie===t.contentRect.width)return;Ie=t.contentRect.width;const{type:a}=e;(a==="line"||a==="bar")&&(Se||(o=e.justifyContent)!=null&&o.startsWith("space"))&&Te(),a!=="segment"&&ve(je())}const xt=Pe(mt,64);function Oe(){const{type:t}=e;t==="line"||t==="bar"?Te():t==="segment"&&pe({transitionDisabled:!0})}ce([()=>e.justifyContent,()=>e.size],()=>{be(()=>{(e.type==="line"||e.type==="bar")&&Te()})}),ce([b,()=>u==null?void 0:u.value],()=>{be(()=>{Oe(),ve(je(),{instantly:!0})})}),ce(()=>e.type,()=>{be(()=>{const t=S.value;t&&(t.classList.add("transition-disabled"),Oe(),t.offsetWidth,t.classList.remove("transition-disabled"))})});const se=$(!1);function yt(t){var O;const{target:a,contentRect:{width:o,height:d}}=t,w=a.parentElement.parentElement.offsetWidth,z=a.parentElement.parentElement.offsetHeight,R=b.value;if(!se.value)R==="top"||R==="bottom"?w<o&&(se.value=!0):z<d&&(se.value=!0);else{const{value:V}=F;if(!V)return;R==="top"||R==="bottom"?w-o>V.$el.offsetWidth&&(se.value=!1):z-d>V.$el.offsetHeight&&(se.value=!1)}ve(((O=A.value)==null?void 0:O.$el)||null)}const wt=Pe(yt,64);function Ct(){const{onAdd:t}=e;t&&t()}const Re=$(!1);function je(){var a;const t=b.value;return(t==="top"||t==="bottom"?(a=A.value)==null?void 0:a.$el:_.value)||null}function ve(t,a={instantly:!1}){if(!t)return;const o=a.instantly?P.value:null;o&&o.classList.add("transition-disabled");const d=1,w=b.value;if(w==="top"||w==="bottom"){const{scrollLeft:z,scrollWidth:R,offsetWidth:O}=t,V=Math.abs(z);N.value=V<=d,E.value=V+O>=R-d,Re.value=O<R-d}else{const{scrollTop:z,scrollHeight:R,offsetHeight:O}=t;N.value=z<=d,E.value=z+O>=R-d,Re.value=O<R-d}o&&(o.offsetWidth,o.classList.remove("transition-disabled"))}const St=Pe(t=>{ve(t.target)},64);pa(We,{triggerRef:Y(e,"trigger"),tabStyleRef:Y(e,"tabStyle"),tabClassRef:Y(e,"tabClass"),addTabStyleRef:Y(e,"addTabStyle"),addTabClassRef:Y(e,"addTabClass"),paneClassRef:Y(e,"paneClass"),paneStyleRef:Y(e,"paneStyle"),mergedClsPrefixRef:s,typeRef:Y(e,"type"),closableRef:Y(e,"closable"),valueRef:g,tabChangeIdRef:B,onBeforeLeaveRef:Y(e,"onBeforeLeave"),activateTab:pt,handleClose:ht,handleAdd:Ct}),Ca(()=>{I(),we()}),sa(()=>{const{value:t}=P;if(!t)return;const{value:a}=s,o=`${a}-tabs-nav-scroll-wrapper--shadow-start`,d=`${a}-tabs-nav-scroll-wrapper--shadow-end`;N.value?t.classList.remove(o):t.classList.add(o),E.value?t.classList.remove(d):t.classList.add(d)});const Tt={syncBarPosition:()=>{I()},scrollToCurrentTab:()=>{we()}},Rt=()=>{pe({transitionDisabled:!0})},He=de(()=>{const{value:t}=re,{type:a}=e,o=`${t}${{card:"Card",bar:"Bar",line:"Line",segment:"Segment"}[a]}`,{self:{barColor:d,closeIconColor:w,closeIconColorHover:z,closeIconColorPressed:R,tabColor:O,tabBorderColor:V,paneTextColor:kt,tabFontWeight:zt,tabBorderRadius:$t,tabFontWeightActive:_t,colorSegment:Pt,fontWeightStrong:Bt,tabColorSegment:Lt,closeSize:Wt,closeIconSize:At,closeColorHover:Et,closeColorPressed:It,closeBorderRadius:Ot,[q("panePadding",t)]:he,[q("tabPadding",o)]:jt,[q("tabPaddingVertical",o)]:Ht,[q("tabGap",o)]:Ft,[q("tabGap",`${o}Vertical`)]:Mt,[q("tabTextColor",a)]:Vt,[q("tabTextColorActive",a)]:Nt,[q("tabTextColorHover",a)]:Dt,[q("tabTextColorDisabled",a)]:Ut,[q("tabFontSize",t)]:Xt},common:{cubicBezierEaseInOut:Gt}}=h.value;return{"--n-bezier":Gt,"--n-color-segment":Pt,"--n-bar-color":d,"--n-tab-font-size":Xt,"--n-tab-text-color":Vt,"--n-tab-text-color-active":Nt,"--n-tab-text-color-disabled":Ut,"--n-tab-text-color-hover":Dt,"--n-pane-text-color":kt,"--n-tab-border-color":V,"--n-tab-border-radius":$t,"--n-close-size":Wt,"--n-close-icon-size":At,"--n-close-color-hover":Et,"--n-close-color-pressed":It,"--n-close-border-radius":Ot,"--n-close-icon-color":w,"--n-close-icon-color-hover":z,"--n-close-icon-color-pressed":R,"--n-tab-color":O,"--n-tab-font-weight":zt,"--n-tab-font-weight-active":_t,"--n-tab-padding":jt,"--n-tab-padding-vertical":Ht,"--n-tab-gap":Ft,"--n-tab-gap-vertical":Mt,"--n-pane-padding-left":ge(he,"left"),"--n-pane-padding-right":ge(he,"right"),"--n-pane-padding-top":ge(he,"top"),"--n-pane-padding-bottom":ge(he,"bottom"),"--n-font-weight-strong":Bt,"--n-tab-color-segment":Lt}}),le=p?la("tabs",de(()=>`${re.value[0]}${e.type[0]}`),He,e):void 0;return{mergedClsPrefix:s,mergedValue:g,renderedNames:new Set,segmentCapsuleElRef:ie,tabsPaneWrapperRef:ue,tabsElRef:v,selfElRef:S,barElRef:m,addTabInstRef:F,xScrollInstRef:A,scrollWrapperElRef:P,addTabFixed:se,tabWrapperStyle:U,handleNavResize:xt,mergedSize:re,handleScroll:St,handleTabsResize:wt,cssVars:p?void 0:He,themeClass:le==null?void 0:le.themeClass,animationDirection:Ee,renderNameListRef:Ae,yScrollElRef:_,handleSegmentResize:Rt,onAnimationBeforeLeave:bt,onAnimationEnter:ft,onAnimationAfterEnter:ut,onRender:le==null?void 0:le.onRender,startReachedRef:N,endReachedRef:E,isOverflow:Re,handleButtonClick:gt,mergedTheme:h,rtlEnabled:u,mergedPlacement:b,...Tt}},render(){const{mergedClsPrefix:e,type:n,mergedPlacement:s,addTabFixed:p,addable:c,mergedSize:y,renderNameListRef:u,onRender:b,paneWrapperClass:h,paneWrapperStyle:v,startReachedRef:S,endReachedRef:m,isOverflow:P,showScrollButton:F,handleButtonClick:A,mergedTheme:_,rtlEnabled:N,$slots:{default:E,prefix:J,suffix:re}}=this;b==null||b();const G=E?ke(E()).filter(T=>T.type.__TAB_PANE__===!0):[],D=E?ke(E()).filter(T=>T.type.__TAB__===!0):[],g=!D.length,B=n==="card",U=n==="segment",M=!B&&!U&&this.justifyContent;u.value=[];const fe=()=>{const T=(i(),f("div",{style:ne(this.tabWrapperStyle),class:k(`${e}-tabs-wrapper`)},[M?x(()=>null):(i(),f("div",{key:1,class:k(`${e}-tabs-scroll-padding`),style:ne(s==="top"||s==="bottom"?{width:`${this.tabsPadding}px`}:{height:`${this.tabsPadding}px`})},null,6)),g?(i(),f(H,{key:2},[x(()=>G.map((I,oe)=>(u.value.push(I.props.name),Be((i(),W(Le,ye(I.props,{internalCreatedByPane:!0,internalLeftPadded:oe!==0&&(!M||M==="center"||M==="start"||M==="end")}),De(I.children?{default:I.children.tab}:void 0),1040,["internalLeftPadded"]))))))],64)):(i(),f(H,{key:3},[x(()=>D.map((I,oe)=>(u.value.push(I.props.name),Be(oe!==0&&!M?rt(I):I))))],64)),!p&&c&&B?(i(),f(H,{key:4},[x(()=>at(c,(g?G.length:D.length)!==0))],64)):x(()=>null),M?x(()=>null):(i(),f("div",{key:7,class:k(`${e}-tabs-scroll-padding`),style:ne({width:`${this.tabsPadding}px`})},null,6)),B?x(()=>null):(i(),f("div",{key:9,ref:"barElRef",class:k(`${e}-tabs-bar`)},null,2))],6));return i(),f("div",{ref:"tabsElRef",class:k(`${e}-tabs-nav-scroll-content`)},[B&&c?(i(),W(ze,{key:0,onResize:this.handleTabsResize},{default:()=>T},1032,["onResize"])):(i(),f(H,{key:1},[x(()=>T)],64)),B?(i(),f("div",{key:2,class:k(`${e}-tabs-pad`)},null,2)):x(()=>null)],2)},X=U?"top":s;return i(),f("div",{ref:"selfElRef",class:k([`${e}-tabs`,this.themeClass,`${e}-tabs--${n}-type`,`${e}-tabs--${y}-size`,M&&`${e}-tabs--flex`,`${e}-tabs--${X}`,N&&`${e}-tabs--rtl`]),style:ne(this.cssVars)},[j("div",{class:k([`${e}-tabs-nav--${n}-type`,`${e}-tabs-nav--${X}`,`${e}-tabs-nav`])},[x(()=>Ne(J,T=>T&&(i(),f("div",{class:k(`${e}-tabs-nav__prefix`)},[x(()=>T)],2)))),U?(i(),W(ze,{key:0,onResize:this.handleSegmentResize},{default:()=>(i(),f("div",{class:k(`${e}-tabs-rail`),ref:"tabsElRef"},[j("div",{class:k(`${e}-tabs-capsule`),ref:"segmentCapsuleElRef"},[j("div",{class:k(`${e}-tabs-wrapper`)},[j("div",{class:k(`${e}-tabs-tab`)},null,2)],2)],2),g?(i(),f(H,{key:0},[x(()=>G.map((T,I)=>(u.value.push(T.props.name),i(),W(Le,ye(T.props,{internalCreatedByPane:!0,internalLeftPadded:I!==0}),De(T.children?{default:T.children.tab}:void 0),1040,["internalLeftPadded"]))))],64)):(i(),f(H,{key:1},[x(()=>D.map((T,I)=>(u.value.push(T.props.name),I===0?T:rt(T))))],64))],2))},1032,["onResize"])):(i(),f(H,{key:1},[x(()=>F&&P&&(i(),W(et,{mergedClsPrefix:e,type:"prev",vertical:X==="left"||X==="right",disabled:S,rtl:!!N,theme:_.peers.Button,themeOverrides:_.peerOverrides.Button,onClick:A},null,8,["mergedClsPrefix","vertical","disabled","rtl","theme","themeOverrides","onClick"]))),(i(),W(ze,{onResize:this.handleNavResize},{default:()=>(i(),f("div",{class:k(`${e}-tabs-nav-scroll-wrapper`),ref:"scrollWrapperElRef"},[["top","bottom"].includes(X)?(i(),W(ja,{key:0,ref:"xScrollInstRef",onScroll:this.handleScroll},{default:fe},1032,["onScroll"])):(i(),f("div",{key:1,class:k(`${e}-tabs-nav-y-scroll`),onScroll:this.handleScroll,ref:"yScrollElRef"},[x(()=>fe())],42,["onScroll"]))],2))},1032,["onResize"])),x(()=>F&&P&&(i(),W(et,{mergedClsPrefix:e,type:"next",vertical:X==="left"||X==="right",disabled:m,rtl:!!N,theme:_.peers.Button,themeOverrides:_.peerOverrides.Button,onClick:A},null,8,["mergedClsPrefix","vertical","disabled","rtl","theme","themeOverrides","onClick"])))],64)),p&&c&&B?(i(),f(H,{key:2},[x(()=>at(c,!0))],64)):x(()=>null),x(()=>Ne(re,T=>T&&(i(),f("div",{class:k(`${e}-tabs-nav__suffix`)},[x(()=>T)],2))))],2),x(()=>g&&(this.animated&&(X==="top"||X==="bottom")?(i(),f("div",{key:1,ref:"tabsPaneWrapperRef",style:ne(v),class:k([`${e}-tabs-pane-wrapper`,h])},[x(()=>tt(G,this.mergedValue,this.renderedNames,this.onAnimationBeforeLeave,this.onAnimationEnter,this.onAnimationAfterEnter,this.animationDirection))],6)):tt(G,this.mergedValue,this.renderedNames)))],6)}});function tt(e,n,s,p,c,y,u){const b=[];return e.forEach(h=>{const{name:v,displayDirective:S,"display-directive":m}=h.props,P=A=>S===A||m===A,F=n===v;if(h.key!==void 0&&(h.key=v),F||P("show")||P("show:lazy")&&s.has(v)){s.has(v)||s.add(v);const A=!P("if");b.push(A?ca(h,[[ba,F]]):h)}}),u?(i(),W(fa,{name:`${u}-transition`,onBeforeLeave:p,onEnter:c,onAfterEnter:y},{default:()=>b},1032,["name","onBeforeLeave","onEnter","onAfterEnter"])):b}function at(e,n){return i(),W(Le,{ref:"addTabInstRef",key:"__addable",name:"__addable",internalCreatedByPane:!0,internalAddable:!0,internalLeftPadded:n,disabled:typeof e=="object"&&e.disabled},null,8,["internalLeftPadded","disabled"])}function rt(e){const n=da(e);return n.props?n.props.internalLeftPadded=!0:n.props={internalLeftPadded:!0},n}function Be(e){return Array.isArray(e.dynamicProps)?e.dynamicProps.includes("internalLeftPadded")||e.dynamicProps.push("internalLeftPadded"):e.dynamicProps=["internalLeftPadded"],e}const Xa={class:"page"},Ga={key:0,class:"err"},qa={class:"at"},Ya={key:0,class:"muted"},Ka={class:"at"},Za={key:0,class:"muted"},Ja=ae({__name:"LogsView",setup(e){const n=va(),s=$(!0),p=$(""),c=$([]),y=$([]),u=$("gateway");let b;async function h(){try{const[v,S]=await Promise.all([Ue("/v1/logs?limit=150",{token:n.token}),Ue("/v1/messages/recent?limit=80",{token:n.token})]);c.value=v.items||[],y.value=S.items||[],p.value=""}catch(v){p.value=v instanceof Error?v.message:String(v)}finally{s.value=!1}}return dt(()=>{h(),b=window.setInterval(()=>void h(),4e3)}),ha(()=>{b&&window.clearInterval(b)}),(v,S)=>(i(),f("div",Xa,[S[2]||(S[2]=j("header",{class:"page-head"},[j("h1",null,"日志"),j("p",{class:"muted"},"网关日志与最近消息，自动刷新。")],-1)),Q(Z(ma),{style:{"margin-bottom":"12px"}},{default:K(()=>[Q(Z(st),{onClick:h},{default:K(()=>[...S[1]||(S[1]=[$e("刷新",-1)])]),_:1})]),_:1}),Q(Z(xa),{show:s.value},{default:K(()=>[p.value?(i(),f("p",Ga,ee(p.value),1)):(i(),W(Z(Ua),{key:1,value:u.value,"onUpdate:value":S[0]||(S[0]=m=>u.value=m),type:"line"},{default:K(()=>[Q(Z(Qe),{name:"gateway",tab:"网关日志"},{default:K(()=>[Q(Z(Xe),{size:"small"},{default:K(()=>[(i(!0),f(H,null,Ge(c.value,(m,P)=>(i(),f("div",{key:P,class:"log-row"},[Q(Z(Ve),{size:"tiny",bordered:!1},{default:K(()=>[$e(ee(m.level),1)]),_:2},1024),j("span",qa,ee(m.at),1),j("span",null,ee(m.message),1)]))),128)),c.value.length?qe("",!0):(i(),f("p",Ya,"暂无日志"))]),_:1})]),_:1}),Q(Z(Qe),{name:"messages",tab:"最近消息"},{default:K(()=>[Q(Z(Xe),{size:"small"},{default:K(()=>[(i(!0),f(H,null,Ge(y.value,m=>(i(),f("div",{key:m.id,class:"log-row"},[Q(Z(Ve),{size:"tiny"},{default:K(()=>[$e(ee(m.channel),1)]),_:2},1024),j("span",Ka,ee(m.createdAt),1),j("span",null,ee(m.role)+"/"+ee(m.userId)+": "+ee(m.content),1)]))),128)),y.value.length?qe("",!0):(i(),f("p",Za,"暂无消息"))]),_:1})]),_:1})]),_:1},8,["value"]))]),_:1},8,["show"])]))}}),or=ga(Ja,[["__scopeId","data-v-9c8322fb"]]);export{or as default};
