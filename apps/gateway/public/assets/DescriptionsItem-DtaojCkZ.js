import{H as g,D as e,K,J as k,E as L,a4 as W,a5 as J,d as F,L as N,a6 as Q,h as c,c as p,O as s,V as f,Q as n,b as I,a7 as Z,W as q,Z as U,v as M,a8 as X,a0 as j}from"./index-BNznTPQ6.js";import{g as Y}from"./Space-0d71OF7y.js";import{u as H}from"./Spin-B8P8q3p7.js";function V(t,u="default",b=[]){const{children:l}=t;if(l!==null&&typeof l=="object"&&!Array.isArray(l)){const i=l[u];if(typeof i=="function")return i()}return b}var ee=g([e("descriptions",{fontSize:"var(--n-font-size)"},[e("descriptions-separator",`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),e("descriptions-table-wrapper",[e("descriptions-table",[e("descriptions-table-row",[e("descriptions-table-header",{padding:"var(--n-th-padding)"}),e("descriptions-table-content",{padding:"var(--n-td-padding)"})])])]),K("bordered",[e("descriptions-table-wrapper",[e("descriptions-table",[e("descriptions-table-row",[g("&:last-child",[e("descriptions-table-content",{paddingBottom:0})])])])])]),k("left-label-placement",[e("descriptions-table-content",[g("> *",{verticalAlign:"top"})])]),k("left-label-align",[g("th",{textAlign:"left"})]),k("center-label-align",[g("th",{textAlign:"center"})]),k("right-label-align",[g("th",{textAlign:"right"})]),k("bordered",[e("descriptions-table-wrapper",`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[e("descriptions-table",[e("descriptions-table-row",[g("&:not(:last-child)",[e("descriptions-table-content",{borderBottom:"1px solid var(--n-merged-border-color)"}),e("descriptions-table-header",{borderBottom:"1px solid var(--n-merged-border-color)"})]),e("descriptions-table-header",`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[g("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})]),e("descriptions-table-content",[g("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})])])])])]),e("descriptions-header",`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),e("descriptions-table-wrapper",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[e("descriptions-table",`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[e("descriptions-table-row",`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[e("descriptions-table-header",`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),e("descriptions-table-content",`
 vertical-align: top;
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-td-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[L("content",`
 transition: color .3s var(--n-bezier);
 display: inline-block;
 color: var(--n-td-text-color);
 `)]),L("label",`
 font-weight: var(--n-th-font-weight);
 transition: color .3s var(--n-bezier);
 display: inline-block;
 margin-right: 14px;
 color: var(--n-th-text-color);
 `)])])])]),e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),W(e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),J(e("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const oe="DESCRIPTION_ITEM_FLAG";function re(t){return typeof t=="object"&&t&&!Array.isArray(t)?t.type&&t.type.DESCRIPTION_ITEM_FLAG:!1}const te=["colspan"],ne=["colspan"],se=["colspan"],le=["colspan"],ie={...N.props,title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:"top"},labelAlign:{type:String,default:"left"},separator:{type:String,default:":"},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var be=F({name:"Descriptions",props:ie,slots:Object,setup(t){const{mergedClsPrefixRef:u,inlineThemeDisabled:b,mergedComponentPropsRef:l}=q(t),i=M(()=>{var a,d;return t.size||((d=(a=l==null?void 0:l.value)==null?void 0:a.Descriptions)==null?void 0:d.size)||"medium"}),v=N("Descriptions","-descriptions",ee,X,t,u),R=M(()=>{const{bordered:a}=t,d=i.value,{common:{cubicBezierEaseInOut:B},self:{titleTextColor:r,thColor:A,thColorModal:S,thColorPopover:D,thTextColor:O,thFontWeight:o,tdTextColor:x,tdColor:E,tdColorModal:h,tdColorPopover:y,borderColor:z,borderColorModal:C,borderColorPopover:w,borderRadius:$,lineHeight:_,[j("fontSize",d)]:P,[j(a?"thPaddingBordered":"thPadding",d)]:T,[j(a?"tdPaddingBordered":"tdPadding",d)]:G}}=v.value;return{"--n-title-text-color":r,"--n-th-padding":T,"--n-td-padding":G,"--n-font-size":P,"--n-bezier":B,"--n-th-font-weight":o,"--n-line-height":_,"--n-th-text-color":O,"--n-td-text-color":x,"--n-th-color":A,"--n-th-color-modal":S,"--n-th-color-popover":D,"--n-td-color":E,"--n-td-color-modal":h,"--n-td-color-popover":y,"--n-border-radius":$,"--n-border-color":z,"--n-border-color-modal":C,"--n-border-color-popover":w}}),m=b?U("descriptions",M(()=>{let a="";const{bordered:d}=t;return d&&(a+="a"),a+=i.value[0],a}),R,t):void 0;return{mergedClsPrefix:u,cssVars:b?void 0:R,themeClass:m==null?void 0:m.themeClass,onRender:m==null?void 0:m.onRender,compitableColumn:H(t,["columns","column"]),inlineThemeDisabled:b,mergedSize:i}},render(){const t=this.$slots.default,u=t?Q(t()):[];u.length;const{contentClass:b,labelClass:l,compitableColumn:i,labelPlacement:v,labelAlign:R,mergedSize:m,bordered:a,title:d,cssVars:B,mergedClsPrefix:r,separator:A,onRender:S}=this;S==null||S();const D=u.filter(o=>re(o)),O=D.reduce((o,x,E)=>{const h=x.props||{},y=D.length-1===E,z=["label"in h?h.label:V(x,"label")],C=[V(x)],w=h.span||1,$=o.span;o.span+=w;const _=h.labelStyle||h["label-style"]||this.labelStyle,P=h.contentStyle||h["content-style"]||this.contentStyle;if(v==="left")a?o.row.push((c(),p("th",{key:1,class:n([`${r}-descriptions-table-header`,l]),colspan:1,style:f(_)},[s(()=>z)],6)),(c(),p("td",{key:2,class:n([`${r}-descriptions-table-content`,b]),colspan:y?(i-$)*2+1:w*2-1,style:f(P)},[s(()=>C)],14,te))):o.row.push((c(),p("td",{key:3,class:n(`${r}-descriptions-table-content`),colspan:y?(i-$)*2:w*2},[I("span",{class:n([`${r}-descriptions-table-content__label`,l]),style:f(_)},[s(()=>[...z,A&&(c(),p("span",{key:4,class:n(`${r}-descriptions-separator`)},[s(()=>A)],2))])],6),I("span",{class:n([`${r}-descriptions-table-content__content`,b]),style:f(P)},[s(()=>C)],6)],10,ne)));else{const T=y?(i-$)*2:w*2;o.row.push((c(),p("th",{key:5,class:n([`${r}-descriptions-table-header`,l]),colspan:T,style:f(_)},[s(()=>z)],14,se))),o.secondRow.push((c(),p("td",{key:6,class:n([`${r}-descriptions-table-content`,b]),colspan:T,style:f(P)},[s(()=>C)],14,le)))}return(o.span>=i||y)&&(o.span=0,o.row.length&&(o.rows.push(o.row),o.row=[]),v!=="left"&&o.secondRow.length&&(o.rows.push(o.secondRow),o.secondRow=[])),o},{span:0,row:[],secondRow:[],rows:[]}).rows.map(o=>(c(),p("tr",{class:n(`${r}-descriptions-table-row`)},[s(()=>o)],2)));return c(),p("div",{style:f(B),class:n([`${r}-descriptions`,this.themeClass,`${r}-descriptions--${v}-label-placement`,`${r}-descriptions--${R}-label-align`,`${r}-descriptions--${m}-size`,a&&`${r}-descriptions--bordered`])},[d||this.$slots.header?(c(),p("div",{key:0,class:n(`${r}-descriptions-header`)},[s(()=>d||Y(this,"header"))],2)):s(()=>null),I("div",{class:n(`${r}-descriptions-table-wrapper`)},[I("table",{class:n(`${r}-descriptions-table`)},[I("tbody",null,[s(()=>v==="top"&&(c(),p("tr",{class:n(`${r}-descriptions-table-row`),style:{visibility:"collapse"}},[s(()=>Z(i*2,(c(),p("td"))))],2))),s(()=>O)])],2)],2)],6)}});const ae={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var he=F({name:"DescriptionsItem",[oe]:!0,props:ae,slots:Object,render(){return null}});export{be as D,he as a};
