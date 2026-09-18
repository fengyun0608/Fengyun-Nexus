import{T as te}from"./Tag-BrHMs3fR.js";import{D as re,E as O,G as B,H as t,J as le,K as W,L as K,N as ne,O as ae,d as J,P as ee,Q as se,i as y,c as x,R as w,S as M,T as f,b as C,U as ie,V as de,W as ce,m as G,X as H,u as pe,n as be,o as ue,e as p,f as P,g as b,r as I,h as X,t as N,F as ge,Y,j as z,I as U,B as q,_ as ve}from"./index-BufM0o0k.js";import{g as he,S as me}from"./Space-B86mCga0.js";import{u as fe}from"./use-compitable-lG_QD6CX.js";import{S as ye}from"./Spin-CLwSE2Sh.js";import{S as xe}from"./Switch-Df5QXr2E.js";var Se={thPaddingBorderedSmall:"8px 12px",thPaddingBorderedMedium:"12px 16px",thPaddingBorderedLarge:"16px 24px",thPaddingSmall:"0",thPaddingMedium:"0",thPaddingLarge:"0",tdPaddingBorderedSmall:"8px 12px",tdPaddingBorderedMedium:"12px 16px",tdPaddingBorderedLarge:"16px 24px",tdPaddingSmall:"0 0 8px 0",tdPaddingMedium:"0 0 12px 0",tdPaddingLarge:"0 0 16px 0"};function we(n){const{tableHeaderColor:v,textColor2:h,textColor1:s,cardColor:a,modalColor:u,popoverColor:l,dividerColor:c,borderRadius:i,fontWeightStrong:d,lineHeight:_,fontSizeSmall:r,fontSizeMedium:T,fontSizeLarge:$}=n;return{...Se,lineHeight:_,fontSizeSmall:r,fontSizeMedium:T,fontSizeLarge:$,titleTextColor:s,thColor:O(a,v),thColorModal:O(u,v),thColorPopover:O(l,v),thTextColor:s,thFontWeight:d,tdTextColor:h,tdColor:a,tdColorModal:u,tdColorPopover:l,borderColor:O(a,c),borderColorModal:O(u,c),borderColorPopover:O(l,c),borderRadius:i}}const Ce={common:re,self:we};function Z(n,v="default",h=[]){const{children:s}=n;if(s!==null&&typeof s=="object"&&!Array.isArray(s)){const a=s[v];if(typeof a=="function")return a()}return h}var Pe=B([t("descriptions",{fontSize:"var(--n-font-size)"},[t("descriptions-separator",`
 display: inline-block;
 margin: 0 8px 0 2px;
 `),t("descriptions-table-wrapper",[t("descriptions-table",[t("descriptions-table-row",[t("descriptions-table-header",{padding:"var(--n-th-padding)"}),t("descriptions-table-content",{padding:"var(--n-td-padding)"})])])]),le("bordered",[t("descriptions-table-wrapper",[t("descriptions-table",[t("descriptions-table-row",[B("&:last-child",[t("descriptions-table-content",{paddingBottom:0})])])])])]),W("left-label-placement",[t("descriptions-table-content",[B("> *",{verticalAlign:"top"})])]),W("left-label-align",[B("th",{textAlign:"left"})]),W("center-label-align",[B("th",{textAlign:"center"})]),W("right-label-align",[B("th",{textAlign:"right"})]),W("bordered",[t("descriptions-table-wrapper",`
 border-radius: var(--n-border-radius);
 overflow: hidden;
 background: var(--n-merged-td-color);
 border: 1px solid var(--n-merged-border-color);
 `,[t("descriptions-table",[t("descriptions-table-row",[B("&:not(:last-child)",[t("descriptions-table-content",{borderBottom:"1px solid var(--n-merged-border-color)"}),t("descriptions-table-header",{borderBottom:"1px solid var(--n-merged-border-color)"})]),t("descriptions-table-header",`
 font-weight: 400;
 background-clip: padding-box;
 background-color: var(--n-merged-th-color);
 `,[B("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})]),t("descriptions-table-content",[B("&:not(:last-child)",{borderRight:"1px solid var(--n-merged-border-color)"})])])])])]),t("descriptions-header",`
 font-weight: var(--n-th-font-weight);
 font-size: 18px;
 transition: color .3s var(--n-bezier);
 line-height: var(--n-line-height);
 margin-bottom: 16px;
 color: var(--n-title-text-color);
 `),t("descriptions-table-wrapper",`
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[t("descriptions-table",`
 width: 100%;
 border-collapse: separate;
 border-spacing: 0;
 box-sizing: border-box;
 `,[t("descriptions-table-row",`
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[t("descriptions-table-header",`
 font-weight: var(--n-th-font-weight);
 line-height: var(--n-line-height);
 display: table-cell;
 box-sizing: border-box;
 color: var(--n-th-text-color);
 transition:
 color .3s var(--n-bezier),
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `),t("descriptions-table-content",`
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
 `)])])])]),t("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color);
 --n-merged-td-color: var(--n-td-color);
 --n-merged-border-color: var(--n-border-color);
 `),ne(t("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-modal);
 --n-merged-td-color: var(--n-td-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),ae(t("descriptions-table-wrapper",`
 --n-merged-th-color: var(--n-th-color-popover);
 --n-merged-td-color: var(--n-td-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const ze="DESCRIPTION_ITEM_FLAG";function _e(n){return typeof n=="object"&&n&&!Array.isArray(n)?n.type&&n.type.DESCRIPTION_ITEM_FLAG:!1}const ke=["colspan"],Te=["colspan"],$e=["colspan"],Be=["colspan"],Ie={...ee.props,title:String,column:{type:Number,default:3},columns:Number,labelPlacement:{type:String,default:"top"},labelAlign:{type:String,default:"left"},separator:{type:String,default:":"},size:String,bordered:Boolean,labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var Me=J({name:"Descriptions",props:Ie,slots:Object,setup(n){const{mergedClsPrefixRef:v,inlineThemeDisabled:h,mergedComponentPropsRef:s}=de(n),a=G(()=>{var i,d;return n.size||((d=(i=s==null?void 0:s.value)==null?void 0:i.Descriptions)==null?void 0:d.size)||"medium"}),u=ee("Descriptions","-descriptions",Pe,Ce,n,v),l=G(()=>{const{bordered:i}=n,d=a.value,{common:{cubicBezierEaseInOut:_},self:{titleTextColor:r,thColor:T,thColorModal:$,thColorPopover:m,thTextColor:o,thFontWeight:e,tdTextColor:S,tdColor:R,tdColorModal:g,tdColorPopover:k,borderColor:D,borderColorModal:E,borderColorPopover:A,borderRadius:L,lineHeight:j,[H("fontSize",d)]:V,[H(i?"thPaddingBordered":"thPadding",d)]:F,[H(i?"tdPaddingBordered":"tdPadding",d)]:oe}}=u.value;return{"--n-title-text-color":r,"--n-th-padding":F,"--n-td-padding":oe,"--n-font-size":V,"--n-bezier":_,"--n-th-font-weight":e,"--n-line-height":j,"--n-th-text-color":o,"--n-td-text-color":S,"--n-th-color":T,"--n-th-color-modal":$,"--n-th-color-popover":m,"--n-td-color":R,"--n-td-color-modal":g,"--n-td-color-popover":k,"--n-border-radius":L,"--n-border-color":D,"--n-border-color-modal":E,"--n-border-color-popover":A}}),c=h?ce("descriptions",G(()=>{let i="";const{bordered:d}=n;return d&&(i+="a"),i+=a.value[0],i}),l,n):void 0;return{mergedClsPrefix:v,cssVars:h?void 0:l,themeClass:c==null?void 0:c.themeClass,onRender:c==null?void 0:c.onRender,compitableColumn:fe(n,["columns","column"]),inlineThemeDisabled:h,mergedSize:a}},render(){const n=this.$slots.default,v=n?se(n()):[];v.length;const{contentClass:h,labelClass:s,compitableColumn:a,labelPlacement:u,labelAlign:l,mergedSize:c,bordered:i,title:d,cssVars:_,mergedClsPrefix:r,separator:T,onRender:$}=this;$==null||$();const m=v.filter(e=>_e(e)),o=m.reduce((e,S,R)=>{const g=S.props||{},k=m.length-1===R,D=["label"in g?g.label:Z(S,"label")],E=[Z(S)],A=g.span||1,L=e.span;e.span+=A;const j=g.labelStyle||g["label-style"]||this.labelStyle,V=g.contentStyle||g["content-style"]||this.contentStyle;if(u==="left")i?e.row.push((y(),x("th",{key:1,class:f([`${r}-descriptions-table-header`,s]),colspan:1,style:M(j)},[w(()=>D)],6)),(y(),x("td",{key:2,class:f([`${r}-descriptions-table-content`,h]),colspan:k?(a-L)*2+1:A*2-1,style:M(V)},[w(()=>E)],14,ke))):e.row.push((y(),x("td",{key:3,class:f(`${r}-descriptions-table-content`),colspan:k?(a-L)*2:A*2},[C("span",{class:f([`${r}-descriptions-table-content__label`,s]),style:M(j)},[w(()=>[...D,T&&(y(),x("span",{key:4,class:f(`${r}-descriptions-separator`)},[w(()=>T)],2))])],6),C("span",{class:f([`${r}-descriptions-table-content__content`,h]),style:M(V)},[w(()=>E)],6)],10,Te)));else{const F=k?(a-L)*2:A*2;e.row.push((y(),x("th",{key:5,class:f([`${r}-descriptions-table-header`,s]),colspan:F,style:M(j)},[w(()=>D)],14,$e))),e.secondRow.push((y(),x("td",{key:6,class:f([`${r}-descriptions-table-content`,h]),colspan:F,style:M(V)},[w(()=>E)],14,Be)))}return(e.span>=a||k)&&(e.span=0,e.row.length&&(e.rows.push(e.row),e.row=[]),u!=="left"&&e.secondRow.length&&(e.rows.push(e.secondRow),e.secondRow=[])),e},{span:0,row:[],secondRow:[],rows:[]}).rows.map(e=>(y(),x("tr",{class:f(`${r}-descriptions-table-row`)},[w(()=>e)],2)));return y(),x("div",{style:M(_),class:f([`${r}-descriptions`,this.themeClass,`${r}-descriptions--${u}-label-placement`,`${r}-descriptions--${l}-label-align`,`${r}-descriptions--${c}-size`,i&&`${r}-descriptions--bordered`])},[d||this.$slots.header?(y(),x("div",{key:0,class:f(`${r}-descriptions-header`)},[w(()=>d||he(this,"header"))],2)):w(()=>null),C("div",{class:f(`${r}-descriptions-table-wrapper`)},[C("table",{class:f(`${r}-descriptions-table`)},[C("tbody",null,[w(()=>u==="top"&&(y(),x("tr",{class:f(`${r}-descriptions-table-row`),style:{visibility:"collapse"}},[w(()=>ie(a*2,(y(),x("td"))))],2))),w(()=>o)])],2)],2)],6)}});const Re={label:String,span:{type:Number,default:1},labelClass:String,labelStyle:[Object,String],contentClass:String,contentStyle:[Object,String]};var Q=J({name:"DescriptionsItem",[ze]:!0,props:Re,slots:Object,render(){return null}});const Ae={class:"page"},Oe={key:0,class:"err"},De={class:"field row-switch"},Ee={class:"field"},Le={class:"field"},je={class:"field"},Ve={class:"field"},We=J({__name:"OneBotView",setup(n){const v=pe(),h=be(),s=I(!0),a=I(!1),u=I(""),l=I(null),c=I(!1),i=I(""),d=I("/onebot/v11/ws"),_=I("/onebot/v11"),r=I("");async function T(){var m,o,e,S,R;s.value=!0,u.value="";try{l.value=await X("/v1/channels/onebot11",{token:v.token}),c.value=!!(((m=l.value.config)==null?void 0:m.enabled)??l.value.enabled),i.value=((o=l.value.config)==null?void 0:o.accessToken)||"",d.value=((e=l.value.config)==null?void 0:e.reverseWsPath)||l.value.reverseWsPath||"/onebot/v11/ws",_.value=((S=l.value.config)==null?void 0:S.httpPath)||l.value.httpPath||"/onebot/v11";const g=((R=l.value.config)==null?void 0:R.bots)||[];r.value=g.map(k=>[k.selfId||"",k.label||"",k.apiBase||""].join(" | ")).join(`
`)}catch(g){u.value=g instanceof Error?g.message:String(g)}finally{s.value=!1}}async function $(){a.value=!0;try{const m=r.value.split(/\n+/).map(o=>o.trim()).filter(Boolean).map(o=>{const e=o.split("|").map(S=>S.trim());return{selfId:e[0]||"",label:e[1]||"",apiBase:e[2]||"",accessToken:e[3]||""}});l.value=await X("/v1/channels/onebot11/config",{method:"POST",token:v.token,body:JSON.stringify({enabled:c.value,accessToken:i.value,reverseWsPath:d.value,httpPath:_.value,bots:m})}),h.success(l.value.message||"已保存")}catch(m){h.error(m instanceof Error?m.message:String(m))}finally{a.value=!1}}return ue(()=>void T()),(m,o)=>(y(),x("div",Ae,[o[12]||(o[12]=C("header",{class:"page-head"},[C("h1",null,"OneBot 11"),C("p",{class:"muted"},"反向 WebSocket / HTTP 上报。路径改完一般要重启网关。")],-1)),p(b(ye),{show:s.value},{default:P(()=>[u.value?(y(),x("p",Oe,N(u.value),1)):(y(),x(ge,{key:1},[p(b(Y),{title:"状态",size:"small",style:{"margin-bottom":"14px"}},{default:P(()=>[p(b(Me),{column:2,"label-placement":"left",size:"small"},{default:P(()=>[p(b(Q),{label:"连接"},{default:P(()=>{var e;return[p(b(te),{type:(e=l.value)!=null&&e.connected?"success":"warning",size:"small"},{default:P(()=>{var S;return[z(N((S=l.value)!=null&&S.connected?"已连接":"未连接"),1)]}),_:1},8,["type"])]}),_:1}),p(b(Q),{label:"客户端"},{default:P(()=>{var e;return[z(N(((e=l.value)==null?void 0:e.clients)??0),1)]}),_:1}),p(b(Q),{label:"机器人 QQ"},{default:P(()=>{var e;return[z(N(((e=l.value)==null?void 0:e.selfId)||"—"),1)]}),_:1}),p(b(Q),{label:"最近事件"},{default:P(()=>{var e;return[z(N(((e=l.value)==null?void 0:e.lastEventAt)||"—"),1)]}),_:1})]),_:1})]),_:1}),p(b(Y),{title:"配置",size:"small"},{default:P(()=>[C("label",De,[o[5]||(o[5]=z(" 启用 ",-1)),p(b(xe),{value:c.value,"onUpdate:value":o[0]||(o[0]=e=>c.value=e)},null,8,["value"])]),C("label",Ee,[o[6]||(o[6]=z("Access Token ",-1)),p(b(U),{value:i.value,"onUpdate:value":o[1]||(o[1]=e=>i.value=e),type:"password","show-password-on":"click"},null,8,["value"])]),C("label",Le,[o[7]||(o[7]=z("反向 WS 路径 ",-1)),p(b(U),{value:d.value,"onUpdate:value":o[2]||(o[2]=e=>d.value=e)},null,8,["value"])]),C("label",je,[o[8]||(o[8]=z("HTTP 路径 ",-1)),p(b(U),{value:_.value,"onUpdate:value":o[3]||(o[3]=e=>_.value=e)},null,8,["value"])]),C("label",Ve,[o[9]||(o[9]=z(" 多号（每行：QQ | 备注 | apiBase） ",-1)),p(b(U),{value:r.value,"onUpdate:value":o[4]||(o[4]=e=>r.value=e),type:"textarea",rows:3,placeholder:"123456 | 主号 | http://127.0.0.1:3000"},null,8,["value"])]),p(b(me),null,{default:P(()=>[p(b(q),{type:"primary",loading:a.value,onClick:$},{default:P(()=>[...o[10]||(o[10]=[z("保存",-1)])]),_:1},8,["loading"]),p(b(q),{onClick:T},{default:P(()=>[...o[11]||(o[11]=[z("刷新",-1)])]),_:1})]),_:1})]),_:1})],64))]),_:1},8,["show"])]))}}),Je=ve(We,[["__scopeId","data-v-bcdad383"]]);export{Je as default};
