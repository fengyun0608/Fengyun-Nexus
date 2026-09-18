import{D as S,E as _,G as m,H as s,K as p,L as h,N as W,O as K,d as w,P as $,i as t,c as i,T as n,R as o,S as k,V as E,a7 as P,W as T,m as B,a8 as N,a9 as G,aa as q,ab as A,ac as J,b as R,F as l}from"./index-BJIDpLGZ.js";function Q(r){const{textColor2:e,cardColor:d,modalColor:v,popoverColor:f,dividerColor:b,borderRadius:u,fontSize:g,hoverColor:c}=r;return{textColor:e,color:d,colorHover:c,colorModal:v,colorHoverModal:_(v,c),colorPopover:f,colorHoverPopover:_(f,c),borderColor:b,borderColorModal:_(v,b),borderColorPopover:_(f,b),borderRadius:u,fontSize:g}}const U={common:S,self:Q};function X(r){const{textColor1:e,textColor2:d,fontWeightStrong:v,fontSize:f}=r;return{fontSize:f,titleTextColor:e,textColor:d,titleFontWeight:v}}const Y={common:S,self:X};var Z=m([s("list",`
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
 `,[p("show-divider",[s("list-item",[m("&:not(:last-child)",[h("divider",`
 background-color: var(--n-merged-border-color);
 `)])])]),p("clickable",[s("list-item",`
 cursor: pointer;
 `)]),p("bordered",`
 border: 1px solid var(--n-merged-border-color);
 border-radius: var(--n-border-radius);
 `),p("hoverable",[s("list-item",`
 border-radius: var(--n-border-radius);
 `,[m("&:hover",`
 background-color: var(--n-merged-color-hover);
 `,[h("divider",`
 background-color: transparent;
 `)])])]),p("bordered, hoverable",[s("list-item",`
 padding: 12px 20px;
 `),h("header, footer",`
 padding: 12px 20px;
 `)]),h("header, footer",`
 padding: 12px 0;
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[m("&:not(:last-child)",`
 border-bottom: 1px solid var(--n-merged-border-color);
 `)]),s("list-item",`
 position: relative;
 padding: 12px 0; 
 box-sizing: border-box;
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[h("prefix",`
 margin-right: 20px;
 flex: 0;
 `),h("suffix",`
 margin-left: 20px;
 flex: 0;
 `),h("main",`
 flex: 1;
 `),h("divider",`
 height: 1px;
 position: absolute;
 bottom: 0;
 left: 0;
 right: 0;
 background-color: transparent;
 transition: background-color .3s var(--n-bezier);
 pointer-events: none;
 `)])]),W(s("list",`
 --n-merged-color-hover: var(--n-color-hover-modal);
 --n-merged-color: var(--n-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),K(s("list",`
 --n-merged-color-hover: var(--n-color-hover-popover);
 --n-merged-color: var(--n-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const H={...$.props,size:{type:String,default:"medium"},bordered:Boolean,clickable:Boolean,hoverable:Boolean,showDivider:{type:Boolean,default:!0}},j=N("n-list");var te=w({name:"List",props:H,slots:Object,setup(r){const{mergedClsPrefixRef:e,inlineThemeDisabled:d,mergedRtlRef:v}=E(r),f=P("List",v,e),b=$("List","-list",Z,U,r,e);G(j,{showDividerRef:q(r,"showDivider"),mergedClsPrefixRef:e});const u=B(()=>{const{common:{cubicBezierEaseInOut:c},self:{fontSize:a,textColor:y,color:x,colorModal:C,colorPopover:z,borderColor:D,borderColorModal:I,borderColorPopover:L,borderRadius:M,colorHover:O,colorHoverModal:V,colorHoverPopover:F}}=b.value;return{"--n-font-size":a,"--n-bezier":c,"--n-text-color":y,"--n-color":x,"--n-border-radius":M,"--n-border-color":D,"--n-border-color-modal":I,"--n-border-color-popover":L,"--n-color-modal":C,"--n-color-popover":z,"--n-color-hover":O,"--n-color-hover-modal":V,"--n-color-hover-popover":F}}),g=d?T("list",void 0,u,r):void 0;return{mergedClsPrefix:e,rtlEnabled:f,cssVars:d?void 0:u,themeClass:g==null?void 0:g.themeClass,onRender:g==null?void 0:g.onRender}},render(){const{$slots:r,mergedClsPrefix:e,onRender:d}=this;return d==null||d(),t(),i("ul",{class:n([`${e}-list`,this.rtlEnabled&&`${e}-list--rtl`,this.bordered&&`${e}-list--bordered`,this.showDivider&&`${e}-list--show-divider`,this.hoverable&&`${e}-list--hoverable`,this.clickable&&`${e}-list--clickable`,this.themeClass]),style:k(this.cssVars)},[r.header?(t(),i("div",{key:0,class:n(`${e}-list__header`)},[o(()=>r.header())],2)):o(()=>null),o(()=>{var v;return(v=r.default)==null?void 0:v.call(r)}),r.footer?(t(),i("div",{key:2,class:n(`${e}-list__footer`)},[o(()=>r.footer())],2)):o(()=>null)],6)}}),ie=w({name:"ListItem",slots:Object,setup(){const r=A(j,null);return r||J("list-item","`n-list-item` must be placed in `n-list`."),{showDivider:r.showDividerRef,mergedClsPrefix:r.mergedClsPrefixRef}},render(){const{$slots:r,mergedClsPrefix:e}=this;return t(),i("li",{class:n(`${e}-list-item`)},[r.prefix?(t(),i("div",{key:0,class:n(`${e}-list-item__prefix`)},[o(()=>r.prefix())],2)):o(()=>null),r.default?(t(),i("div",{key:2,class:n(`${e}-list-item__main`)},[o(()=>r.default())],2)):o(()=>null),r.suffix?(t(),i("div",{key:4,class:n(`${e}-list-item__suffix`)},[o(()=>r.suffix())],2)):o(()=>null),o(()=>this.showDivider&&(t(),i("div",{class:n(`${e}-list-item__divider`)},null,2)))],2)}}),ee=s("thing",`
 display: flex;
 transition: color .3s var(--n-bezier);
 font-size: var(--n-font-size);
 color: var(--n-text-color);
`,[s("thing-avatar",`
 margin-right: 12px;
 margin-top: 2px;
 `),s("thing-avatar-header-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 `,[s("thing-header-wrapper",`
 flex: 1;
 `)]),s("thing-main",`
 flex-grow: 1;
 `,[s("thing-header",`
 display: flex;
 margin-bottom: 4px;
 justify-content: space-between;
 align-items: center;
 `,[h("title",`
 font-size: 16px;
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 color: var(--n-title-text-color);
 `)]),h("description",[m("&:not(:last-child)",`
 margin-bottom: 4px;
 `)]),h("content",[m("&:not(:first-child)",`
 margin-top: 12px;
 `)]),h("footer",[m("&:not(:first-child)",`
 margin-top: 12px;
 `)]),h("action",[m("&:not(:first-child)",`
 margin-top: 12px;
 `)])])]);const re={...$.props,title:String,titleExtra:String,description:String,descriptionClass:String,descriptionStyle:[String,Object],content:String,contentClass:String,contentStyle:[String,Object],contentIndented:Boolean};var ne=w({name:"Thing",props:re,slots:Object,setup(r,{slots:e}){const{mergedClsPrefixRef:d,inlineThemeDisabled:v,mergedRtlRef:f}=E(r),b=$("Thing","-thing",ee,Y,r,d),u=P("Thing",f,d),g=B(()=>{const{self:{titleTextColor:a,textColor:y,titleFontWeight:x,fontSize:C},common:{cubicBezierEaseInOut:z}}=b.value;return{"--n-bezier":z,"--n-font-size":C,"--n-text-color":y,"--n-title-font-weight":x,"--n-title-text-color":a}}),c=v?T("thing",void 0,g,r):void 0;return()=>{var x;const{value:a}=d,y=u?u.value:!1;return(x=c==null?void 0:c.onRender)==null||x.call(c),t(),i("div",{class:n([`${a}-thing`,c==null?void 0:c.themeClass,y&&`${a}-thing--rtl`]),style:k(v?void 0:g.value)},[e.avatar&&r.contentIndented?(t(),i("div",{key:0,class:n(`${a}-thing-avatar`)},[o(()=>e.avatar())],2)):o(()=>null),R("div",{class:n(`${a}-thing-main`)},[!r.contentIndented&&(e.header||r.title||e["header-extra"]||r.titleExtra||e.avatar)?(t(),i("div",{key:0,class:n(`${a}-thing-avatar-header-wrapper`)},[e.avatar?(t(),i("div",{key:0,class:n(`${a}-thing-avatar`)},[o(()=>e.avatar())],2)):o(()=>null),e.header||r.title||e["header-extra"]||r.titleExtra?(t(),i("div",{key:2,class:n(`${a}-thing-header-wrapper`)},[R("div",{class:n(`${a}-thing-header`)},[e.header||r.title?(t(),i("div",{key:0,class:n(`${a}-thing-header__title`)},[e.header?(t(),i(l,{key:0},[o(()=>e.header())],64)):(t(),i(l,{key:1},[o(()=>r.title)],64))],2)):o(()=>null),e["header-extra"]||r.titleExtra?(t(),i("div",{key:2,class:n(`${a}-thing-header__extra`)},[e["header-extra"]?(t(),i(l,{key:0},[o(()=>e["header-extra"]())],64)):(t(),i(l,{key:1},[o(()=>r.titleExtra)],64))],2)):o(()=>null)],2),e.description||r.description?(t(),i("div",{key:0,class:n([`${a}-thing-main__description`,r.descriptionClass]),style:k(r.descriptionStyle)},[e.description?(t(),i(l,{key:0},[o(()=>e.description())],64)):(t(),i(l,{key:1},[o(()=>r.description)],64))],6)):o(()=>null)],2)):o(()=>null)],2)):(t(),i(l,{key:1},[e.header||r.title||e["header-extra"]||r.titleExtra?(t(),i("div",{key:0,class:n(`${a}-thing-header`)},[e.header||r.title?(t(),i("div",{key:0,class:n(`${a}-thing-header__title`)},[e.header?(t(),i(l,{key:0},[o(()=>e.header())],64)):(t(),i(l,{key:1},[o(()=>r.title)],64))],2)):o(()=>null),e["header-extra"]||r.titleExtra?(t(),i("div",{key:2,class:n(`${a}-thing-header__extra`)},[e["header-extra"]?(t(),i(l,{key:0},[o(()=>e["header-extra"]())],64)):(t(),i(l,{key:1},[o(()=>r.titleExtra)],64))],2)):o(()=>null)],2)):o(()=>null),e.description||r.description?(t(),i("div",{key:2,class:n([`${a}-thing-main__description`,r.descriptionClass]),style:k(r.descriptionStyle)},[e.description?(t(),i(l,{key:0},[o(()=>e.description())],64)):(t(),i(l,{key:1},[o(()=>r.description)],64))],6)):o(()=>null)],64)),e.default||r.content?(t(),i("div",{key:2,class:n([`${a}-thing-main__content`,r.contentClass]),style:k(r.contentStyle)},[e.default?(t(),i(l,{key:0},[o(()=>e.default())],64)):(t(),i(l,{key:1},[o(()=>r.content)],64))],6)):o(()=>null),e.footer?(t(),i("div",{key:4,class:n(`${a}-thing-main__footer`)},[o(()=>e.footer())],2)):o(()=>null),e.action?(t(),i("div",{key:6,class:n(`${a}-thing-main__action`)},[o(()=>e.action())],2)):o(()=>null)],2)],6)}}});export{ie as L,ne as T,te as a};
