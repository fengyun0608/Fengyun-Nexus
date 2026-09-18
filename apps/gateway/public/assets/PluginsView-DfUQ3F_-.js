import{z as B,A as x,D as N,E as $,G as pe,H as he,d as W,J as X,i as t,c as l,O as f,L as d,N as q,Q as ie,aj as ae,R as oe,m as A,ak as ke,al as ye,am as be,a9 as xe,an as we,ao as $e,b as s,F as g,ap as Ce,u as Se,n as _e,o as ze,t as w,e as k,f as v,g as c,M as re,r as h,h as E,B as S,j as p,a0 as T,l as _,k as G,I as Ie,aq as Ee,ar as Re,_ as Pe}from"./index-DdZHQmC7.js";import{T as Te}from"./Tag-vk4CGW4r.js";import{S as F}from"./Space-D4F_fG09.js";import{S as Be}from"./Spin-CtcpnkvZ.js";var je=B([x("list",`
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
 `,[N("show-divider",[x("list-item",[B("&:not(:last-child)",[$("divider",`
 background-color: var(--n-merged-border-color);
 `)])])]),N("clickable",[x("list-item",`
 cursor: pointer;
 `)]),N("bordered",`
 border: 1px solid var(--n-merged-border-color);
 border-radius: var(--n-border-radius);
 `),N("hoverable",[x("list-item",`
 border-radius: var(--n-border-radius);
 `,[B("&:hover",`
 background-color: var(--n-merged-color-hover);
 `,[$("divider",`
 background-color: transparent;
 `)])])]),N("bordered, hoverable",[x("list-item",`
 padding: 12px 20px;
 `),$("header, footer",`
 padding: 12px 20px;
 `)]),$("header, footer",`
 padding: 12px 0;
 box-sizing: border-box;
 transition: border-color .3s var(--n-bezier);
 `,[B("&:not(:last-child)",`
 border-bottom: 1px solid var(--n-merged-border-color);
 `)]),x("list-item",`
 position: relative;
 padding: 12px 0; 
 box-sizing: border-box;
 display: flex;
 flex-wrap: nowrap;
 align-items: center;
 transition:
 background-color .3s var(--n-bezier),
 border-color .3s var(--n-bezier);
 `,[$("prefix",`
 margin-right: 20px;
 flex: 0;
 `),$("suffix",`
 margin-left: 20px;
 flex: 0;
 `),$("main",`
 flex: 1;
 `),$("divider",`
 height: 1px;
 position: absolute;
 bottom: 0;
 left: 0;
 right: 0;
 background-color: transparent;
 transition: background-color .3s var(--n-bezier);
 pointer-events: none;
 `)])]),pe(x("list",`
 --n-merged-color-hover: var(--n-color-hover-modal);
 --n-merged-color: var(--n-color-modal);
 --n-merged-border-color: var(--n-border-color-modal);
 `)),he(x("list",`
 --n-merged-color-hover: var(--n-color-hover-popover);
 --n-merged-color: var(--n-color-popover);
 --n-merged-border-color: var(--n-border-color-popover);
 `))]);const De={...X.props,size:{type:String,default:"medium"},bordered:Boolean,clickable:Boolean,hoverable:Boolean,showDivider:{type:Boolean,default:!0}},se=ke("n-list");var Ue=W({name:"List",props:De,slots:Object,setup(i){const{mergedClsPrefixRef:n,inlineThemeDisabled:m,mergedRtlRef:C}=ie(i),j=ae("List",C,n),R=X("List","-list",je,ye,i,n);be(se,{showDividerRef:xe(i,"showDivider"),mergedClsPrefixRef:n});const z=A(()=>{const{common:{cubicBezierEaseInOut:b},self:{fontSize:u,textColor:P,color:y,colorModal:I,colorPopover:D,borderColor:U,borderColorModal:J,borderColorPopover:Q,borderRadius:O,colorHover:M,colorHoverModal:K,colorHoverPopover:L}}=R.value;return{"--n-font-size":u,"--n-bezier":b,"--n-text-color":P,"--n-color":y,"--n-border-radius":O,"--n-border-color":U,"--n-border-color-modal":J,"--n-border-color-popover":Q,"--n-color-modal":I,"--n-color-popover":D,"--n-color-hover":M,"--n-color-hover-modal":K,"--n-color-hover-popover":L}}),a=m?oe("list",void 0,z,i):void 0;return{mergedClsPrefix:n,rtlEnabled:j,cssVars:m?void 0:z,themeClass:a==null?void 0:a.themeClass,onRender:a==null?void 0:a.onRender}},render(){const{$slots:i,mergedClsPrefix:n,onRender:m}=this;return m==null||m(),t(),l("ul",{class:f([`${n}-list`,this.rtlEnabled&&`${n}-list--rtl`,this.bordered&&`${n}-list--bordered`,this.showDivider&&`${n}-list--show-divider`,this.hoverable&&`${n}-list--hoverable`,this.clickable&&`${n}-list--clickable`,this.themeClass]),style:q(this.cssVars)},[i.header?(t(),l("div",{key:0,class:f(`${n}-list__header`)},[d(()=>i.header())],2)):d(()=>null),d(()=>{var C;return(C=i.default)==null?void 0:C.call(i)}),i.footer?(t(),l("div",{key:2,class:f(`${n}-list__footer`)},[d(()=>i.footer())],2)):d(()=>null)],6)}}),Ve=W({name:"ListItem",slots:Object,setup(){const i=we(se,null);return i||$e("list-item","`n-list-item` must be placed in `n-list`."),{showDivider:i.showDividerRef,mergedClsPrefix:i.mergedClsPrefixRef}},render(){const{$slots:i,mergedClsPrefix:n}=this;return t(),l("li",{class:f(`${n}-list-item`)},[i.prefix?(t(),l("div",{key:0,class:f(`${n}-list-item__prefix`)},[d(()=>i.prefix())],2)):d(()=>null),i.default?(t(),l("div",{key:2,class:f(`${n}-list-item__main`)},[d(()=>i.default())],2)):d(()=>null),i.suffix?(t(),l("div",{key:4,class:f(`${n}-list-item__suffix`)},[d(()=>i.suffix())],2)):d(()=>null),d(()=>this.showDivider&&(t(),l("div",{class:f(`${n}-list-item__divider`)},null,2)))],2)}}),Oe=x("thing",`
 display: flex;
 transition: color .3s var(--n-bezier);
 font-size: var(--n-font-size);
 color: var(--n-text-color);
`,[x("thing-avatar",`
 margin-right: 12px;
 margin-top: 2px;
 `),x("thing-avatar-header-wrapper",`
 display: flex;
 flex-wrap: nowrap;
 `,[x("thing-header-wrapper",`
 flex: 1;
 `)]),x("thing-main",`
 flex-grow: 1;
 `,[x("thing-header",`
 display: flex;
 margin-bottom: 4px;
 justify-content: space-between;
 align-items: center;
 `,[$("title",`
 font-size: 16px;
 font-weight: var(--n-title-font-weight);
 transition: color .3s var(--n-bezier);
 color: var(--n-title-text-color);
 `)]),$("description",[B("&:not(:last-child)",`
 margin-bottom: 4px;
 `)]),$("content",[B("&:not(:first-child)",`
 margin-top: 12px;
 `)]),$("footer",[B("&:not(:first-child)",`
 margin-top: 12px;
 `)]),$("action",[B("&:not(:first-child)",`
 margin-top: 12px;
 `)])])]);const Le={...X.props,title:String,titleExtra:String,description:String,descriptionClass:String,descriptionStyle:[String,Object],content:String,contentClass:String,contentStyle:[String,Object],contentIndented:Boolean};var Me=W({name:"Thing",props:Le,slots:Object,setup(i,{slots:n}){const{mergedClsPrefixRef:m,inlineThemeDisabled:C,mergedRtlRef:j}=ie(i),R=X("Thing","-thing",Oe,Ce,i,m),z=ae("Thing",j,m),a=A(()=>{const{self:{titleTextColor:u,textColor:P,titleFontWeight:y,fontSize:I},common:{cubicBezierEaseInOut:D}}=R.value;return{"--n-bezier":D,"--n-font-size":I,"--n-text-color":P,"--n-title-font-weight":y,"--n-title-text-color":u}}),b=C?oe("thing",void 0,a,i):void 0;return()=>{var y;const{value:u}=m,P=z?z.value:!1;return(y=b==null?void 0:b.onRender)==null||y.call(b),t(),l("div",{class:f([`${u}-thing`,b==null?void 0:b.themeClass,P&&`${u}-thing--rtl`]),style:q(C?void 0:a.value)},[n.avatar&&i.contentIndented?(t(),l("div",{key:0,class:f(`${u}-thing-avatar`)},[d(()=>n.avatar())],2)):d(()=>null),s("div",{class:f(`${u}-thing-main`)},[!i.contentIndented&&(n.header||i.title||n["header-extra"]||i.titleExtra||n.avatar)?(t(),l("div",{key:0,class:f(`${u}-thing-avatar-header-wrapper`)},[n.avatar?(t(),l("div",{key:0,class:f(`${u}-thing-avatar`)},[d(()=>n.avatar())],2)):d(()=>null),n.header||i.title||n["header-extra"]||i.titleExtra?(t(),l("div",{key:2,class:f(`${u}-thing-header-wrapper`)},[s("div",{class:f(`${u}-thing-header`)},[n.header||i.title?(t(),l("div",{key:0,class:f(`${u}-thing-header__title`)},[n.header?(t(),l(g,{key:0},[d(()=>n.header())],64)):(t(),l(g,{key:1},[d(()=>i.title)],64))],2)):d(()=>null),n["header-extra"]||i.titleExtra?(t(),l("div",{key:2,class:f(`${u}-thing-header__extra`)},[n["header-extra"]?(t(),l(g,{key:0},[d(()=>n["header-extra"]())],64)):(t(),l(g,{key:1},[d(()=>i.titleExtra)],64))],2)):d(()=>null)],2),n.description||i.description?(t(),l("div",{key:0,class:f([`${u}-thing-main__description`,i.descriptionClass]),style:q(i.descriptionStyle)},[n.description?(t(),l(g,{key:0},[d(()=>n.description())],64)):(t(),l(g,{key:1},[d(()=>i.description)],64))],6)):d(()=>null)],2)):d(()=>null)],2)):(t(),l(g,{key:1},[n.header||i.title||n["header-extra"]||i.titleExtra?(t(),l("div",{key:0,class:f(`${u}-thing-header`)},[n.header||i.title?(t(),l("div",{key:0,class:f(`${u}-thing-header__title`)},[n.header?(t(),l(g,{key:0},[d(()=>n.header())],64)):(t(),l(g,{key:1},[d(()=>i.title)],64))],2)):d(()=>null),n["header-extra"]||i.titleExtra?(t(),l("div",{key:2,class:f(`${u}-thing-header__extra`)},[n["header-extra"]?(t(),l(g,{key:0},[d(()=>n["header-extra"]())],64)):(t(),l(g,{key:1},[d(()=>i.titleExtra)],64))],2)):d(()=>null)],2)):d(()=>null),n.description||i.description?(t(),l("div",{key:2,class:f([`${u}-thing-main__description`,i.descriptionClass]),style:q(i.descriptionStyle)},[n.description?(t(),l(g,{key:0},[d(()=>n.description())],64)):(t(),l(g,{key:1},[d(()=>i.description)],64))],6)):d(()=>null)],64)),n.default||i.content?(t(),l("div",{key:2,class:f([`${u}-thing-main__content`,i.contentClass]),style:q(i.contentStyle)},[n.default?(t(),l(g,{key:0},[d(()=>n.default())],64)):(t(),l(g,{key:1},[d(()=>i.content)],64))],6)):d(()=>null),n.footer?(t(),l("div",{key:4,class:f(`${u}-thing-main__footer`)},[d(()=>n.footer())],2)):d(()=>null),n.action?(t(),l("div",{key:6,class:f(`${u}-thing-main__action`)},[d(()=>n.action())],2)):d(()=>null)],2)],6)}}});const Ne={class:"page"},Fe={class:"page-head"},qe={class:"crumb"},Ae={key:0,class:"muted"},Je={key:1,class:"muted"},Qe={key:2,class:"muted"},Ke={key:3,class:"muted"},Ge={key:0,class:"layer-grid tight"},We={key:1,class:"list"},Xe={class:"hint"},Ye={key:0,class:"muted"},Ze={key:2,class:"list"},He={class:"hint"},et={key:1},tt={key:0,class:"muted"},nt={key:3,class:"docs"},lt={key:0,class:"muted"},rt={key:1},it={class:"hint"},at=W({__name:"PluginsView",setup(i){const n=Se(),m=_e(),C=h(!1),j=h([]),R=h([]),z=h([]),a=h({step:"home"}),b=h(!1),u=h(""),P=h([]),y=h(""),I=h(""),D=h(!1),U=h(!1),J=h(""),Q=h(""),O=h(!1),M=h(""),K=h([]),L=h({}),de=A(()=>j.value.filter(o=>o.adapterScope==="all"||o.kind==="framework"));function Y(o){return j.value.filter(e=>{const r=e.adapterScope||(e.kind==="framework"?"all":"specified");return r==="all"?!0:o?(e.channels||[]).includes(o):r==="channel"||r==="specified"})}const H=A(()=>a.value.step!=="list"?[]:a.value.kind==="framework"?de.value:Y(a.value.channelId)),ee=A(()=>{if(a.value.step==="list"&&a.value.kind==="framework")return"系统插件包";if(a.value.step==="list"&&a.value.channelId){const o=R.value.find(e=>e.id===a.value.channelId);return`${(o==null?void 0:o.label)||a.value.channelId} · 本通道插件`}return a.value.step==="list"||a.value.step==="channels"?"消息通道插件":a.value.step==="docs"?a.value.kind==="framework"?"系统插件编写":"通道插件编写":"插件管理"});async function te(){C.value=!0;try{const[o,e,r]=await Promise.all([E("/v1/plugins",{token:n.token}),E("/v1/channels",{token:n.token}),E("/v1/admin/dev/plugins",{token:n.token}).catch(()=>({items:[]}))]);j.value=o.items||[],R.value=e.items||[],z.value=r.items||[]}catch(o){m.error(o instanceof Error?o.message:String(o))}finally{C.value=!1}}function ne(){if(a.value.step==="list"&&a.value.kind==="channel"&&a.value.channelId){a.value={step:"channels"};return}(a.value.step==="list"||a.value.step==="channels"||a.value.step==="docs")&&(a.value={step:"home"})}async function ue(o,e){try{await E(`/v1/plugins/${encodeURIComponent(o.id)}/${e?"enable":"disable"}`,{method:"POST",token:n.token}),o.enabled=e,m.success(e?`已启用 ${o.name||o.id}`:`已停用 ${o.name||o.id}`)}catch(r){m.error(r instanceof Error?r.message:String(r))}}async function ve(o){J.value=o.id,Q.value=o.name||o.id,U.value=!0;try{const e=await E(`/v1/plugins/${encodeURIComponent(o.id)}/config`,{token:n.token});O.value=!!e.supported,M.value=e.message||"",K.value=e.schema||[],L.value={...e.values||{}}}catch(e){O.value=!1,M.value=e instanceof Error?e.message:String(e)}}async function ce(){try{await E(`/v1/plugins/${encodeURIComponent(J.value)}/config`,{method:"PUT",token:n.token,body:JSON.stringify({values:L.value})}),m.success("配置已保存"),U.value=!1}catch(o){m.error(o instanceof Error?o.message:String(o))}}function Z(o){return z.value.find(e=>e.id===o.id)||z.value.find(e=>e.dir===o.id||e.name===o.name)}async function fe(o){const e=Z(o);if(!e){m.warning("未找到对应插件目录");return}u.value=e.dir,b.value=!0,y.value="",I.value="";try{const r=await E(`/v1/admin/dev/plugins/${encodeURIComponent(e.dir)}/files`,{token:n.token});P.value=r.files||[]}catch(r){m.error(r instanceof Error?r.message:String(r))}}async function ge(o){try{const e=await E(`/v1/admin/dev/file?path=${encodeURIComponent(o)}`,{token:n.token});y.value=e.path,I.value=e.content}catch(e){m.error(e instanceof Error?e.message:String(e))}}async function me(){if(y.value){D.value=!0;try{await E("/v1/admin/dev/file",{method:"PUT",token:n.token,body:JSON.stringify({path:y.value,content:I.value})}),m.success("已保存")}catch(o){m.error(o instanceof Error?o.message:String(o))}finally{D.value=!1}}}return ze(()=>void te()),(o,e)=>(t(),l("div",Ne,[s("header",Fe,[a.value.step==="home"?(t(),l(g,{key:0},[e[10]||(e[10]=s("h1",null,"插件管理",-1)),e[11]||(e[11]=s("p",{class:"muted"},"先选插件包：消息通道插件 / 系统插件。编写说明也分开，可随时返回上一层。",-1))],64)):(t(),l(g,{key:1},[s("p",qe,[s("button",{type:"button",class:"linkish",onClick:ne},w(a.value.step==="list"&&a.value.kind==="channel"&&a.value.channelId?"消息通道插件":"插件管理"),1),e[12]||(e[12]=s("span",null," / ",-1)),s("strong",null,w(ee.value),1)]),s("h1",null,w(ee.value),1),a.value.step==="list"&&a.value.kind==="framework"?(t(),l("p",Ae," 系统级通用插件（菜单、生图、回声等），两边通道也能看到。 ")):a.value.step==="channels"?(t(),l("p",Je,"先选通道，再管理该通道插件；主人在通道设置里改。")):a.value.step==="docs"?(t(),l("p",Qe,"编写基准与目录约定。")):(t(),l("p",Ke,"启用、停用、配置；模块化目录可看源码。"))],64))]),k(c(F),{style:{"margin-bottom":"12px"}},{default:v(()=>[k(c(S),{size:"small",loading:C.value,onClick:te},{default:v(()=>[...e[13]||(e[13]=[p("刷新",-1)])]),_:1},8,["loading"]),a.value.step!=="home"?(t(),T(c(S),{key:0,size:"small",quaternary:"",onClick:ne},{default:v(()=>[...e[14]||(e[14]=[p("返回上一层",-1)])]),_:1})):_("",!0)]),_:1}),k(c(Be),{show:C.value},{default:v(()=>[a.value.step==="home"?(t(),l("div",Ge,[s("button",{type:"button",class:"layer-card",onClick:e[0]||(e[0]=r=>a.value={step:"channels"})},[...e[15]||(e[15]=[s("strong",null,"消息通道插件包",-1),s("span",null,"绑定某一消息通道（如 QQ）的插件，写法与通道事件相关。",-1)])]),s("button",{type:"button",class:"layer-card",onClick:e[1]||(e[1]=r=>a.value={step:"list",kind:"framework"})},[...e[16]||(e[16]=[s("strong",null,"系统插件包",-1),s("span",null,"框架级通用插件（菜单、生图、回声等），adapterScope=all。",-1)])]),s("button",{type:"button",class:"layer-card",onClick:e[2]||(e[2]=r=>a.value={step:"docs",kind:"channel"})},[...e[17]||(e[17]=[s("strong",null,"通道插件编写",-1),s("span",null,"消息通道插件的编写基准与示例。",-1)])]),s("button",{type:"button",class:"layer-card",onClick:e[3]||(e[3]=r=>a.value={step:"docs",kind:"framework"})},[...e[18]||(e[18]=[s("strong",null,"系统插件编写",-1),s("span",null,"系统插件的编写基准与示例。",-1)])])])):a.value.step==="channels"?(t(),l("div",We,[(t(!0),l(g,null,G(R.value,r=>(t(),l("div",{key:r.id,class:"list-row"},[s("div",null,[s("strong",null,w(r.label||r.id),1),s("div",Xe,w(r.id)+" · 可用插件 "+w(Y(r.id).length),1)]),k(c(F),null,{default:v(()=>[k(c(S),{size:"small",quaternary:"",onClick:V=>o.$router.push(`/channels/${encodeURIComponent(r.id)}`)},{default:v(()=>[...e[19]||(e[19]=[p(" 通道设置 ",-1)])]),_:1},8,["onClick"]),k(c(S),{size:"small",type:"primary",onClick:V=>a.value={step:"list",kind:"channel",channelId:r.id}},{default:v(()=>[p(" 本通道插件 · "+w(Y(r.id).length),1)]),_:2},1032,["onClick"])]),_:2},1024)]))),128)),R.value.length?_("",!0):(t(),l("p",Ye,"暂无通道"))])):a.value.step==="list"?(t(),l("div",Ze,[(t(!0),l(g,null,G(H.value,r=>{var V;return t(),l("div",{key:r.id,class:"list-row"},[s("div",null,[s("strong",null,w(r.name||r.id),1),s("div",He,[p(w(r.id)+" ",1),(V=Z(r))!=null&&V.modular?(t(),T(c(Te),{key:0,size:"tiny",type:"success",bordered:!1,style:{"margin-left":"6px"}},{default:v(()=>[...e[20]||(e[20]=[p(" 模块化 ",-1)])]),_:1})):_("",!0),r.enabled?_("",!0):(t(),l("span",et," · 已停用"))])]),k(c(F),null,{default:v(()=>[k(c(S),{size:"tiny",onClick:le=>ve(r)},{default:v(()=>[...e[21]||(e[21]=[p("管理",-1)])]),_:1},8,["onClick"]),Z(r)?(t(),T(c(S),{key:0,size:"tiny",type:"primary",secondary:"",onClick:le=>fe(r)},{default:v(()=>[...e[22]||(e[22]=[p(" 在线编辑 ",-1)])]),_:1},8,["onClick"])):_("",!0),k(c(S),{size:"tiny",type:r.enabled?"warning":"primary",secondary:"",onClick:le=>ue(r,!r.enabled)},{default:v(()=>[p(w(r.enabled?"停用":"启用"),1)]),_:2},1032,["type","onClick"])]),_:2},1024)])}),128)),H.value.length?_("",!0):(t(),l("p",tt,"这个包里暂时没有插件"))])):a.value.step==="docs"?(t(),l("div",nt,[a.value.kind==="framework"?(t(),l(g,{key:0},[e[23]||(e[23]=s("p",null,[s("strong",null,"系统插件"),p("：`kind=framework`，`adapterScope=all`。菜单 / 生图 / Echo 属于这一包。")],-1)),e[24]||(e[24]=s("p",null,"可放在「系统插件包」与「本通道插件」两边同时显示。",-1)),e[25]||(e[25]=s("p",null,"支持模块化目录：`plugin/*.ts`，以及 adapter / workflow / http / events / www。",-1)),e[26]||(e[26]=s("p",null,[s("strong",null,"生图（#生图）"),p("：用框架自带浏览器把"),s("strong",null,"菜单/网页"),p("渲出来再截图发群， "),s("strong",null,"不是"),p(" AI 文生图。依赖控制台「环境配置」里的浏览器运行时（Playwright Chromium）。 ")],-1)),e[27]||(e[27]=s("p",null,"列表里点「在线编辑」可改本机插件源码，保存后按需热重载。",-1))],64)):(t(),l(g,{key:1},[e[28]||(e[28]=s("p",null,"通道插件：`kind=channel`，`adapterScope=channel` 或 `specified`，并用 `channels` 绑定通道。",-1)),e[29]||(e[29]=s("p",null,"指令以 `#` 开头；主人配置在通道层，不在插件列表里。",-1)),e[30]||(e[30]=s("p",null,"`id` 必须英文；`name` 写中文显示名。",-1)),e[31]||(e[31]=s("p",null,"需要网页截图时，复用系统插件「生图」同一套浏览器截图能力，不要自己再装一套。",-1))],64))])):_("",!0)]),_:1},8,["show"]),k(c(re),{show:U.value,"onUpdate:show":e[5]||(e[5]=r=>U.value=r),preset:"card",title:Q.value,style:{width:"min(480px, 94vw)"}},{footer:v(()=>[k(c(F),{justify:"end"},{default:v(()=>[k(c(S),{onClick:e[4]||(e[4]=r=>U.value=!1)},{default:v(()=>[...e[32]||(e[32]=[p("关闭",-1)])]),_:1}),O.value?(t(),T(c(S),{key:0,type:"primary",onClick:ce},{default:v(()=>[...e[33]||(e[33]=[p("保存配置",-1)])]),_:1})):_("",!0)]),_:1})]),default:v(()=>[O.value?(t(!0),l(g,{key:1},G(K.value,r=>(t(),l("label",{key:r.key,class:"field"},[p(w(r.label)+" ",1),k(c(Ie),{value:String(L.value[r.key]??""),"onUpdate:value":V=>L.value[r.key]=V},null,8,["value","onUpdate:value"])]))),128)):(t(),l("p",lt,w(M.value||"该插件暂未支持配置"),1))]),_:1},8,["show","title"]),k(c(re),{show:b.value,"onUpdate:show":e[9]||(e[9]=r=>b.value=r),preset:"card",title:`在线编辑 · ${u.value}`,style:{width:"min(720px, 96vw)"},segmented:{content:!0,footer:"soft"}},{footer:v(()=>[k(c(F),{justify:"end"},{default:v(()=>[y.value?(t(),T(c(S),{key:0,onClick:e[7]||(e[7]=r=>y.value="")},{default:v(()=>[...e[34]||(e[34]=[p("返回文件列表",-1)])]),_:1})):_("",!0),k(c(S),{onClick:e[8]||(e[8]=r=>b.value=!1)},{default:v(()=>[...e[35]||(e[35]=[p("关闭",-1)])]),_:1}),y.value?(t(),T(c(S),{key:1,type:"primary",loading:D.value,onClick:me},{default:v(()=>[...e[36]||(e[36]=[p("保存",-1)])]),_:1},8,["loading"])):_("",!0)]),_:1})]),default:v(()=>[y.value?(t(),l("div",rt,[s("p",it,[s("code",null,w(y.value),1)]),Ee(s("textarea",{"onUpdate:modelValue":e[6]||(e[6]=r=>I.value=r),class:"code",rows:"20"},null,512),[[Re,I.value]])])):(t(),T(c(Ue),{key:0,hoverable:"",clickable:""},{default:v(()=>[(t(!0),l(g,null,G(P.value,r=>(t(),T(c(Ve),{key:r.path,onClick:V=>ge(r.path)},{default:v(()=>[k(c(Me),{title:r.path,description:`${r.size} B`},null,8,["title","description"])]),_:2},1032,["onClick"]))),128))]),_:1}))]),_:1},8,["show","title"])]))}}),vt=Pe(at,[["__scopeId","data-v-27a086e5"]]);export{vt as default};
