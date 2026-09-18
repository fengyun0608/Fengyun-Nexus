import{D as g,E as d,H as x,J as c,K as M,L as F,d as w,N as p,i,c as o,R as n,P as t,Q as y,T as C,al as E,U as S,m as P,am as K,an as N,ao as q,ab as J,ap as Q,aq as U,b as R,F as l,ar as W}from"./index-DEfbyUx1.js";var A=g([d("list",`
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
 `,[x("show-divider",[d("list-item",[g("&:not(:last-child)",[c("divider",`
 background-color: var(--n-merged-border-color);
 `)])])]),x("clickable",[d("list-item",`
 cursor: pointer;
 `)]),x("bordered",`
 border: 1px solid var(--n-merged-border-color);
 border-radius: var(--n-border-radius);
 `),x("hoverable",[d("list-item",`
 border-radius: var(--n-border-radius);
 `,[g("&:hover",`
 background-color: var(--n-merged-color-hover);
 `,[c("divider",`
 background-color: transparent;
 `)])])]),x("bordered, hoverable",[d("list-item",`
 padding: 12px 20px;
 `),c("header, footer",`
 padding: 12px 20px;
 `)]),c("header, footer",`
 padding: 12px 0;
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[g("&:not(:last-child)",`
 border-bottom: 1px solid var(--n-merged-border-color);
 `)]),d("list-item",`
 position: relative;
 padding: 12px 0; 
 box-sizing: border-box;
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[c("prefix",`
 margin-right: 20px;
 flex: 0;
 `),c("suffix",`
 margin-left: 20px;
 flex: 0;
 `),c("main",`
 flex: 1;
 `),c("divider",`
 height: 1px;
 position: absolute;
 bottom: 0;
 left: 0;
 right: 0;
 background-color: transparent;
 transition: background-color .3s var(--n-bezier);
 pointer-events: none;
 `)])]),M(d("list",`
 --n-merged-color-hover: var(--n-color-hover-modal);
 --n-merged-color: var(--n-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),F(d("list",`
 --n-merged-color-hover: var(--n-color-hover-popover);
 --n-merged-color: var(--n-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const G={...p.props,size:{type:String,default:"medium"},bordered:Boolean,clickable:Boolean,hoverable:Boolean,showDivider:{type:Boolean,default:!0}},B=K("n-list");var H=w({name:"List",props:G,slots:Object,setup(r){const{mergedClsPrefixRef:e,inlineThemeDisabled:s,mergedRtlRef:f}=C(r),k=E("List",f,e),_=p("List","-list",A,N,r,e);q(B,{showDividerRef:J(r,"showDivider"),mergedClsPrefixRef:e});const b=P(()=>{const{common:{cubicBezierEaseInOut:v},self:{fontSize:a,textColor:u,color:m,colorModal:$,colorPopover:z,borderColor:T,borderColorModal:j,borderColorPopover:D,borderRadius:I,colorHover:L,colorHoverModal:O,colorHoverPopover:V}}=_.value;return{"--n-font-size":a,"--n-bezier":v,"--n-text-color":u,"--n-color":m,"--n-border-radius":I,"--n-border-color":T,"--n-border-color-modal":j,"--n-border-color-popover":D,"--n-color-modal":$,"--n-color-popover":z,"--n-color-hover":L,"--n-color-hover-modal":O,"--n-color-hover-popover":V}}),h=s?S("list",void 0,b,r):void 0;return{mergedClsPrefix:e,rtlEnabled:k,cssVars:s?void 0:b,themeClass:h==null?void 0:h.themeClass,onRender:h==null?void 0:h.onRender}},render(){const{$slots:r,mergedClsPrefix:e,onRender:s}=this;return s==null||s(),i(),o("ul",{class:n([`${e}-list`,this.rtlEnabled&&`${e}-list--rtl`,this.bordered&&`${e}-list--bordered`,this.showDivider&&`${e}-list--show-divider`,this.hoverable&&`${e}-list--hoverable`,this.clickable&&`${e}-list--clickable`,this.themeClass]),style:y(this.cssVars)},[r.header?(i(),o("div",{key:0,class:n(`${e}-list__header`)},[t(()=>r.header())],2)):t(()=>null),t(()=>{var f;return(f=r.default)==null?void 0:f.call(r)}),r.footer?(i(),o("div",{key:2,class:n(`${e}-list__footer`)},[t(()=>r.footer())],2)):t(()=>null)],6)}}),ee=w({name:"ListItem",slots:Object,setup(){const r=Q(B,null);return r||U("list-item","`n-list-item` must be placed in `n-list`."),{showDivider:r.showDividerRef,mergedClsPrefix:r.mergedClsPrefixRef}},render(){const{$slots:r,mergedClsPrefix:e}=this;return i(),o("li",{class:n(`${e}-list-item`)},[r.prefix?(i(),o("div",{key:0,class:n(`${e}-list-item__prefix`)},[t(()=>r.prefix())],2)):t(()=>null),r.default?(i(),o("div",{key:2,class:n(`${e}-list-item__main`)},[t(()=>r.default())],2)):t(()=>null),r.suffix?(i(),o("div",{key:4,class:n(`${e}-list-item__suffix`)},[t(()=>r.suffix())],2)):t(()=>null),t(()=>this.showDivider&&(i(),o("div",{class:n(`${e}-list-item__divider`)},null,2)))],2)}}),X=d("thing",`
 display: flex;
 transition: color .3s var(--n-bezier);
 font-size: var(--n-font-size);
 color: var(--n-text-color);
`,[d("thing-avatar",`
 margin-right: 12px;
 margin-top: 2px;
 `),d("thing-avatar-header-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 `,[d("thing-header-wrapper",`
 flex: 1;
 `)]),d("thing-main",`
 flex-grow: 1;
 `,[d("thing-header",`
 display: flex;
 margin-bottom: 4px;
 justify-content: space-between;
 align-items: center;
 `,[c("title",`
 font-size: 16px;
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 color: var(--n-title-text-color);
 `)]),c("description",[g("&:not(:last-child)",`
 margin-bottom: 4px;
 `)]),c("content",[g("&:not(:first-child)",`
 margin-top: 12px;
 `)]),c("footer",[g("&:not(:first-child)",`
 margin-top: 12px;
 `)]),c("action",[g("&:not(:first-child)",`
 margin-top: 12px;
 `)])])]);const Y={...p.props,title:String,titleExtra:String,description:String,descriptionClass:String,descriptionStyle:[String,Object],content:String,contentClass:String,contentStyle:[String,Object],contentIndented:Boolean};var re=w({name:"Thing",props:Y,slots:Object,setup(r,{slots:e}){const{mergedClsPrefixRef:s,inlineThemeDisabled:f,mergedRtlRef:k}=C(r),_=p("Thing","-thing",X,W,r,s),b=E("Thing",k,s),h=P(()=>{const{self:{titleTextColor:a,textColor:u,titleFontWeight:m,fontSize:$},common:{cubicBezierEaseInOut:z}}=_.value;return{"--n-bezier":z,"--n-font-size":$,"--n-text-color":u,"--n-title-font-weight":m,"--n-title-text-color":a}}),v=f?S("thing",void 0,h,r):void 0;return()=>{var m;const{value:a}=s,u=b?b.value:!1;return(m=v==null?void 0:v.onRender)==null||m.call(v),i(),o("div",{class:n([`${a}-thing`,v==null?void 0:v.themeClass,u&&`${a}-thing--rtl`]),style:y(f?void 0:h.value)},[e.avatar&&r.contentIndented?(i(),o("div",{key:0,class:n(`${a}-thing-avatar`)},[t(()=>e.avatar())],2)):t(()=>null),R("div",{class:n(`${a}-thing-main`)},[!r.contentIndented&&(e.header||r.title||e["header-extra"]||r.titleExtra||e.avatar)?(i(),o("div",{key:0,class:n(`${a}-thing-avatar-header-wrapper`)},[e.avatar?(i(),o("div",{key:0,class:n(`${a}-thing-avatar`)},[t(()=>e.avatar())],2)):t(()=>null),e.header||r.title||e["header-extra"]||r.titleExtra?(i(),o("div",{key:2,class:n(`${a}-thing-header-wrapper`)},[R("div",{class:n(`${a}-thing-header`)},[e.header||r.title?(i(),o("div",{key:0,class:n(`${a}-thing-header__title`)},[e.header?(i(),o(l,{key:0},[t(()=>e.header())],64)):(i(),o(l,{key:1},[t(()=>r.title)],64))],2)):t(()=>null),e["header-extra"]||r.titleExtra?(i(),o("div",{key:2,class:n(`${a}-thing-header__extra`)},[e["header-extra"]?(i(),o(l,{key:0},[t(()=>e["header-extra"]())],64)):(i(),o(l,{key:1},[t(()=>r.titleExtra)],64))],2)):t(()=>null)],2),e.description||r.description?(i(),o("div",{key:0,class:n([`${a}-thing-main__description`,r.descriptionClass]),style:y(r.descriptionStyle)},[e.description?(i(),o(l,{key:0},[t(()=>e.description())],64)):(i(),o(l,{key:1},[t(()=>r.description)],64))],6)):t(()=>null)],2)):t(()=>null)],2)):(i(),o(l,{key:1},[e.header||r.title||e["header-extra"]||r.titleExtra?(i(),o("div",{key:0,class:n(`${a}-thing-header`)},[e.header||r.title?(i(),o("div",{key:0,class:n(`${a}-thing-header__title`)},[e.header?(i(),o(l,{key:0},[t(()=>e.header())],64)):(i(),o(l,{key:1},[t(()=>r.title)],64))],2)):t(()=>null),e["header-extra"]||r.titleExtra?(i(),o("div",{key:2,class:n(`${a}-thing-header__extra`)},[e["header-extra"]?(i(),o(l,{key:0},[t(()=>e["header-extra"]())],64)):(i(),o(l,{key:1},[t(()=>r.titleExtra)],64))],2)):t(()=>null)],2)):t(()=>null),e.description||r.description?(i(),o("div",{key:2,class:n([`${a}-thing-main__description`,r.descriptionClass]),style:y(r.descriptionStyle)},[e.description?(i(),o(l,{key:0},[t(()=>e.description())],64)):(i(),o(l,{key:1},[t(()=>r.description)],64))],6)):t(()=>null)],64)),e.default||r.content?(i(),o("div",{key:2,class:n([`${a}-thing-main__content`,r.contentClass]),style:y(r.contentStyle)},[e.default?(i(),o(l,{key:0},[t(()=>e.default())],64)):(i(),o(l,{key:1},[t(()=>r.content)],64))],6)):t(()=>null),e.footer?(i(),o("div",{key:4,class:n(`${a}-thing-main__footer`)},[t(()=>e.footer())],2)):t(()=>null),e.action?(i(),o("div",{key:6,class:n(`${a}-thing-main__action`)},[t(()=>e.action())],2)):t(()=>null)],2)],6)}}});export{ee as L,re as T,H as a};
