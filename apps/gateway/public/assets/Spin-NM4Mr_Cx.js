import{m as y,z as g,A as c,aB as w,D as b,d as B,bW as T,J as S,i as p,c as m,L as f,O as r,b as z,N as h,a0 as R,a1 as N,e as V,Q as P,R as $,as as W,r as O,al as _,bX as E,a7 as I,T as L}from"./index-DfXfDrdW.js";function j(e,t){return y(()=>{for(const o of t)if(e[o]!==void 0)return e[o];return e[t[t.length-1]]})}var D=g([g("@keyframes spin-rotate",`
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
 `)])]);const K={small:20,medium:18,large:16},X={...S.props,contentClass:String,contentStyle:[Object,String],description:String,size:{type:[String,Number],default:"medium"},show:{type:Boolean,default:!0},rotate:{type:Boolean,default:!0},spinning:{type:Boolean,validator:()=>!0,default:void 0},delay:Number,...T,strokeWidth:Number};var J=B({name:"Spin",props:X,slots:Object,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=P(e),v=S("Spin","-spin",D,E,e,t),l=y(()=>{const{size:s}=e,{common:{cubicBezierEaseInOut:a},self:u}=v.value,{opacitySpinning:k,color:x,textColor:C}=u;return{"--n-bezier":a,"--n-opacity-spinning":k,"--n-size":typeof s=="number"?I(s):u[L("size",s)],"--n-color":x,"--n-text-color":C}}),n=o?$("spin",y(()=>{const{size:s}=e;return typeof s=="number"?String(s):s[0]}),l,e):void 0,d=j(e,["spinning","show"]),i=O(!1);return W(s=>{let a;if(d.value){const{delay:u}=e;if(u){a=window.setTimeout(()=>{i.value=!0},u),s(()=>{clearTimeout(a)});return}}i.value=d.value}),{mergedClsPrefix:t,active:i,mergedStrokeWidth:y(()=>{const{strokeWidth:s}=e;if(s!==void 0)return s;const{size:a}=e;return K[typeof a=="number"?"medium":a]}),cssVars:o?void 0:l,themeClass:n==null?void 0:n.themeClass,onRender:n==null?void 0:n.onRender}},render(){var d;const{$slots:e,mergedClsPrefix:t,description:o}=this,v=e.icon&&this.rotate,l=(o||e.description)&&(p(),m("div",{class:r(`${t}-spin-description`)},[f(()=>{var i;return o||((i=e.description)==null?void 0:i.call(e))})],2)),n=e.icon?(p(),m("div",{key:1,class:r([`${t}-spin-body`,this.themeClass])},[z("div",{class:r([`${t}-spin`,v&&`${t}-spin--rotate`]),style:h(e.default?"":this.cssVars)},[f(()=>e.icon())],6),f(()=>l)],2)):(p(),m("div",{key:2,class:r([`${t}-spin-body`,this.themeClass])},[(p(),R(N,{clsPrefix:t,style:h(e.default?"":this.cssVars),stroke:this.stroke,"stroke-width":this.mergedStrokeWidth,radius:this.radius,scale:this.scale,class:r(`${t}-spin`)},null,8,["clsPrefix","style","stroke","stroke-width","radius","scale","class"])),f(()=>l)],2));return(d=this.onRender)==null||d.call(this),e.default?(p(),m("div",{key:3,class:r([`${t}-spin-container`,this.themeClass]),style:h(this.cssVars)},[z("div",{class:r([`${t}-spin-content`,this.active&&`${t}-spin-content--spinning`,this.contentClass]),style:h(this.contentStyle)},[f(()=>{var i;return(i=e.default)==null?void 0:i.call(e)})],6),V(_,{name:"fade-in-transition"},{default:()=>this.active?n:null},1024)],6)):n}});export{J as S,j as u};
