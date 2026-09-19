import{D as go,ad as r,H as Co,K as v,L as k,J as I,G as P,d as bo,P as A,ag as j,i as z,c as B,R as m,T as x,b as uo,y as vo,az as po,S as K,V as fo,a7 as ko,W as mo,m as N,r as xo,am as zo,X as i,aG as yo,bP as G,a9 as So,aa as Io,a8 as Po}from"./index-IQ9LQd-5.js";var Bo={closeIconSizeTiny:"12px",closeIconSizeSmall:"12px",closeIconSizeMedium:"14px",closeIconSizeLarge:"14px",closeSizeTiny:"16px",closeSizeSmall:"16px",closeSizeMedium:"18px",closeSizeLarge:"18px",padding:"0 7px",closeMargin:"0 0 0 4px"};function $o(o){const{textColor2:g,primaryColorHover:b,primaryColorPressed:p,primaryColor:c,infoColor:n,successColor:a,warningColor:s,errorColor:t,baseColor:d,borderColor:f,opacityDisabled:$,tagColor:M,closeIconColor:y,closeIconColorHover:u,closeIconColorPressed:e,borderRadiusSmall:l,fontSizeMini:C,fontSizeTiny:h,fontSizeSmall:H,fontSizeMedium:T,heightMini:_,heightTiny:R,heightSmall:E,heightMedium:W,closeColorHover:w,closeColorPressed:F,buttonColor2Hover:L,buttonColor2Pressed:V,fontWeightStrong:D}=o;return{...Bo,closeBorderRadius:l,heightTiny:_,heightSmall:R,heightMedium:E,heightLarge:W,borderRadius:l,opacityDisabled:$,fontSizeTiny:C,fontSizeSmall:h,fontSizeMedium:H,fontSizeLarge:T,fontWeightStrong:D,textColorCheckable:g,textColorHoverCheckable:g,textColorPressedCheckable:g,textColorChecked:d,colorCheckable:"#0000",colorHoverCheckable:L,colorPressedCheckable:V,colorChecked:c,colorCheckedHover:b,colorCheckedPressed:p,border:`1px solid ${f}`,textColor:g,color:M,colorBordered:"rgb(250, 250, 252)",closeIconColor:y,closeIconColorHover:u,closeIconColorPressed:e,closeColorHover:w,closeColorPressed:F,borderPrimary:`1px solid ${r(c,{alpha:.3})}`,textColorPrimary:c,colorPrimary:r(c,{alpha:.12}),colorBorderedPrimary:r(c,{alpha:.1}),closeIconColorPrimary:c,closeIconColorHoverPrimary:c,closeIconColorPressedPrimary:c,closeColorHoverPrimary:r(c,{alpha:.12}),closeColorPressedPrimary:r(c,{alpha:.18}),borderInfo:`1px solid ${r(n,{alpha:.3})}`,textColorInfo:n,colorInfo:r(n,{alpha:.12}),colorBorderedInfo:r(n,{alpha:.1}),closeIconColorInfo:n,closeIconColorHoverInfo:n,closeIconColorPressedInfo:n,closeColorHoverInfo:r(n,{alpha:.12}),closeColorPressedInfo:r(n,{alpha:.18}),borderSuccess:`1px solid ${r(a,{alpha:.3})}`,textColorSuccess:a,colorSuccess:r(a,{alpha:.12}),colorBorderedSuccess:r(a,{alpha:.1}),closeIconColorSuccess:a,closeIconColorHoverSuccess:a,closeIconColorPressedSuccess:a,closeColorHoverSuccess:r(a,{alpha:.12}),closeColorPressedSuccess:r(a,{alpha:.18}),borderWarning:`1px solid ${r(s,{alpha:.35})}`,textColorWarning:s,colorWarning:r(s,{alpha:.15}),colorBorderedWarning:r(s,{alpha:.12}),closeIconColorWarning:s,closeIconColorHoverWarning:s,closeIconColorPressedWarning:s,closeColorHoverWarning:r(s,{alpha:.12}),closeColorPressedWarning:r(s,{alpha:.18}),borderError:`1px solid ${r(t,{alpha:.23})}`,textColorError:t,colorError:r(t,{alpha:.1}),colorBorderedError:r(t,{alpha:.08}),closeIconColorError:t,closeIconColorHoverError:t,closeIconColorPressedError:t,closeColorHoverError:r(t,{alpha:.12}),closeColorPressedError:r(t,{alpha:.18})}}const Mo={common:go,self:$o};var Ho={color:Object,type:{type:String,default:"default"},round:Boolean,size:String,closable:Boolean,disabled:{type:Boolean,default:void 0}},To=Co("tag",`
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
 `),k("border",`
 pointer-events: none;
 position: absolute;
 left: 0;
 right: 0;
 top: 0;
 bottom: 0;
 border-radius: inherit;
 border: var(--n-border);
 transition: border-color .3s var(--n-bezier);
 `),k("icon",`
 display: flex;
 margin: 0 4px 0 0;
 color: var(--n-text-color);
 transition: color .3s var(--n-bezier);
 font-size: var(--n-avatar-size-override);
 `),k("avatar",`
 display: flex;
 margin: 0 6px 0 0;
 `),k("close",`
 margin: var(--n-close-margin);
 transition:
 background-color .3s var(--n-bezier),
 color .3s var(--n-bezier);
 `),v("round",`
 padding: 0 calc(var(--n-height) / 3);
 border-radius: calc(var(--n-height) / 2);
 `,[k("icon",`
 margin: 0 4px 0 calc((var(--n-height) - 8px) / -2);
 `),k("avatar",`
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
 `,[I("disabled",[P("&:hover","background-color: var(--n-color-hover-checkable);",[I("checked","color: var(--n-text-color-hover-checkable);")]),P("&:active","background-color: var(--n-color-pressed-checkable);",[I("checked","color: var(--n-text-color-pressed-checkable);")])]),v("checked",`
 color: var(--n-text-color-checked);
 background-color: var(--n-color-checked);
 `,[I("disabled",[P("&:hover","background-color: var(--n-color-checked-hover);"),P("&:active","background-color: var(--n-color-checked-pressed);")])])])]);const _o=["onClick","onMouseenter","onMouseleave"],Ro={...A.props,...Ho,bordered:{type:Boolean,default:void 0},checked:Boolean,checkable:Boolean,strong:Boolean,triggerClickOnClose:Boolean,onClose:[Array,Function],onMouseenter:Function,onMouseleave:Function,"onUpdate:checked":Function,onUpdateChecked:Function,internalCloseFocusable:{type:Boolean,default:!0},internalCloseIsButtonTag:{type:Boolean,default:!0},onCheckedChange:Function},Eo=Po("n-tag");var wo=bo({name:"Tag",props:Ro,slots:Object,setup(o){const g=xo(null),{mergedBorderedRef:b,mergedClsPrefixRef:p,inlineThemeDisabled:c,mergedRtlRef:n,mergedComponentPropsRef:a}=fo(o),s=N(()=>{var e,l;return o.size||((l=(e=a==null?void 0:a.value)==null?void 0:e.Tag)==null?void 0:l.size)||"medium"}),t=A("Tag","-tag",To,Mo,o,p);So(Eo,{roundRef:Io(o,"round")});function d(){if(!o.disabled&&o.checkable){const{checked:e,onCheckedChange:l,onUpdateChecked:C,"onUpdate:checked":h}=o;C&&C(!e),h&&h(!e),l&&l(!e)}}function f(e){if(o.triggerClickOnClose||e.stopPropagation(),!o.disabled){const{onClose:l}=o;l&&zo(l,e)}}const $={setTextContent(e){const{value:l}=g;l&&(l.textContent=e)}},M=ko("Tag",n,p),y=N(()=>{const{type:e,color:{color:l,textColor:C}={}}=o,h=s.value,{common:{cubicBezierEaseInOut:H},self:{padding:T,closeMargin:_,borderRadius:R,opacityDisabled:E,textColorCheckable:W,textColorHoverCheckable:w,textColorPressedCheckable:F,textColorChecked:L,colorCheckable:V,colorHoverCheckable:D,colorPressedCheckable:J,colorChecked:X,colorCheckedHover:q,colorCheckedPressed:Q,closeBorderRadius:Y,fontWeightStrong:Z,[i("colorBordered",e)]:oo,[i("closeSize",h)]:eo,[i("closeIconSize",h)]:ro,[i("fontSize",h)]:lo,[i("height",h)]:O,[i("color",e)]:co,[i("textColor",e)]:ao,[i("border",e)]:no,[i("closeIconColor",e)]:U,[i("closeIconColorHover",e)]:so,[i("closeIconColorPressed",e)]:to,[i("closeColorHover",e)]:io,[i("closeColorPressed",e)]:ho}}=t.value,S=yo(_);return{"--n-font-weight-strong":Z,"--n-avatar-size-override":`calc(${O} - 8px)`,"--n-bezier":H,"--n-border-radius":R,"--n-border":no,"--n-close-icon-size":ro,"--n-close-color-pressed":ho,"--n-close-color-hover":io,"--n-close-border-radius":Y,"--n-close-icon-color":U,"--n-close-icon-color-hover":so,"--n-close-icon-color-pressed":to,"--n-close-icon-color-disabled":U,"--n-close-margin-top":S.top,"--n-close-margin-right":S.right,"--n-close-margin-bottom":S.bottom,"--n-close-margin-left":S.left,"--n-close-size":eo,"--n-color":l||(b.value?oo:co),"--n-color-checkable":V,"--n-color-checked":X,"--n-color-checked-hover":q,"--n-color-checked-pressed":Q,"--n-color-hover-checkable":D,"--n-color-pressed-checkable":J,"--n-font-size":lo,"--n-height":O,"--n-opacity-disabled":E,"--n-padding":T,"--n-text-color":C||ao,"--n-text-color-checkable":W,"--n-text-color-checked":L,"--n-text-color-hover-checkable":w,"--n-text-color-pressed-checkable":F}}),u=c?mo("tag",N(()=>{let e="";const{type:l,color:{color:C,textColor:h}={}}=o;return e+=l[0],e+=s.value[0],C&&(e+=`a${G(C)}`),h&&(e+=`b${G(h)}`),b.value&&(e+="c"),e}),y,o):void 0;return{...$,rtlEnabled:M,mergedClsPrefix:p,contentRef:g,mergedBordered:b,handleClick:d,handleCloseClick:f,cssVars:c?void 0:y,themeClass:u==null?void 0:u.themeClass,onRender:u==null?void 0:u.onRender}},render(){const{mergedClsPrefix:o,rtlEnabled:g,closable:b,color:{borderColor:p}={},round:c,onRender:n,$slots:a}=this;n==null||n();const s=j(a.avatar,d=>d&&(z(),B("div",{class:x(`${o}-tag__avatar`)},[m(()=>d)],2))),t=j(a.icon,d=>d&&(z(),B("div",{class:x(`${o}-tag__icon`)},[m(()=>d)],2)));return z(),B("div",{class:x([`${o}-tag`,this.themeClass,{[`${o}-tag--rtl`]:g,[`${o}-tag--strong`]:this.strong,[`${o}-tag--disabled`]:this.disabled,[`${o}-tag--checkable`]:this.checkable,[`${o}-tag--checked`]:this.checkable&&this.checked,[`${o}-tag--round`]:c,[`${o}-tag--avatar`]:s,[`${o}-tag--icon`]:t,[`${o}-tag--closable`]:b}]),style:K(this.cssVars),onClick:this.handleClick,onMouseenter:this.onMouseenter,onMouseleave:this.onMouseleave},[m(()=>t||s),uo("span",{class:x(`${o}-tag__content`),ref:"contentRef"},[m(()=>{var d,f;return(f=(d=this.$slots).default)==null?void 0:f.call(d)})],2),!this.checkable&&b?(z(),vo(po,{key:0,clsPrefix:o,class:x(`${o}-tag__close`),disabled:this.disabled,onClick:this.handleCloseClick,focusable:this.internalCloseFocusable,round:c,isButtonTag:this.internalCloseIsButtonTag,absolute:!0},null,8,["clsPrefix","class","disabled","onClick","focusable","round","isButtonTag"])):m(()=>null),!this.checkable&&this.mergedBordered?(z(),B("div",{key:2,class:x(`${o}-tag__border`),style:K({borderColor:p})},null,6)):m(()=>null)],46,_o)}});export{wo as T};
