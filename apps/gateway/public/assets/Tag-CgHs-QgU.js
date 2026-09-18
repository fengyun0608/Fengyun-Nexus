import{V as go,bN as Co,X as r,A as bo,D as v,E as p,C as P,z as S,d as uo,J,$ as L,i as y,c as B,L as m,O as x,b as vo,a0 as fo,bH as ko,N as A,Q as po,aj as mo,R as xo,m as j,r as yo,a6 as zo,T as i,bA as Io,bO as K,am as Po,a9 as So,ak as Bo}from"./index-CRGumLxm.js";function $o(o){const{textColor2:g,primaryColorHover:b,primaryColorPressed:f,primaryColor:c,infoColor:n,successColor:a,warningColor:s,errorColor:t,baseColor:d,borderColor:k,opacityDisabled:$,tagColor:H,closeIconColor:z,closeIconColorHover:u,closeIconColorPressed:e,borderRadiusSmall:l,fontSizeMini:C,fontSizeTiny:h,fontSizeSmall:_,fontSizeMedium:M,heightMini:T,heightTiny:R,heightSmall:E,heightMedium:W,closeColorHover:w,closeColorPressed:F,buttonColor2Hover:N,buttonColor2Pressed:O,fontWeightStrong:V}=o;return{...Co,closeBorderRadius:l,heightTiny:T,heightSmall:R,heightMedium:E,heightLarge:W,borderRadius:l,opacityDisabled:$,fontSizeTiny:C,fontSizeSmall:h,fontSizeMedium:_,fontSizeLarge:M,fontWeightStrong:V,textColorCheckable:g,textColorHoverCheckable:g,textColorPressedCheckable:g,textColorChecked:d,colorCheckable:"#0000",colorHoverCheckable:N,colorPressedCheckable:O,colorChecked:c,colorCheckedHover:b,colorCheckedPressed:f,border:`1px solid ${k}`,textColor:g,color:H,colorBordered:"rgb(250, 250, 252)",closeIconColor:z,closeIconColorHover:u,closeIconColorPressed:e,closeColorHover:w,closeColorPressed:F,borderPrimary:`1px solid ${r(c,{alpha:.3})}`,textColorPrimary:c,colorPrimary:r(c,{alpha:.12}),colorBorderedPrimary:r(c,{alpha:.1}),closeIconColorPrimary:c,closeIconColorHoverPrimary:c,closeIconColorPressedPrimary:c,closeColorHoverPrimary:r(c,{alpha:.12}),closeColorPressedPrimary:r(c,{alpha:.18}),borderInfo:`1px solid ${r(n,{alpha:.3})}`,textColorInfo:n,colorInfo:r(n,{alpha:.12}),colorBorderedInfo:r(n,{alpha:.1}),closeIconColorInfo:n,closeIconColorHoverInfo:n,closeIconColorPressedInfo:n,closeColorHoverInfo:r(n,{alpha:.12}),closeColorPressedInfo:r(n,{alpha:.18}),borderSuccess:`1px solid ${r(a,{alpha:.3})}`,textColorSuccess:a,colorSuccess:r(a,{alpha:.12}),colorBorderedSuccess:r(a,{alpha:.1}),closeIconColorSuccess:a,closeIconColorHoverSuccess:a,closeIconColorPressedSuccess:a,closeColorHoverSuccess:r(a,{alpha:.12}),closeColorPressedSuccess:r(a,{alpha:.18}),borderWarning:`1px solid ${r(s,{alpha:.35})}`,textColorWarning:s,colorWarning:r(s,{alpha:.15}),colorBorderedWarning:r(s,{alpha:.12}),closeIconColorWarning:s,closeIconColorHoverWarning:s,closeIconColorPressedWarning:s,closeColorHoverWarning:r(s,{alpha:.12}),closeColorPressedWarning:r(s,{alpha:.18}),borderError:`1px solid ${r(t,{alpha:.23})}`,textColorError:t,colorError:r(t,{alpha:.1}),colorBorderedError:r(t,{alpha:.08}),closeIconColorError:t,closeIconColorHoverError:t,closeIconColorPressedError:t,closeColorHoverError:r(t,{alpha:.12}),closeColorPressedError:r(t,{alpha:.18})}}const Ho={common:go,self:$o};var _o={color:Object,type:{type:String,default:"default"},round:Boolean,size:String,closable:Boolean,disabled:{type:Boolean,default:void 0}},Mo=bo("tag",`
 --n-close-margin: var(--n-close-margin-top) var(--n-close-margin-right) var(--n-close-margin-bottom) var(--n-close-margin-left);
 white-space: nowrap;
 position: relative;
 box-sizing: border-box;
 cursor: default;
 display: inline-flex;
 align-items: center;
 flex-wrap: nowrap;
 padding: var(--n-padding);
 border-radius: var(--n-border-radius);
 color: var(--n-text-color);
 background-color: var(--n-color);
 transition: 
 border-color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier),
 box-shadow .3s var(--n-bezier),
 opacity .3s var(--n-bezier);
 line-height: 1;
 height: var(--n-height);
 font-size: var(--n-font-size);
`,[v("strong",`
 font-weight: var(--n-font-weight-strong);
 `),p("border",`
 pointer-events: none;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 border-radius: inherit;
 border: var(--n-border);
 transition: border-color .3s var(--n-bezier);
 `),p("icon",`
 display: flex;
 margin: 0 4px 0 0;
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 font-size: var(--n-avatar-size-override);
 `),p("avatar",`
 display: flex;
 margin: 0 6px 0 0;
 `),p("close",`
 margin: var(--n-close-margin);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),v("round",`
 padding: 0 calc(var(--n-height) / 3);
 border-radius: calc(var(--n-height) / 2);
 `,[p("icon",`
 margin: 0 4px 0 calc((var(--n-height) - 8px) / -2);
 `),p("avatar",`
 margin: 0 6px 0 calc((var(--n-height) - 8px) / -2);
 `),v("closable",`
 padding: 0 calc(var(--n-height) / 4) 0 calc(var(--n-height) / 3);
 `)]),v("icon, avatar",[v("round",`
 padding: 0 calc(var(--n-height) / 3) 0 calc(var(--n-height) / 2);
 `)]),v("disabled",`
 cursor: not-allowed !important;
 opacity: var(--n-opacity-disabled);
 `),v("checkable",`
 cursor: pointer;
 box-shadow: none;
 color: var(--n-text-color-checkable);
 background-color: var(--n-color-checkable);
 `,[P("disabled",[S("&:hover","background-color: var(--n-color-hover-checkable);",[P("checked","color: var(--n-text-color-hover-checkable);")]),S("&:active","background-color: var(--n-color-pressed-checkable);",[P("checked","color: var(--n-text-color-pressed-checkable);")])]),v("checked",`
 color: var(--n-text-color-checked);
 background-color: var(--n-color-checked);
 `,[P("disabled",[S("&:hover","background-color: var(--n-color-checked-hover);"),S("&:active","background-color: var(--n-color-checked-pressed);")])])])]);const To=["onClick","onMouseenter","onMouseleave"],Ro={...J.props,..._o,bordered:{type:Boolean,default:void 0},checked:Boolean,checkable:Boolean,strong:Boolean,triggerClickOnClose:Boolean,onClose:[Array,Function],onMouseenter:Function,onMouseleave:Function,"onUpdate:checked":Function,onUpdateChecked:Function,internalCloseFocusable:{type:Boolean,default:!0},internalCloseIsButtonTag:{type:Boolean,default:!0},onCheckedChange:Function},Eo=Bo("n-tag");var wo=uo({name:"Tag",props:Ro,slots:Object,setup(o){const g=yo(null),{mergedBorderedRef:b,mergedClsPrefixRef:f,inlineThemeDisabled:c,mergedRtlRef:n,mergedComponentPropsRef:a}=po(o),s=j(()=>{var e,l;return o.size||((l=(e=a==null?void 0:a.value)==null?void 0:e.Tag)==null?void 0:l.size)||"medium"}),t=J("Tag","-tag",Mo,Ho,o,f);Po(Eo,{roundRef:So(o,"round")});function d(){if(!o.disabled&&o.checkable){const{checked:e,onCheckedChange:l,onUpdateChecked:C,"onUpdate:checked":h}=o;C&&C(!e),h&&h(!e),l&&l(!e)}}function k(e){if(o.triggerClickOnClose||e.stopPropagation(),!o.disabled){const{onClose:l}=o;l&&zo(l,e)}}const $={setTextContent(e){const{value:l}=g;l&&(l.textContent=e)}},H=mo("Tag",n,f),z=j(()=>{const{type:e,color:{color:l,textColor:C}={}}=o,h=s.value,{common:{cubicBezierEaseInOut:_},self:{padding:M,closeMargin:T,borderRadius:R,opacityDisabled:E,textColorCheckable:W,textColorHoverCheckable:w,textColorPressedCheckable:F,textColorChecked:N,colorCheckable:O,colorHoverCheckable:V,colorPressedCheckable:Q,colorChecked:X,colorCheckedHover:q,colorCheckedPressed:G,closeBorderRadius:Y,fontWeightStrong:Z,[i("colorBordered",e)]:oo,[i("closeSize",h)]:eo,[i("closeIconSize",h)]:ro,[i("fontSize",h)]:lo,[i("height",h)]:D,[i("color",e)]:co,[i("textColor",e)]:ao,[i("border",e)]:no,[i("closeIconColor",e)]:U,[i("closeIconColorHover",e)]:so,[i("closeIconColorPressed",e)]:to,[i("closeColorHover",e)]:io,[i("closeColorPressed",e)]:ho}}=t.value,I=Io(T);return{"--n-font-weight-strong":Z,"--n-avatar-size-override":`calc(${D} - 8px)`,"--n-bezier":_,"--n-border-radius":R,"--n-border":no,"--n-close-icon-size":ro,"--n-close-color-pressed":ho,"--n-close-color-hover":io,"--n-close-border-radius":Y,"--n-close-icon-color":U,"--n-close-icon-color-hover":so,"--n-close-icon-color-pressed":to,"--n-close-icon-color-disabled":U,"--n-close-margin-top":I.top,"--n-close-margin-right":I.right,"--n-close-margin-bottom":I.bottom,"--n-close-margin-left":I.left,"--n-close-size":eo,"--n-color":l||(b.value?oo:co),"--n-color-checkable":O,"--n-color-checked":X,"--n-color-checked-hover":q,"--n-color-checked-pressed":G,"--n-color-hover-checkable":V,"--n-color-pressed-checkable":Q,"--n-font-size":lo,"--n-height":D,"--n-opacity-disabled":E,"--n-padding":M,"--n-text-color":C||ao,"--n-text-color-checkable":W,"--n-text-color-checked":N,"--n-text-color-hover-checkable":w,"--n-text-color-pressed-checkable":F}}),u=c?xo("tag",j(()=>{let e="";const{type:l,color:{color:C,textColor:h}={}}=o;return e+=l[0],e+=s.value[0],C&&(e+=`a${K(C)}`),h&&(e+=`b${K(h)}`),b.value&&(e+="c"),e}),z,o):void 0;return{...$,rtlEnabled:H,mergedClsPrefix:f,contentRef:g,mergedBordered:b,handleClick:d,handleCloseClick:k,cssVars:c?void 0:z,themeClass:u==null?void 0:u.themeClass,onRender:u==null?void 0:u.onRender}},render(){const{mergedClsPrefix:o,rtlEnabled:g,closable:b,color:{borderColor:f}={},round:c,onRender:n,$slots:a}=this;n==null||n();const s=L(a.avatar,d=>d&&(y(),B("div",{class:x(`${o}-tag__avatar`)},[m(()=>d)],2))),t=L(a.icon,d=>d&&(y(),B("div",{class:x(`${o}-tag__icon`)},[m(()=>d)],2)));return y(),B("div",{class:x([`${o}-tag`,this.themeClass,{[`${o}-tag--rtl`]:g,[`${o}-tag--strong`]:this.strong,[`${o}-tag--disabled`]:this.disabled,[`${o}-tag--checkable`]:this.checkable,[`${o}-tag--checked`]:this.checkable&&this.checked,[`${o}-tag--round`]:c,[`${o}-tag--avatar`]:s,[`${o}-tag--icon`]:t,[`${o}-tag--closable`]:b}]),style:A(this.cssVars),onClick:this.handleClick,onMouseenter:this.onMouseenter,onMouseleave:this.onMouseleave},[m(()=>t||s),vo("span",{class:x(`${o}-tag__content`),ref:"contentRef"},[m(()=>{var d,k;return(k=(d=this.$slots).default)==null?void 0:k.call(d)})],2),!this.checkable&&b?(y(),fo(ko,{key:0,clsPrefix:o,class:x(`${o}-tag__close`),disabled:this.disabled,onClick:this.handleCloseClick,focusable:this.internalCloseFocusable,round:c,isButtonTag:this.internalCloseIsButtonTag,absolute:!0},null,8,["clsPrefix","class","disabled","onClick","focusable","round","isButtonTag"])):m(()=>null),!this.checkable&&this.mergedBordered?(y(),B("div",{key:2,class:x(`${o}-tag__border`),style:A({borderColor:f})},null,6)):m(()=>null)],46,To)}});export{wo as T};
