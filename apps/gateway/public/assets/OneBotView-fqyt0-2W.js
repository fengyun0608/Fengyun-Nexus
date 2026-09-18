import{T as te}from"./Tag-BpUu1nWi.js";import{D as P,E as o,G as oe,H as j,J as K,K as re,L as le,d as J,N as Z,O as ne,i as v,c as g,P as m,Q as I,R as u,b as S,S as se,T as ae,U as ie,m as U,V as de,W as G,u as ce,n as pe,o as be,e as p,f as w,g as b,r as T,h as H,t as N,F as ue,X,j as z,I as Q,B as q,_ as ve}from"./index-DEfbyUx1.js";import{g as ge,S as he}from"./Space-DUeTYuaJ.js";import{u as fe,S as me}from"./Spin-A-6jq-xV.js";import{S as ye}from"./Switch-DhoG5VP5.js";function Y(s,_="default",y=[]){const{children:i}=s;if(i!==null&&typeof i=="object"&&!Array.isArray(i)){const d=i[_];if(typeof d=="function")return d()}return y}var we=P([o("descriptions",{fontSize:"var(--n-font-size)"},[o("descriptions-separator",`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),o("descriptions-table-wrapper",[o("descriptions-table",[o("descriptions-table-row",[o("descriptions-table-header",{padding:"var(--n-th-padding)"}),o("descriptions-table-content",{padding:"var(--n-td-padding)"})])])]),oe("bordered",[o("descriptions-table-wrapper",[o("descriptions-table",[o("descriptions-table-row",[P("&:last-child",[o("descriptions-table-content",{paddingBottom:0})])])])])]),j("left-label-placement",[o("descriptions-table-content",[P("> *",{verticalAlign:"top"})])]),j("left-label-align",[P("th",{textAlign:"left"})]),j("center-label-align",[P("th",{textAlign:"center"})]),j("right-label-align",[P("th",{textAlign:"right"})]),j("bordered",[o("descriptions-table-wrapper",`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[o("descriptions-table",[o("descriptions-table-row",[P("&:not(:last-child)",[o("descriptions-table-content",{borderBottom:"1px solid var(--n-merged-border-color)"}),o("descriptions-table-header",{borderBottom:"1px solid var(--n-merged-border-color)"})]),o("descriptions-table-header",`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[P("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})]),o("descriptions-table-content",[P("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})])])])])]),o("descriptions-header",`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),o("descriptions-table-wrapper",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[o("descriptions-table",`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[o("descriptions-table-row",`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[o("descriptions-table-header",`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),o("descriptions-table-content",`
 vertical-align: top;
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-td-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[K("content",`
 transition: color .3s var(--n-bezier);
 display: inline-block;
 color: var(--n-td-text-color);
 `)]),K("label",`
 font-weight: var(--n-th-font-weight);
 transition: color .3s var(--n-bezier);
 display: inline-block;
 margin-right: 14px;
 color: var(--n-th-text-color);
 `)])])])]),o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),re(o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),le(o("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const Se="DESCRIPTION_ITEM_FLAG";function xe(s){return typeof s=="object"&&s&&!Array.isArray(s)?s.type&&s.type.DESCRIPTION_ITEM_FLAG:!1}const _e=["colspan"],ze=["colspan"],Ce=["colspan"],ke=["colspan"],Pe={...Z.props,title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:"top"},labelAlign:{type:String,default:"left"},separator:{type:String,default:":"},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var $e=J({name:"Descriptions",props:Pe,slots:Object,setup(s){const{mergedClsPrefixRef:_,inlineThemeDisabled:y,mergedComponentPropsRef:i}=ae(s),d=U(()=>{var a,c;return s.size||((c=(a=i==null?void 0:i.value)==null?void 0:a.Descriptions)==null?void 0:c.size)||"medium"}),x=Z("Descriptions","-descriptions",we,de,s,_),n=U(()=>{const{bordered:a}=s,c=d.value,{common:{cubicBezierEaseInOut:$},self:{titleTextColor:l,thColor:B,thColorModal:f,thColorPopover:e,thTextColor:r,thFontWeight:t,tdTextColor:C,tdColor:F,tdColorModal:k,tdColorPopover:A,borderColor:R,borderColorModal:D,borderColorPopover:O,borderRadius:E,lineHeight:M,[G("fontSize",c)]:V,[G(a?"thPaddingBordered":"thPadding",c)]:W,[G(a?"tdPaddingBordered":"tdPadding",c)]:ee}}=x.value;return{"--n-title-text-color":l,"--n-th-padding":W,"--n-td-padding":ee,"--n-font-size":V,"--n-bezier":$,"--n-th-font-weight":t,"--n-line-height":M,"--n-th-text-color":r,"--n-td-text-color":C,"--n-th-color":B,"--n-th-color-modal":f,"--n-th-color-popover":e,"--n-td-color":F,"--n-td-color-modal":k,"--n-td-color-popover":A,"--n-border-radius":E,"--n-border-color":R,"--n-border-color-modal":D,"--n-border-color-popover":O}}),h=y?ie("descriptions",U(()=>{let a="";const{bordered:c}=s;return c&&(a+="a"),a+=d.value[0],a}),n,s):void 0;return{mergedClsPrefix:_,cssVars:y?void 0:n,themeClass:h==null?void 0:h.themeClass,onRender:h==null?void 0:h.onRender,compitableColumn:fe(s,["columns","column"]),inlineThemeDisabled:y,mergedSize:d}},render(){const s=this.$slots.default,_=s?ne(s()):[];_.length;const{contentClass:y,labelClass:i,compitableColumn:d,labelPlacement:x,labelAlign:n,mergedSize:h,bordered:a,title:c,cssVars:$,mergedClsPrefix:l,separator:B,onRender:f}=this;f==null||f();const e=_.filter(t=>xe(t)),r=e.reduce((t,C,F)=>{const k=C.props||{},A=e.length-1===F,R=["label"in k?k.label:Y(C,"label")],D=[Y(C)],O=k.span||1,E=t.span;t.span+=O;const M=k.labelStyle||k["label-style"]||this.labelStyle,V=k.contentStyle||k["content-style"]||this.contentStyle;if(x==="left")a?t.row.push((v(),g("th",{key:1,class:u([`${l}-descriptions-table-header`,i]),colspan:1,style:I(M)},[m(()=>R)],6)),(v(),g("td",{key:2,class:u([`${l}-descriptions-table-content`,y]),colspan:A?(d-E)*2+1:O*2-1,style:I(V)},[m(()=>D)],14,_e))):t.row.push((v(),g("td",{key:3,class:u(`${l}-descriptions-table-content`),colspan:A?(d-E)*2:O*2},[S("span",{class:u([`${l}-descriptions-table-content__label`,i]),style:I(M)},[m(()=>[...R,B&&(v(),g("span",{key:4,class:u(`${l}-descriptions-separator`)},[m(()=>B)],2))])],6),S("span",{class:u([`${l}-descriptions-table-content__content`,y]),style:I(V)},[m(()=>D)],6)],10,ze)));else{const W=A?(d-E)*2:O*2;t.row.push((v(),g("th",{key:5,class:u([`${l}-descriptions-table-header`,i]),colspan:W,style:I(M)},[m(()=>R)],14,Ce))),t.secondRow.push((v(),g("td",{key:6,class:u([`${l}-descriptions-table-content`,y]),colspan:W,style:I(V)},[m(()=>D)],14,ke)))}return(t.span>=d||A)&&(t.span=0,t.row.length&&(t.rows.push(t.row),t.row=[]),x!=="left"&&t.secondRow.length&&(t.rows.push(t.secondRow),t.secondRow=[])),t},{span:0,row:[],secondRow:[],rows:[]}).rows.map(t=>(v(),g("tr",{class:u(`${l}-descriptions-table-row`)},[m(()=>t)],2)));return v(),g("div",{style:I($),class:u([`${l}-descriptions`,this.themeClass,`${l}-descriptions--${x}-label-placement`,`${l}-descriptions--${n}-label-align`,`${l}-descriptions--${h}-size`,a&&`${l}-descriptions--bordered`])},[c||this.$slots.header?(v(),g("div",{key:0,class:u(`${l}-descriptions-header`)},[m(()=>c||ge(this,"header"))],2)):m(()=>null),S("div",{class:u(`${l}-descriptions-table-wrapper`)},[S("table",{class:u(`${l}-descriptions-table`)},[S("tbody",null,[m(()=>x==="top"&&(v(),g("tr",{class:u(`${l}-descriptions-table-row`),style:{visibility:"collapse"}},[m(()=>se(d*2,(v(),g("td"))))],2))),m(()=>r)])],2)],2)],6)}});const Te={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var L=J({name:"DescriptionsItem",[Se]:!0,props:Te,slots:Object,render(){return null}});const Ie={class:"page"},Be={key:0,class:"err"},Ae={class:"field row-switch"},Oe={class:"field"},Re={class:"field"},De={class:"field"},Ee=J({__name:"OneBotView",setup(s){const _=ce(),y=pe(),i=T(!0),d=T(!1),x=T(""),n=T(null),h=T(!1),a=T(""),c=T("/onebot/v11/ws"),$=T("/onebot/v11");async function l(){var f,e,r,t;i.value=!0,x.value="";try{n.value=await H("/v1/channels/onebot11",{token:_.token}),h.value=!!(((f=n.value.config)==null?void 0:f.enabled)??n.value.enabled),a.value=((e=n.value.config)==null?void 0:e.accessToken)||"",c.value=((r=n.value.config)==null?void 0:r.reverseWsPath)||n.value.reverseWsPath||"/onebot/v11/ws",$.value=((t=n.value.config)==null?void 0:t.httpPath)||n.value.httpPath||"/onebot/v11"}catch(C){x.value=C instanceof Error?C.message:String(C)}finally{i.value=!1}}async function B(){d.value=!0;try{n.value=await H("/v1/channels/onebot11/config",{method:"POST",token:_.token,body:JSON.stringify({enabled:h.value,accessToken:a.value,reverseWsPath:c.value,httpPath:$.value})}),y.success(n.value.message||"已保存")}catch(f){y.error(f instanceof Error?f.message:String(f))}finally{d.value=!1}}return be(()=>void l()),(f,e)=>(v(),g("div",Ie,[e[10]||(e[10]=S("header",{class:"page-head"},[S("h1",null,"OneBot 11"),S("p",{class:"muted"},"反向 WebSocket / HTTP 上报。路径改完一般要重启网关。")],-1)),p(b(me),{show:i.value},{default:w(()=>[x.value?(v(),g("p",Be,N(x.value),1)):(v(),g(ue,{key:1},[p(b(X),{title:"状态",size:"small",style:{"margin-bottom":"14px"}},{default:w(()=>[p(b($e),{column:2,"label-placement":"left",size:"small"},{default:w(()=>[p(b(L),{label:"连接"},{default:w(()=>{var r;return[p(b(te),{type:(r=n.value)!=null&&r.connected?"success":"warning",size:"small"},{default:w(()=>{var t;return[z(N((t=n.value)!=null&&t.connected?"已连接":"未连接"),1)]}),_:1},8,["type"])]}),_:1}),p(b(L),{label:"客户端"},{default:w(()=>{var r;return[z(N(((r=n.value)==null?void 0:r.clients)??0),1)]}),_:1}),p(b(L),{label:"机器人 QQ"},{default:w(()=>{var r;return[z(N(((r=n.value)==null?void 0:r.selfId)||"—"),1)]}),_:1}),p(b(L),{label:"最近事件"},{default:w(()=>{var r;return[z(N(((r=n.value)==null?void 0:r.lastEventAt)||"—"),1)]}),_:1})]),_:1})]),_:1}),p(b(X),{title:"配置",size:"small"},{default:w(()=>[S("label",Ae,[e[4]||(e[4]=z(" 启用 ",-1)),p(b(ye),{value:h.value,"onUpdate:value":e[0]||(e[0]=r=>h.value=r)},null,8,["value"])]),S("label",Oe,[e[5]||(e[5]=z("Access Token ",-1)),p(b(Q),{value:a.value,"onUpdate:value":e[1]||(e[1]=r=>a.value=r),type:"password","show-password-on":"click"},null,8,["value"])]),S("label",Re,[e[6]||(e[6]=z("反向 WS 路径 ",-1)),p(b(Q),{value:c.value,"onUpdate:value":e[2]||(e[2]=r=>c.value=r)},null,8,["value"])]),S("label",De,[e[7]||(e[7]=z("HTTP 路径 ",-1)),p(b(Q),{value:$.value,"onUpdate:value":e[3]||(e[3]=r=>$.value=r)},null,8,["value"])]),p(b(he),null,{default:w(()=>[p(b(q),{type:"primary",loading:d.value,onClick:B},{default:w(()=>[...e[8]||(e[8]=[z("保存",-1)])]),_:1},8,["loading"]),p(b(q),{onClick:l},{default:w(()=>[...e[9]||(e[9]=[z("刷新",-1)])]),_:1})]),_:1})]),_:1})],64))]),_:1},8,["show"])]))}}),Le=ve(Ee,[["__scopeId","data-v-5e043d92"]]);export{Le as default};
