import{x as y,J as g,E as c,b8 as w,K as b,d as B,ce as R,M as S,h as p,c as m,O as f,Q as r,b as z,U as h,s as T,R as V,e as $,V as N,Y as P,aF as E,r as O,aQ as W,cf as _,a0 as I,$ as j}from"./index-DWf2TY1V.js";function K(e,t){return y(()=>{for(const o of t)if(e[o]!==void 0)return e[o];return e[t[t.length-1]]})}var L=g([g("@keyframes spin-rotate",`
 from {
 transform: rotate(0);
 }
 to {
 transform: rotate(360deg);
 }
 `),c("spin-container",`
 position: relative;
 `,[c("spin-body",`
 position: absolute;
 top: 50%;
 left: 50%;
 transform: translateX(-50%) translateY(-50%);
 `,[w()])]),c("spin-body",`
 display: inline-flex;
 align-items: center;
 justify-content: center;
 flex-direction: column;
 `),c("spin",`
 display: inline-flex;
 height: var(--n-size);
 width: var(--n-size);
 font-size: var(--n-size);
 color: var(--n-color);
 `,[b("rotate",`
 animation: spin-rotate 2s linear infinite;
 `)]),c("spin-description",`
 display: inline-block;
 font-size: var(--n-font-size);
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 margin-top: 8px;
 `),c("spin-content",`
 opacity: 1;
 transition: opacity .3s var(--n-bezier);
 pointer-events: all;
 `,[b("spinning",`
 user-select: none;
 -webkit-user-select: none;
 pointer-events: none;
 opacity: var(--n-opacity-spinning);
 `)])]);const D={small:20,medium:18,large:16},M={...S.props,contentClass:String,contentStyle:[Object,String],description:String,size:{type:[String,Number],default:"medium"},show:{type:Boolean,default:!0},rotate:{type:Boolean,default:!0},spinning:{type:Boolean,validator:()=>!0,default:void 0},delay:Number,...R,strokeWidth:Number};var Y=B({name:"Spin",props:M,slots:Object,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=N(e),v=S("Spin","-spin",L,_,e,t),l=y(()=>{const{size:s}=e,{common:{cubicBezierEaseInOut:a},self:u}=v.value,{opacitySpinning:k,color:x,textColor:C}=u;return{"--n-bezier":a,"--n-opacity-spinning":k,"--n-size":typeof s=="number"?I(s):u[j("size",s)],"--n-color":x,"--n-text-color":C}}),n=o?P("spin",y(()=>{const{size:s}=e;return typeof s=="number"?String(s):s[0]}),l,e):void 0,d=K(e,["spinning","show"]),i=O(!1);return E(s=>{let a;if(d.value){const{delay:u}=e;if(u){a=window.setTimeout(()=>{i.value=!0},u),s(()=>{clearTimeout(a)});return}}i.value=d.value}),{mergedClsPrefix:t,active:i,mergedStrokeWidth:y(()=>{const{strokeWidth:s}=e;if(s!==void 0)return s;const{size:a}=e;return D[typeof a=="number"?"medium":a]}),cssVars:o?void 0:l,themeClass:n==null?void 0:n.themeClass,onRender:n==null?void 0:n.onRender}},render(){var d;const{$slots:e,mergedClsPrefix:t,description:o}=this,v=e.icon&&this.rotate,l=(o||e.description)&&(p(),m("div",{class:r(`${t}-spin-description`)},[f(()=>{var i;return o||((i=e.description)==null?void 0:i.call(e))})],2)),n=e.icon?(p(),m("div",{key:1,class:r([`${t}-spin-body`,this.themeClass])},[z("div",{class:r([`${t}-spin`,v&&`${t}-spin--rotate`]),style:h(e.default?"":this.cssVars)},[f(()=>e.icon())],6),f(()=>l)],2)):(p(),m("div",{key:2,class:r([`${t}-spin-body`,this.themeClass])},[(p(),T(V,{clsPrefix:t,style:h(e.default?"":this.cssVars),stroke:this.stroke,"stroke-width":this.mergedStrokeWidth,radius:this.radius,scale:this.scale,class:r(`${t}-spin`)},null,8,["clsPrefix","style","stroke","stroke-width","radius","scale","class"])),f(()=>l)],2));return(d=this.onRender)==null||d.call(this),e.default?(p(),m("div",{key:3,class:r([`${t}-spin-container`,this.themeClass]),style:h(this.cssVars)},[z("div",{class:r([`${t}-spin-content`,this.active&&`${t}-spin-content--spinning`,this.contentClass]),style:h(this.contentStyle)},[f(()=>{var i;return(i=e.default)==null?void 0:i.call(e)})],6),$(W,{name:"fade-in-transition"},{default:()=>this.active?n:null},1024)],6)):n}});export{Y as S,K as u};
