import{d as ne,aj as ce,ak as $e,h as n,c as o,$ as L,al as ze,am as Ue,N as v,L as Y,K as l,an as Ee,a1 as ue,ah as ye,ao as Le,r as w,ap as pe,aq as ke,P as ve,ar as we,as as je,v as Ae,at as He,au as Ne,k as H,av as We,aw as se,ax as Ve,ay as Xe,az as Ye,y as h,aA as he,z as g,C as U,D as E,aB as qe,H as oe,aC as Ke,aD as Je,a4 as Ce,aE as Qe,Q as xe,aF as Ge,a5 as re,aG as Ze,aH as et,a8 as be,ag as Se,b as c,F as p,aI as tt,aJ as _e,E as rt,G as nt,aK as ot,aL as it,aM as at,u as st,l as lt,o as dt,t as A,e as B,w as k,f as y,M as ct,a as Z,B as X,i as D,s as te,j as de,I as ut,aN as vt,_ as ht}from"./index-OCzJjvyo.js";import{T as ft}from"./Tag-BTpZ34Wy.js";import{S as ae}from"./Space-Bzfyys5o.js";import{S as mt}from"./Spin-BJNVha2_.js";const gt=["onMouseenter","onMouseleave","onMousedown"],bt={key:1,role:"none"};var yt=ne({name:"NDrawerContent",inheritAttrs:!1,props:{blockScroll:Boolean,show:{type:Boolean,default:void 0},displayDirective:{type:String,required:!0},placement:{type:String,required:!0},contentClass:String,contentStyle:[Object,String],nativeScrollbar:{type:Boolean,required:!0},scrollbarProps:Object,trapFocus:{type:Boolean,default:!0},autoFocus:{type:Boolean,default:!0},showMask:{type:[Boolean,String],required:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,onClickoutside:Function,onAfterLeave:Function,onAfterEnter:Function,onEsc:Function},setup(e){const t=w(!!e.show),i=w(null),x=pe(ke);let _=0,I="",$=null;const s=w(!1),b=w(!1),f=H(()=>e.placement==="top"||e.placement==="bottom"),{mergedClsPrefixRef:O,mergedRtlRef:z}=ve(e),T=we("Drawer",z,O),M=u,C=m=>{b.value=!0,_=f.value?m.clientY:m.clientX,I=document.body.style.cursor,document.body.style.cursor=f.value?"ns-resize":"ew-resize",document.body.addEventListener("mousemove",V),document.body.addEventListener("mouseleave",M),document.body.addEventListener("mouseup",u)},N=()=>{$!==null&&(window.clearTimeout($),$=null),b.value?s.value=!0:$=window.setTimeout(()=>{s.value=!0},300)},ee=()=>{$!==null&&(window.clearTimeout($),$=null),s.value=!1},{doUpdateHeight:q,doUpdateWidth:J}=x,K=m=>{const{maxWidth:R}=e;if(R&&m>R)return R;const{minWidth:F}=e;return F&&m<F?F:m},W=m=>{const{maxHeight:R}=e;if(R&&m>R)return R;const{minHeight:F}=e;return F&&m<F?F:m};function V(m){var R,F;if(b.value)if(f.value){let j=((R=i.value)==null?void 0:R.offsetHeight)||0;const Q=_-m.clientY;j+=e.placement==="bottom"?Q:-Q,j=W(j),q(j),_=m.clientY}else{let j=((F=i.value)==null?void 0:F.offsetWidth)||0;const Q=_-m.clientX;j+=e.placement==="right"?Q:-Q,j=K(j),J(j),_=m.clientX}}function u(){b.value&&(_=0,b.value=!1,document.body.style.cursor=I,document.body.removeEventListener("mousemove",V),document.body.removeEventListener("mouseup",u),document.body.removeEventListener("mouseleave",M))}je(()=>{e.show&&(t.value=!0)}),Ae(()=>e.show,m=>{m||u()}),He(()=>{u()});const S=H(()=>{const{show:m}=e,R=[[$e,m]];return e.showMask||R.push([We,e.onClickoutside,void 0,{capture:!0}]),R});function P(){var m;t.value=!1,(m=e.onAfterLeave)==null||m.call(e)}return Ne(H(()=>e.blockScroll&&t.value)),se(Ve,i),se(Xe,null),se(Ye,null),{bodyRef:i,rtlEnabled:T,mergedClsPrefix:x.mergedClsPrefixRef,isMounted:x.isMountedRef,mergedTheme:x.mergedThemeRef,displayed:t,transitionName:H(()=>({right:"slide-in-from-right-transition",left:"slide-in-from-left-transition",top:"slide-in-from-top-transition",bottom:"slide-in-from-bottom-transition"})[e.placement]),handleAfterLeave:P,bodyDirectives:S,handleMousedownResizeTrigger:C,handleMouseenterResizeTrigger:N,handleMouseleaveResizeTrigger:ee,isDragging:b,isHoverOnResizeTrigger:s}},render(){const{$slots:e,mergedClsPrefix:t}=this;return this.displayDirective==="show"||this.displayed||this.show?ce((n(),o("div",bt,[(n(),L(Le,{disabled:!this.showMask||!this.trapFocus,active:this.show,autoFocus:this.autoFocus,onEsc:this.onEsc},{default:()=>(n(),L(ze,{name:this.transitionName,appear:this.isMounted,onAfterEnter:this.onAfterEnter,onAfterLeave:this.handleAfterLeave},{default:()=>ce(Ue("div",ue(this.$attrs,{role:"dialog",ref:"bodyRef","aria-modal":"true",class:[`${t}-drawer`,this.rtlEnabled&&`${t}-drawer--rtl`,`${t}-drawer--${this.placement}-placement`,this.isDragging&&`${t}-drawer--unselectable`,this.nativeScrollbar&&`${t}-drawer--native-scrollbar`]}),[this.resizable?(n(),o("div",{key:2,class:v([`${t}-drawer__resize-trigger`,(this.isDragging||this.isHoverOnResizeTrigger)&&`${t}-drawer__resize-trigger--hover`]),onMouseenter:this.handleMouseenterResizeTrigger,onMouseleave:this.handleMouseleaveResizeTrigger,onMousedown:this.handleMousedownResizeTrigger},null,42,gt)):null,this.nativeScrollbar?(n(),o("div",{key:3,class:v([`${t}-drawer-content-wrapper`,this.contentClass]),style:Y(this.contentStyle),role:"none"},[l(()=>{var i;return(i=e.default)==null?void 0:i.call(e)})],6)):(n(),L(Ee,ue({key:4},this.scrollbarProps,{contentStyle:this.contentStyle,contentClass:[`${t}-drawer-content-wrapper`,this.contentClass],theme:this.mergedTheme.peers.Scrollbar,themeOverrides:this.mergedTheme.peerOverrides.Scrollbar}),ye(e),1040,["contentStyle","contentClass","theme","themeOverrides"]))]),this.bodyDirectives)},1032,["name","appear","onAfterEnter","onAfterLeave"]))},1032,["disabled","active","autoFocus","onEsc"]))])),[[$e,this.displayDirective==="if"||this.displayed||this.show]]):null}});const{cubicBezierEaseIn:pt,cubicBezierEaseOut:kt}=he;function wt({duration:e="0.3s",leaveDuration:t="0.2s",name:i="slide-in-from-bottom"}={}){return[h(`&.${i}-transition-leave-active`,{transition:`transform ${t} ${pt}`}),h(`&.${i}-transition-enter-active`,{transition:`transform ${e} ${kt}`}),h(`&.${i}-transition-enter-to`,{transform:"translateY(0)"}),h(`&.${i}-transition-enter-from`,{transform:"translateY(100%)"}),h(`&.${i}-transition-leave-from`,{transform:"translateY(0)"}),h(`&.${i}-transition-leave-to`,{transform:"translateY(100%)"})]}const{cubicBezierEaseIn:xt,cubicBezierEaseOut:$t}=he;function Ct({duration:e="0.3s",leaveDuration:t="0.2s",name:i="slide-in-from-left"}={}){return[h(`&.${i}-transition-leave-active`,{transition:`transform ${t} ${xt}`}),h(`&.${i}-transition-enter-active`,{transition:`transform ${e} ${$t}`}),h(`&.${i}-transition-enter-to`,{transform:"translateX(0)"}),h(`&.${i}-transition-enter-from`,{transform:"translateX(-100%)"}),h(`&.${i}-transition-leave-from`,{transform:"translateX(0)"}),h(`&.${i}-transition-leave-to`,{transform:"translateX(-100%)"})]}const{cubicBezierEaseIn:St,cubicBezierEaseOut:zt}=he;function Et({duration:e="0.3s",leaveDuration:t="0.2s",name:i="slide-in-from-right"}={}){return[h(`&.${i}-transition-leave-active`,{transition:`transform ${t} ${St}`}),h(`&.${i}-transition-enter-active`,{transition:`transform ${e} ${zt}`}),h(`&.${i}-transition-enter-to`,{transform:"translateX(0)"}),h(`&.${i}-transition-enter-from`,{transform:"translateX(100%)"}),h(`&.${i}-transition-leave-from`,{transform:"translateX(0)"}),h(`&.${i}-transition-leave-to`,{transform:"translateX(100%)"})]}const{cubicBezierEaseIn:_t,cubicBezierEaseOut:Bt}=he;function Rt({duration:e="0.3s",leaveDuration:t="0.2s",name:i="slide-in-from-top"}={}){return[h(`&.${i}-transition-leave-active`,{transition:`transform ${t} ${_t}`}),h(`&.${i}-transition-enter-active`,{transition:`transform ${e} ${Bt}`}),h(`&.${i}-transition-enter-to`,{transform:"translateY(0)"}),h(`&.${i}-transition-enter-from`,{transform:"translateY(-100%)"}),h(`&.${i}-transition-leave-from`,{transform:"translateY(0)"}),h(`&.${i}-transition-leave-to`,{transform:"translateY(-100%)"})]}var It=h([g("drawer",`
 word-break: break-word;
 line-height: var(--n-line-height);
 position: absolute;
 pointer-events: all;
 box-shadow: var(--n-box-shadow);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 background-color: var(--n-color);
 color: var(--n-text-color);
 box-sizing: border-box;
 `,[Et(),Ct(),Rt(),wt(),U("unselectable",`
 user-select: none; 
 -webkit-user-select: none;
 `),U("native-scrollbar",[g("drawer-content-wrapper",`
 overflow: auto;
 height: 100%;
 `)]),E("resize-trigger",`
 position: absolute;
 background-color: #0000;
 transition: background-color .3s var(--n-bezier);
 `,[U("hover",`
 background-color: var(--n-resize-trigger-color-hover);
 `)]),g("drawer-content-wrapper",`
 box-sizing: border-box;
 `),g("drawer-content",`
 height: 100%;
 display: flex;
 flex-direction: column;
 `,[U("native-scrollbar",[g("drawer-body-content-wrapper",`
 height: 100%;
 overflow: auto;
 `)]),g("drawer-body",`
 flex: 1 0 0;
 overflow: hidden;
 `),g("drawer-body-content-wrapper",`
 box-sizing: border-box;
 padding: var(--n-body-padding);
 `),g("drawer-header",`
 font-weight: var(--n-title-font-weight);
 line-height: 1;
 font-size: var(--n-title-font-size);
 color: var(--n-title-text-color);
 padding: var(--n-header-padding);
 transition: border .3s var(--n-bezier);
 border-bottom: 1px solid var(--n-divider-color);
 border-bottom: var(--n-header-border-bottom);
 display: flex;
 justify-content: space-between;
 align-items: center;
 `,[E("main",`
 flex: 1;
 `),E("close",`
 margin-left: 6px;
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `)]),g("drawer-footer",`
 display: flex;
 justify-content: flex-end;
 border-top: var(--n-footer-border-top);
 transition: border .3s var(--n-bezier);
 padding: var(--n-footer-padding);
 `)]),U("right-placement",`
 top: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-bottom-left-radius: var(--n-border-radius);
 `,[E("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 left: 0;
 transform: translateX(-1.5px);
 cursor: ew-resize;
 `)]),U("left-placement",`
 top: 0;
 bottom: 0;
 left: 0;
 border-top-right-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[E("resize-trigger",`
 width: 3px;
 height: 100%;
 top: 0;
 right: 0;
 transform: translateX(1.5px);
 cursor: ew-resize;
 `)]),U("top-placement",`
 top: 0;
 left: 0;
 right: 0;
 border-bottom-left-radius: var(--n-border-radius);
 border-bottom-right-radius: var(--n-border-radius);
 `,[E("resize-trigger",`
 width: 100%;
 height: 3px;
 bottom: 0;
 left: 0;
 transform: translateY(1.5px);
 cursor: ns-resize;
 `)]),U("bottom-placement",`
 left: 0;
 bottom: 0;
 right: 0;
 border-top-left-radius: var(--n-border-radius);
 border-top-right-radius: var(--n-border-radius);
 `,[E("resize-trigger",`
 width: 100%;
 height: 3px;
 top: 0;
 left: 0;
 transform: translateY(-1.5px);
 cursor: ns-resize;
 `)])]),h("body",[h(">",[g("drawer-container",`
 position: fixed;
 `)])]),g("drawer-container",`
 position: relative;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 pointer-events: none;
 `,[h("> *",`
 pointer-events: all;
 `)]),g("drawer-mask",`
 background-color: rgba(0, 0, 0, .3);
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 `,[U("invisible",`
 background-color: rgba(0, 0, 0, 0)
 `),qe({enterDuration:"0.2s",leaveDuration:"0.2s",enterCubicBezier:"var(--n-bezier-in)",leaveCubicBezier:"var(--n-bezier-out)"})])]);const Pt=["onClick"],Tt={...oe.props,show:Boolean,width:[Number,String],height:[Number,String],placement:{type:String,default:"right"},maskClosable:{type:Boolean,default:!0},showMask:{type:[Boolean,String],default:!0},to:[String,Object],displayDirective:{type:String,default:"if"},nativeScrollbar:{type:Boolean,default:!0},zIndex:Number,onMaskClick:Function,scrollbarProps:Object,contentClass:String,contentStyle:[Object,String],trapFocus:{type:Boolean,default:!0},onEsc:Function,autoFocus:{type:Boolean,default:!0},closeOnEsc:{type:Boolean,default:!0},blockScroll:{type:Boolean,default:!0},maxWidth:Number,maxHeight:Number,minWidth:Number,minHeight:Number,resizable:Boolean,defaultWidth:{type:[Number,String],default:251},defaultHeight:{type:[Number,String],default:251},onUpdateWidth:[Function,Array],onUpdateHeight:[Function,Array],"onUpdate:width":[Function,Array],"onUpdate:height":[Function,Array],"onUpdate:show":[Function,Array],onUpdateShow:[Function,Array],onAfterEnter:Function,onAfterLeave:Function,drawerStyle:[String,Object],drawerClass:String,target:null,onShow:Function,onHide:Function};var Mt=ne({name:"Drawer",inheritAttrs:!1,props:Tt,setup(e){const{mergedClsPrefixRef:t,namespaceRef:i,inlineThemeDisabled:x}=ve(e),_=Je(),I=oe("Drawer","-drawer",It,et,e,t),$=w(e.defaultWidth),s=w(e.defaultHeight),b=Ce(be(e,"width"),$),f=Ce(be(e,"height"),s),O=H(()=>{const{placement:u}=e;return u==="top"||u==="bottom"?"":Se(b.value)}),z=H(()=>{const{placement:u}=e;return u==="left"||u==="right"?"":Se(f.value)}),T=u=>{const{onUpdateWidth:S,"onUpdate:width":P}=e;S&&re(S,u),P&&re(P,u),$.value=u},M=u=>{const{onUpdateHeight:S,"onUpdate:width":P}=e;S&&re(S,u),P&&re(P,u),s.value=u},C=H(()=>[{width:O.value,height:z.value},e.drawerStyle||""]);function N(u){const{onMaskClick:S,maskClosable:P}=e;P&&K(!1),S&&S(u)}function ee(u){N(u)}const q=Qe();function J(u){var S;(S=e.onEsc)==null||S.call(e),e.show&&e.closeOnEsc&&Ge(u)&&(q.value||K(!1))}function K(u){const{onHide:S,onUpdateShow:P,"onUpdate:show":m}=e;P&&re(P,u),m&&re(m,u),S&&!u&&re(S,u)}se(ke,{isMountedRef:_,mergedThemeRef:I,mergedClsPrefixRef:t,doUpdateShow:K,doUpdateHeight:M,doUpdateWidth:T});const W=H(()=>{const{common:{cubicBezierEaseInOut:u,cubicBezierEaseIn:S,cubicBezierEaseOut:P},self:{color:m,textColor:R,boxShadow:F,lineHeight:j,headerPadding:Q,footerPadding:ie,borderRadius:fe,bodyPadding:me,titleFontSize:ge,titleTextColor:d,titleFontWeight:r,headerBorderBottom:a,footerBorderTop:G,closeIconColor:le,closeIconColorHover:Re,closeIconColorPressed:Ie,closeColorHover:Pe,closeColorPressed:Te,closeIconSize:Me,closeSize:Oe,closeBorderRadius:Fe,resizableTriggerColorHover:De}}=I.value;return{"--n-line-height":j,"--n-color":m,"--n-border-radius":fe,"--n-text-color":R,"--n-box-shadow":F,"--n-bezier":u,"--n-bezier-out":P,"--n-bezier-in":S,"--n-header-padding":Q,"--n-body-padding":me,"--n-footer-padding":ie,"--n-title-text-color":d,"--n-title-font-size":ge,"--n-title-font-weight":r,"--n-header-border-bottom":a,"--n-footer-border-top":G,"--n-close-icon-color":le,"--n-close-icon-color-hover":Re,"--n-close-icon-color-pressed":Ie,"--n-close-size":Oe,"--n-close-color-hover":Pe,"--n-close-color-pressed":Te,"--n-close-icon-size":Me,"--n-close-border-radius":Fe,"--n-resize-trigger-color-hover":De}}),V=x?xe("drawer",void 0,W,e):void 0;return{mergedClsPrefix:t,namespace:i,mergedBodyStyle:C,handleOutsideClick:ee,handleMaskClick:N,handleEsc:J,mergedTheme:I,cssVars:x?void 0:W,themeClass:V==null?void 0:V.themeClass,onRender:V==null?void 0:V.onRender,isMounted:_}},render(){const{mergedClsPrefix:e}=this;return n(),L(Ke,{to:this.to,show:this.show},{default:()=>{var t;return(t=this.onRender)==null||t.call(this),ce((n(),o("div",{class:v([`${e}-drawer-container`,this.namespace,this.themeClass]),style:Y(this.cssVars),role:"none"},[this.showMask?(n(),L(ze,{key:0,name:"fade-in-transition",appear:this.isMounted},{default:()=>this.show?(n(),o("div",{key:1,"aria-hidden":!0,class:v([`${e}-drawer-mask`,this.showMask==="transparent"&&`${e}-drawer-mask--invisible`]),onClick:this.handleMaskClick},null,10,Pt)):null},1032,["appear"])):l(()=>null),(n(),L(yt,ue(this.$attrs,{class:[this.drawerClass,this.$attrs.class],style:[this.mergedBodyStyle,this.$attrs.style],blockScroll:this.blockScroll,contentStyle:this.contentStyle,contentClass:this.contentClass,placement:this.placement,scrollbarProps:this.scrollbarProps,show:this.show,displayDirective:this.displayDirective,nativeScrollbar:this.nativeScrollbar,onAfterEnter:this.onAfterEnter,onAfterLeave:this.onAfterLeave,trapFocus:this.trapFocus,autoFocus:this.autoFocus,resizable:this.resizable,maxHeight:this.maxHeight,minHeight:this.minHeight,maxWidth:this.maxWidth,minWidth:this.minWidth,showMask:this.showMask,onEsc:this.handleEsc,onClickoutside:this.handleOutsideClick}),ye(this.$slots),1040,["class","style","blockScroll","contentStyle","contentClass","placement","scrollbarProps","show","displayDirective","nativeScrollbar","onAfterEnter","onAfterLeave","trapFocus","autoFocus","resizable","maxHeight","minHeight","maxWidth","minWidth","showMask","onEsc","onClickoutside"]))],6)),[[Ze,{zIndex:this.zIndex,enabled:this.show}]])}},1032,["to","show"])}});const Ot={title:String,headerClass:String,headerStyle:[Object,String],footerClass:String,footerStyle:[Object,String],bodyClass:String,bodyStyle:[Object,String],bodyContentClass:String,bodyContentStyle:[Object,String],nativeScrollbar:{type:Boolean,default:!0},scrollbarProps:Object,closable:Boolean};var Ft=ne({name:"DrawerContent",props:Ot,slots:Object,setup(){const e=pe(ke,null);e||_e("drawer-content","`n-drawer-content` must be placed inside `n-drawer`.");const{doUpdateShow:t}=e;function i(){t(!1)}return{handleCloseClick:i,mergedTheme:e.mergedThemeRef,mergedClsPrefix:e.mergedClsPrefixRef}},render(){const{title:e,mergedClsPrefix:t,nativeScrollbar:i,mergedTheme:x,bodyClass:_,bodyStyle:I,bodyContentClass:$,bodyContentStyle:s,headerClass:b,headerStyle:f,footerClass:O,footerStyle:z,scrollbarProps:T,closable:M,$slots:C}=this;return n(),o("div",{role:"none",class:v([`${t}-drawer-content`,i&&`${t}-drawer-content--native-scrollbar`])},[C.header||e||M?(n(),o("div",{key:0,class:v([`${t}-drawer-header`,b]),style:Y(f),role:"none"},[c("div",{class:v(`${t}-drawer-header__main`),role:"heading","aria-level":"1"},[C.header!==void 0?(n(),o(p,{key:0},[l(()=>C.header())],64)):(n(),o(p,{key:1},[l(()=>e)],64))],2),l(()=>M&&(n(),L(tt,{onClick:this.handleCloseClick,clsPrefix:t,class:v(`${t}-drawer-header__close`),absolute:!0},null,8,["onClick","clsPrefix","class"])))],6)):l(()=>null),i?(n(),o("div",{key:2,class:v([`${t}-drawer-body`,_]),style:Y(I),role:"none"},[c("div",{class:v([`${t}-drawer-body-content-wrapper`,$]),style:Y(s),role:"none"},[l(()=>{var N;return(N=C.default)==null?void 0:N.call(C)})],6)],6)):(n(),L(Ee,ue({key:3,themeOverrides:x.peerOverrides.Scrollbar,theme:x.peers.Scrollbar},T,{class:`${t}-drawer-body`,contentClass:[`${t}-drawer-body-content-wrapper`,$],contentStyle:s}),ye(C),1040,["themeOverrides","theme","class","contentClass","contentStyle"])),C.footer?(n(),o("div",{key:4,class:v([`${t}-drawer-footer`,O]),style:Y(z),role:"none"},[l(()=>C.footer())],6)):l(()=>null)],2)}}),Dt=h([g("list",`
 --n-merged-border-color: var(--n-border-color);
 --n-merged-color: var(--n-color);
 --n-merged-color-hover: var(--n-color-hover);
 margin: 0;
 font-size: var(--n-font-size);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 padding: 0;
 list-style-type: none;
 color: var(--n-text-color);
 background-color: var(--n-merged-color);
 `,[U("show-divider",[g("list-item",[h("&:not(:last-child)",[E("divider",`
 background-color: var(--n-merged-border-color);
 `)])])]),U("clickable",[g("list-item",`
 cursor: pointer;
 `)]),U("bordered",`
 border: 1px solid var(--n-merged-border-color);
 border-radius: var(--n-border-radius);
 `),U("hoverable",[g("list-item",`
 border-radius: var(--n-border-radius);
 `,[h("&:hover",`
 background-color: var(--n-merged-color-hover);
 `,[E("divider",`
 background-color: transparent;
 `)])])]),U("bordered, hoverable",[g("list-item",`
 padding: 12px 20px;
 `),E("header, footer",`
 padding: 12px 20px;
 `)]),E("header, footer",`
 padding: 12px 0;
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[h("&:not(:last-child)",`
 border-bottom: 1px solid var(--n-merged-border-color);
 `)]),g("list-item",`
 position: relative;
 padding: 12px 0; 
 box-sizing: border-box;
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[E("prefix",`
 margin-right: 20px;
 flex: 0;
 `),E("suffix",`
 margin-left: 20px;
 flex: 0;
 `),E("main",`
 flex: 1;
 `),E("divider",`
 height: 1px;
 position: absolute;
 bottom: 0;
 left: 0;
 right: 0;
 background-color: transparent;
 transition: background-color .3s var(--n-bezier);
 pointer-events: none;
 `)])]),rt(g("list",`
 --n-merged-color-hover: var(--n-color-hover-modal);
 --n-merged-color: var(--n-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),nt(g("list",`
 --n-merged-color-hover: var(--n-color-hover-popover);
 --n-merged-color: var(--n-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const Ut={...oe.props,size:{type:String,default:"medium"},bordered:Boolean,clickable:Boolean,hoverable:Boolean,showDivider:{type:Boolean,default:!0}},Be=ot("n-list");var Lt=ne({name:"List",props:Ut,slots:Object,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:i,mergedRtlRef:x}=ve(e),_=we("List",x,t),I=oe("List","-list",Dt,it,e,t);se(Be,{showDividerRef:be(e,"showDivider"),mergedClsPrefixRef:t});const $=H(()=>{const{common:{cubicBezierEaseInOut:b},self:{fontSize:f,textColor:O,color:z,colorModal:T,colorPopover:M,borderColor:C,borderColorModal:N,borderColorPopover:ee,borderRadius:q,colorHover:J,colorHoverModal:K,colorHoverPopover:W}}=I.value;return{"--n-font-size":f,"--n-bezier":b,"--n-text-color":O,"--n-color":z,"--n-border-radius":q,"--n-border-color":C,"--n-border-color-modal":N,"--n-border-color-popover":ee,"--n-color-modal":T,"--n-color-popover":M,"--n-color-hover":J,"--n-color-hover-modal":K,"--n-color-hover-popover":W}}),s=i?xe("list",void 0,$,e):void 0;return{mergedClsPrefix:t,rtlEnabled:_,cssVars:i?void 0:$,themeClass:s==null?void 0:s.themeClass,onRender:s==null?void 0:s.onRender}},render(){const{$slots:e,mergedClsPrefix:t,onRender:i}=this;return i==null||i(),n(),o("ul",{class:v([`${t}-list`,this.rtlEnabled&&`${t}-list--rtl`,this.bordered&&`${t}-list--bordered`,this.showDivider&&`${t}-list--show-divider`,this.hoverable&&`${t}-list--hoverable`,this.clickable&&`${t}-list--clickable`,this.themeClass]),style:Y(this.cssVars)},[e.header?(n(),o("div",{key:0,class:v(`${t}-list__header`)},[l(()=>e.header())],2)):l(()=>null),l(()=>{var x;return(x=e.default)==null?void 0:x.call(e)}),e.footer?(n(),o("div",{key:2,class:v(`${t}-list__footer`)},[l(()=>e.footer())],2)):l(()=>null)],6)}}),jt=ne({name:"ListItem",slots:Object,setup(){const e=pe(Be,null);return e||_e("list-item","`n-list-item` must be placed in `n-list`."),{showDivider:e.showDividerRef,mergedClsPrefix:e.mergedClsPrefixRef}},render(){const{$slots:e,mergedClsPrefix:t}=this;return n(),o("li",{class:v(`${t}-list-item`)},[e.prefix?(n(),o("div",{key:0,class:v(`${t}-list-item__prefix`)},[l(()=>e.prefix())],2)):l(()=>null),e.default?(n(),o("div",{key:2,class:v(`${t}-list-item__main`)},[l(()=>e.default())],2)):l(()=>null),e.suffix?(n(),o("div",{key:4,class:v(`${t}-list-item__suffix`)},[l(()=>e.suffix())],2)):l(()=>null),l(()=>this.showDivider&&(n(),o("div",{class:v(`${t}-list-item__divider`)},null,2)))],2)}}),At=g("thing",`
 display: flex;
 transition: color .3s var(--n-bezier);
 font-size: var(--n-font-size);
 color: var(--n-text-color);
`,[g("thing-avatar",`
 margin-right: 12px;
 margin-top: 2px;
 `),g("thing-avatar-header-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 `,[g("thing-header-wrapper",`
 flex: 1;
 `)]),g("thing-main",`
 flex-grow: 1;
 `,[g("thing-header",`
 display: flex;
 margin-bottom: 4px;
 justify-content: space-between;
 align-items: center;
 `,[E("title",`
 font-size: 16px;
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 color: var(--n-title-text-color);
 `)]),E("description",[h("&:not(:last-child)",`
 margin-bottom: 4px;
 `)]),E("content",[h("&:not(:first-child)",`
 margin-top: 12px;
 `)]),E("footer",[h("&:not(:first-child)",`
 margin-top: 12px;
 `)]),E("action",[h("&:not(:first-child)",`
 margin-top: 12px;
 `)])])]);const Ht={...oe.props,title:String,titleExtra:String,description:String,descriptionClass:String,descriptionStyle:[String,Object],content:String,contentClass:String,contentStyle:[String,Object],contentIndented:Boolean};var Nt=ne({name:"Thing",props:Ht,slots:Object,setup(e,{slots:t}){const{mergedClsPrefixRef:i,inlineThemeDisabled:x,mergedRtlRef:_}=ve(e),I=oe("Thing","-thing",At,at,e,i),$=we("Thing",_,i),s=H(()=>{const{self:{titleTextColor:f,textColor:O,titleFontWeight:z,fontSize:T},common:{cubicBezierEaseInOut:M}}=I.value;return{"--n-bezier":M,"--n-font-size":T,"--n-text-color":O,"--n-title-font-weight":z,"--n-title-text-color":f}}),b=x?xe("thing",void 0,s,e):void 0;return()=>{var z;const{value:f}=i,O=$?$.value:!1;return(z=b==null?void 0:b.onRender)==null||z.call(b),n(),o("div",{class:v([`${f}-thing`,b==null?void 0:b.themeClass,O&&`${f}-thing--rtl`]),style:Y(x?void 0:s.value)},[t.avatar&&e.contentIndented?(n(),o("div",{key:0,class:v(`${f}-thing-avatar`)},[l(()=>t.avatar())],2)):l(()=>null),c("div",{class:v(`${f}-thing-main`)},[!e.contentIndented&&(t.header||e.title||t["header-extra"]||e.titleExtra||t.avatar)?(n(),o("div",{key:0,class:v(`${f}-thing-avatar-header-wrapper`)},[t.avatar?(n(),o("div",{key:0,class:v(`${f}-thing-avatar`)},[l(()=>t.avatar())],2)):l(()=>null),t.header||e.title||t["header-extra"]||e.titleExtra?(n(),o("div",{key:2,class:v(`${f}-thing-header-wrapper`)},[c("div",{class:v(`${f}-thing-header`)},[t.header||e.title?(n(),o("div",{key:0,class:v(`${f}-thing-header__title`)},[t.header?(n(),o(p,{key:0},[l(()=>t.header())],64)):(n(),o(p,{key:1},[l(()=>e.title)],64))],2)):l(()=>null),t["header-extra"]||e.titleExtra?(n(),o("div",{key:2,class:v(`${f}-thing-header__extra`)},[t["header-extra"]?(n(),o(p,{key:0},[l(()=>t["header-extra"]())],64)):(n(),o(p,{key:1},[l(()=>e.titleExtra)],64))],2)):l(()=>null)],2),t.description||e.description?(n(),o("div",{key:0,class:v([`${f}-thing-main__description`,e.descriptionClass]),style:Y(e.descriptionStyle)},[t.description?(n(),o(p,{key:0},[l(()=>t.description())],64)):(n(),o(p,{key:1},[l(()=>e.description)],64))],6)):l(()=>null)],2)):l(()=>null)],2)):(n(),o(p,{key:1},[t.header||e.title||t["header-extra"]||e.titleExtra?(n(),o("div",{key:0,class:v(`${f}-thing-header`)},[t.header||e.title?(n(),o("div",{key:0,class:v(`${f}-thing-header__title`)},[t.header?(n(),o(p,{key:0},[l(()=>t.header())],64)):(n(),o(p,{key:1},[l(()=>e.title)],64))],2)):l(()=>null),t["header-extra"]||e.titleExtra?(n(),o("div",{key:2,class:v(`${f}-thing-header__extra`)},[t["header-extra"]?(n(),o(p,{key:0},[l(()=>t["header-extra"]())],64)):(n(),o(p,{key:1},[l(()=>e.titleExtra)],64))],2)):l(()=>null)],2)):l(()=>null),t.description||e.description?(n(),o("div",{key:2,class:v([`${f}-thing-main__description`,e.descriptionClass]),style:Y(e.descriptionStyle)},[t.description?(n(),o(p,{key:0},[l(()=>t.description())],64)):(n(),o(p,{key:1},[l(()=>e.description)],64))],6)):l(()=>null)],64)),t.default||e.content?(n(),o("div",{key:2,class:v([`${f}-thing-main__content`,e.contentClass]),style:Y(e.contentStyle)},[t.default?(n(),o(p,{key:0},[l(()=>t.default())],64)):(n(),o(p,{key:1},[l(()=>e.content)],64))],6)):l(()=>null),t.footer?(n(),o("div",{key:4,class:v(`${f}-thing-main__footer`)},[l(()=>t.footer())],2)):l(()=>null),t.action?(n(),o("div",{key:6,class:v(`${f}-thing-main__action`)},[l(()=>t.action())],2)):l(()=>null)],2)],6)}}});const Wt={class:"page"},Vt={class:"page-head"},Xt={class:"crumb"},Yt={key:0,class:"muted"},qt={key:1,class:"muted"},Kt={key:2,class:"muted"},Jt={key:3,class:"muted"},Qt={key:0,class:"layer-grid tight"},Gt={key:1,class:"list"},Zt={class:"hint"},er={key:0,class:"muted"},tr={key:2,class:"list"},rr={class:"hint"},nr={key:1},or={key:0,class:"muted"},ir={key:3,class:"docs"},ar={key:0,class:"muted"},sr={key:1},lr=ne({__name:"PluginsView",setup(e){const t=st(),i=lt(),x=w(!1),_=w([]),I=w([]),$=w([]),s=w({step:"home"}),b=w(!1),f=w(""),O=w([]),z=w(""),T=w(""),M=w(!1),C=w(!1),N=w(""),ee=w(""),q=w(!1),J=w(""),K=w([]),W=w({}),V=H(()=>_.value.filter(d=>d.adapterScope==="all"||d.kind==="framework"));function u(d){return _.value.filter(r=>{const a=r.adapterScope||(r.kind==="framework"?"all":"specified");return a==="all"?!0:d?(r.channels||[]).includes(d):a==="channel"||a==="specified"})}const S=H(()=>s.value.step!=="list"?[]:s.value.kind==="framework"?V.value:u(s.value.channelId)),P=H(()=>{if(s.value.step==="list"&&s.value.kind==="framework")return"系统插件包";if(s.value.step==="list"&&s.value.channelId){const d=I.value.find(r=>r.id===s.value.channelId);return`${(d==null?void 0:d.label)||s.value.channelId} · 本通道插件`}return s.value.step==="list"||s.value.step==="channels"?"消息通道插件":s.value.step==="docs"?s.value.kind==="framework"?"系统插件编写":"通道插件编写":"插件管理"});async function m(){x.value=!0;try{const[d,r,a]=await Promise.all([Z("/v1/plugins",{token:t.token}),Z("/v1/channels",{token:t.token}),Z("/v1/admin/dev/plugins",{token:t.token}).catch(()=>({items:[]}))]);_.value=d.items||[],I.value=r.items||[],$.value=a.items||[]}catch(d){i.error(d instanceof Error?d.message:String(d))}finally{x.value=!1}}function R(){if(s.value.step==="list"&&s.value.kind==="channel"&&s.value.channelId){s.value={step:"channels"};return}(s.value.step==="list"||s.value.step==="channels"||s.value.step==="docs")&&(s.value={step:"home"})}async function F(d,r){try{await Z(`/v1/plugins/${encodeURIComponent(d.id)}/${r?"enable":"disable"}`,{method:"POST",token:t.token}),d.enabled=r,i.success(r?`已启用 ${d.name||d.id}`:`已停用 ${d.name||d.id}`)}catch(a){i.error(a instanceof Error?a.message:String(a))}}async function j(d){N.value=d.id,ee.value=d.name||d.id,C.value=!0;try{const r=await Z(`/v1/plugins/${encodeURIComponent(d.id)}/config`,{token:t.token});q.value=!!r.supported,J.value=r.message||"",K.value=r.schema||[],W.value={...r.values||{}}}catch(r){q.value=!1,J.value=r instanceof Error?r.message:String(r)}}async function Q(){try{await Z(`/v1/plugins/${encodeURIComponent(N.value)}/config`,{method:"PUT",token:t.token,body:JSON.stringify({values:W.value})}),i.success("配置已保存"),C.value=!1}catch(d){i.error(d instanceof Error?d.message:String(d))}}function ie(d){return $.value.find(r=>r.id===d.id)||$.value.find(r=>r.dir===d.id||r.name===d.name)}async function fe(d){const r=ie(d);if(!r){i.warning("未找到对应插件目录");return}f.value=r.dir,b.value=!0,z.value="",T.value="";try{const a=await Z(`/v1/admin/dev/plugins/${encodeURIComponent(r.dir)}/files`,{token:t.token});O.value=a.files||[]}catch(a){i.error(a instanceof Error?a.message:String(a))}}async function me(d){try{const r=await Z(`/v1/admin/dev/file?path=${encodeURIComponent(d)}`,{token:t.token});z.value=r.path,T.value=r.content}catch(r){i.error(r instanceof Error?r.message:String(r))}}async function ge(){if(z.value){M.value=!0;try{await Z("/v1/admin/dev/file",{method:"PUT",token:t.token,body:JSON.stringify({path:z.value,content:T.value})}),i.success("已保存")}catch(d){i.error(d instanceof Error?d.message:String(d))}finally{M.value=!1}}}return dt(()=>void m()),(d,r)=>(n(),o("div",Wt,[c("header",Vt,[s.value.step==="home"?(n(),o(p,{key:0},[r[9]||(r[9]=c("h1",null,"插件管理",-1)),r[10]||(r[10]=c("p",{class:"muted"},"先选插件包：消息通道插件 / 系统插件。编写说明也分开，可随时返回上一层。",-1))],64)):(n(),o(p,{key:1},[c("p",Xt,[c("button",{type:"button",class:"linkish",onClick:R},A(s.value.step==="list"&&s.value.kind==="channel"&&s.value.channelId?"消息通道插件":"插件管理"),1),r[11]||(r[11]=c("span",null," / ",-1)),c("strong",null,A(P.value),1)]),c("h1",null,A(P.value),1),s.value.step==="list"&&s.value.kind==="framework"?(n(),o("p",Yt," 系统级通用插件（菜单、生图、回声等），两边通道也能看到。 ")):s.value.step==="channels"?(n(),o("p",qt,"先选通道，再管理该通道插件；主人在通道设置里改。")):s.value.step==="docs"?(n(),o("p",Kt,"编写基准与目录约定。")):(n(),o("p",Jt,"启用、停用、配置；模块化目录可看源码。"))],64))]),B(y(ae),{style:{"margin-bottom":"12px"}},{default:k(()=>[B(y(X),{size:"small",loading:x.value,onClick:m},{default:k(()=>[...r[12]||(r[12]=[D("刷新",-1)])]),_:1},8,["loading"]),s.value.step!=="home"?(n(),L(y(X),{key:0,size:"small",quaternary:"",onClick:R},{default:k(()=>[...r[13]||(r[13]=[D("返回上一层",-1)])]),_:1})):te("",!0)]),_:1}),B(y(mt),{show:x.value},{default:k(()=>[s.value.step==="home"?(n(),o("div",Qt,[c("button",{type:"button",class:"layer-card",onClick:r[0]||(r[0]=a=>s.value={step:"channels"})},[...r[14]||(r[14]=[c("strong",null,"消息通道插件包",-1),c("span",null,"绑定某一消息通道（如 QQ）的插件，写法与通道事件相关。",-1)])]),c("button",{type:"button",class:"layer-card",onClick:r[1]||(r[1]=a=>s.value={step:"list",kind:"framework"})},[...r[15]||(r[15]=[c("strong",null,"系统插件包",-1),c("span",null,"框架级通用插件（菜单、生图、回声等），adapterScope=all。",-1)])]),c("button",{type:"button",class:"layer-card",onClick:r[2]||(r[2]=a=>s.value={step:"docs",kind:"channel"})},[...r[16]||(r[16]=[c("strong",null,"通道插件编写",-1),c("span",null,"消息通道插件的编写基准与示例。",-1)])]),c("button",{type:"button",class:"layer-card",onClick:r[3]||(r[3]=a=>s.value={step:"docs",kind:"framework"})},[...r[17]||(r[17]=[c("strong",null,"系统插件编写",-1),c("span",null,"系统插件的编写基准与示例。",-1)])])])):s.value.step==="channels"?(n(),o("div",Gt,[(n(!0),o(p,null,de(I.value,a=>(n(),o("div",{key:a.id,class:"list-row"},[c("div",null,[c("strong",null,A(a.label||a.id),1),c("div",Zt,A(a.id)+" · 可用插件 "+A(u(a.id).length),1)]),B(y(ae),null,{default:k(()=>[B(y(X),{size:"small",quaternary:"",onClick:G=>d.$router.push(`/channels/${encodeURIComponent(a.id)}`)},{default:k(()=>[...r[18]||(r[18]=[D(" 通道设置 ",-1)])]),_:1},8,["onClick"]),B(y(X),{size:"small",type:"primary",onClick:G=>s.value={step:"list",kind:"channel",channelId:a.id}},{default:k(()=>[D(" 本通道插件 · "+A(u(a.id).length),1)]),_:2},1032,["onClick"])]),_:2},1024)]))),128)),I.value.length?te("",!0):(n(),o("p",er,"暂无通道"))])):s.value.step==="list"?(n(),o("div",tr,[(n(!0),o(p,null,de(S.value,a=>{var G;return n(),o("div",{key:a.id,class:"list-row"},[c("div",null,[c("strong",null,A(a.name||a.id),1),c("div",rr,[D(A(a.id)+" ",1),(G=ie(a))!=null&&G.modular?(n(),L(y(ft),{key:0,size:"tiny",type:"success",bordered:!1,style:{"margin-left":"6px"}},{default:k(()=>[...r[19]||(r[19]=[D(" 模块化 ",-1)])]),_:1})):te("",!0),a.enabled?te("",!0):(n(),o("span",nr," · 已停用"))])]),B(y(ae),null,{default:k(()=>[B(y(X),{size:"tiny",quaternary:"",onClick:le=>j(a)},{default:k(()=>[...r[20]||(r[20]=[D("管理",-1)])]),_:1},8,["onClick"]),ie(a)?(n(),L(y(X),{key:0,size:"tiny",quaternary:"",onClick:le=>fe(a)},{default:k(()=>[...r[21]||(r[21]=[D("源码",-1)])]),_:1},8,["onClick"])):te("",!0),B(y(X),{size:"tiny",type:a.enabled?"warning":"primary",secondary:"",onClick:le=>F(a,!a.enabled)},{default:k(()=>[D(A(a.enabled?"停用":"启用"),1)]),_:2},1032,["type","onClick"])]),_:2},1024)])}),128)),S.value.length?te("",!0):(n(),o("p",or,"这个包里暂时没有插件"))])):s.value.step==="docs"?(n(),o("div",ir,[s.value.kind==="framework"?(n(),o(p,{key:0},[r[22]||(r[22]=c("p",null,"系统插件：`kind=framework`，`adapterScope=all`。菜单 / 生图 / Echo 属于这一包。",-1)),r[23]||(r[23]=c("p",null,"可放在「系统插件包」与「本通道插件」两边同时显示。",-1)),r[24]||(r[24]=c("p",null,"支持模块化目录：`plugin/*.ts`，以及 adapter / workflow / http / events / www。",-1))],64)):(n(),o(p,{key:1},[r[25]||(r[25]=c("p",null,"通道插件：`kind=channel`，`adapterScope=channel` 或 `specified`，并用 `channels` 绑定通道。",-1)),r[26]||(r[26]=c("p",null,"指令以 `#` 开头；主人配置在通道层，不在插件列表里。",-1)),r[27]||(r[27]=c("p",null,"`id` 必须英文；`name` 写中文显示名。",-1))],64))])):te("",!0)]),_:1},8,["show"]),B(y(ct),{show:C.value,"onUpdate:show":r[5]||(r[5]=a=>C.value=a),preset:"card",title:ee.value,style:{width:"min(480px, 94vw)"}},{footer:k(()=>[B(y(ae),{justify:"end"},{default:k(()=>[B(y(X),{onClick:r[4]||(r[4]=a=>C.value=!1)},{default:k(()=>[...r[28]||(r[28]=[D("关闭",-1)])]),_:1}),q.value?(n(),L(y(X),{key:0,type:"primary",onClick:Q},{default:k(()=>[...r[29]||(r[29]=[D("保存配置",-1)])]),_:1})):te("",!0)]),_:1})]),default:k(()=>[q.value?(n(!0),o(p,{key:1},de(K.value,a=>(n(),o("label",{key:a.key,class:"field"},[D(A(a.label)+" ",1),B(y(ut),{value:String(W.value[a.key]??""),"onUpdate:value":G=>W.value[a.key]=G},null,8,["value","onUpdate:value"])]))),128)):(n(),o("p",ar,A(J.value||"该插件暂未支持配置"),1))]),_:1},8,["show","title"]),B(y(Mt),{show:b.value,"onUpdate:show":r[8]||(r[8]=a=>b.value=a),width:560,placement:"right"},{default:k(()=>[B(y(Ft),{title:`源码 · ${f.value}`,closable:""},{default:k(()=>[z.value?(n(),o("div",sr,[c("p",null,[c("code",null,A(z.value),1)]),ce(c("textarea",{"onUpdate:modelValue":r[6]||(r[6]=a=>T.value=a),class:"code",rows:"22"},null,512),[[vt,T.value]]),B(y(ae),{style:{"margin-top":"10px"}},{default:k(()=>[B(y(X),{type:"primary",loading:M.value,onClick:ge},{default:k(()=>[...r[30]||(r[30]=[D("保存",-1)])]),_:1},8,["loading"]),B(y(X),{onClick:r[7]||(r[7]=a=>z.value="")},{default:k(()=>[...r[31]||(r[31]=[D("返回列表",-1)])]),_:1})]),_:1})])):(n(),L(y(Lt),{key:0,hoverable:"",clickable:""},{default:k(()=>[(n(!0),o(p,null,de(O.value,a=>(n(),L(y(jt),{key:a.path,onClick:G=>me(a.path)},{default:k(()=>[B(y(Nt),{title:a.path,description:`${a.size} B`},null,8,["title","description"])]),_:2},1032,["onClick"]))),128))]),_:1}))]),_:1},8,["title"])]),_:1},8,["show"])]))}}),hr=ht(lr,[["__scopeId","data-v-d214068f"]]);export{hr as default};
