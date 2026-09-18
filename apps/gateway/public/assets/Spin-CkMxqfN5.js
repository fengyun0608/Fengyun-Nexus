import{m as y,D as b,E as c,bP as w,H as g,d as R,bQ as T,N as k,i as p,c as m,P as f,R as r,b as z,Q as h,y as B,a3 as P,e as N,T as V,U as $,bk as W,r as E,bi as _,bR as I,a9 as O,W as j}from"./index-BCBwTPlS.js";function D(e,t){return y(()=>{for(const o of t)if(e[o]!==void 0)return e[o];return e[t[t.length-1]]})}var L=b([b("@keyframes spin-rotate",`
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
 `,[g("rotate",`
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
 `,[g("spinning",`
 user-select: none;
 -webkit-user-select: none;
 pointer-events: none;
 opacity: var(--n-opacity-spinning);
 `)])]);const K={small:20,medium:18,large:16},Q={...k.props,contentClass:String,contentStyle:[Object,String],description:String,size:{type:[String,Number],default:"medium"},show:{type:Boolean,default:!0},rotate:{type:Boolean,default:!0},spinning:{type:Boolean,validator:()=>!0,default:void 0},delay:Number,...T,strokeWidth:Number};var U=R({name:"Spin",props:Q,slots:Object,setup(e){const{mergedClsPrefixRef:t,inlineThemeDisabled:o}=V(e),v=k("Spin","-spin",L,I,e,t),l=y(()=>{const{size:n}=e,{common:{cubicBezierEaseInOut:a},self:u}=v.value,{opacitySpinning:S,color:x,textColor:C}=u;return{"--n-bezier":a,"--n-opacity-spinning":S,"--n-size":typeof n=="number"?O(n):u[j("size",n)],"--n-color":x,"--n-text-color":C}}),s=o?$("spin",y(()=>{const{size:n}=e;return typeof n=="number"?String(n):n[0]}),l,e):void 0,d=D(e,["spinning","show"]),i=E(!1);return W(n=>{let a;if(d.value){const{delay:u}=e;if(u){a=window.setTimeout(()=>{i.value=!0},u),n(()=>{clearTimeout(a)});return}}i.value=d.value}),{mergedClsPrefix:t,active:i,mergedStrokeWidth:y(()=>{const{strokeWidth:n}=e;if(n!==void 0)return n;const{size:a}=e;return K[typeof a=="number"?"medium":a]}),cssVars:o?void 0:l,themeClass:s==null?void 0:s.themeClass,onRender:s==null?void 0:s.onRender}},render(){var d;const{$slots:e,mergedClsPrefix:t,description:o}=this,v=e.icon&&this.rotate,l=(o||e.description)&&(p(),m("div",{class:r(`${t}-spin-description`)},[f(()=>{var i;return o||((i=e.description)==null?void 0:i.call(e))})],2)),s=e.icon?(p(),m("div",{key:1,class:r([`${t}-spin-body`,this.themeClass])},[z("div",{class:r([`${t}-spin`,v&&`${t}-spin--rotate`]),style:h(e.default?"":this.cssVars)},[f(()=>e.icon())],6),f(()=>l)],2)):(p(),m("div",{key:2,class:r([`${t}-spin-body`,this.themeClass])},[(p(),B(P,{clsPrefix:t,style:h(e.default?"":this.cssVars),stroke:this.stroke,"stroke-width":this.mergedStrokeWidth,radius:this.radius,scale:this.scale,class:r(`${t}-spin`)},null,8,["clsPrefix","style","stroke","stroke-width","radius","scale","class"])),f(()=>l)],2));return(d=this.onRender)==null||d.call(this),e.default?(p(),m("div",{key:3,class:r([`${t}-spin-container`,this.themeClass]),style:h(this.cssVars)},[z("div",{class:r([`${t}-spin-content`,this.active&&`${t}-spin-content--spinning`,this.contentClass]),style:h(this.contentStyle)},[f(()=>{var i;return(i=e.default)==null?void 0:i.call(e)})],6),N(_,{name:"fade-in-transition"},{default:()=>this.active?s:null},1024)],6)):s}});export{U as S,D as u};
