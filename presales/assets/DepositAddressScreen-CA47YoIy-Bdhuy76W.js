import{dA as ee,eJ as re,h3 as p,fL as r,ax as k,a as V,fa as d,A as te,fM as oe,hE as ne}from"./index-iKsKSpsI.js";import{n as b}from"./ScreenLayout-DW4XCaib-ov8LrQNU.js";import{n as q}from"./styles-DVyDvTdj-D_ukifKb.js";import{a as B,C as ie}from"./poll-C4ZlgE1N-CFF8wVLA.js";import{m as se}from"./ModalHeader-CxoNYPcm-BrfyvqLZ.js";import{C as ae}from"./QrCode-OkYCvx8_-D7cNaEoi.js";import{e as le,h as de,s as ce,g as ue,k as me,u as pe,d as he,l as fe,m as ge,F as ye,a as be,o as ve,f as xe,b as we}from"./floating-ui.react-DAss3aKB.js";import{m as ke}from"./CopyableText-D2t3Xzed-atUkoKCd.js";import{T as S}from"./triangle-alert-CiJgWEI7.js";import{c as T}from"./createLucideIcon-CSodERB6.js";import{C as F}from"./check-CA7WBk13.js";import{H as Ce}from"./hourglass-CXoC0chY.js";import"./Screen-DjSkXYWO-CpMk095U.js";import"./index-Dq_xe9dz-BZVDm0Yz.js";import"./dijkstra-COg3n3zL.js";import"./copy-7aDjzBiz.js";const je={path:"/api/v1/onramp/deposit_addresses/quote",method:"POST"},Ee={path:"/api/v1/onramp/deposit_addresses/orders/:order_id",method:"GET"},_e={path:"/api/v1/onramp/deposit_addresses/:deposit_address_id/next_order",method:"GET"},Se={path:"/api/v1/onramp/deposit_addresses/deposit_config",method:"GET"};/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=[["path",{d:"m18 15-6-6-6 6",key:"153udz"}]],Ne=T("chevron-up",Te);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],De=T("info",Ue);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=[["rect",{width:"5",height:"5",x:"3",y:"3",rx:"1",key:"1tu5fj"}],["rect",{width:"5",height:"5",x:"16",y:"3",rx:"1",key:"1v8r4q"}],["rect",{width:"5",height:"5",x:"3",y:"16",rx:"1",key:"1x03jg"}],["path",{d:"M21 16h-3a2 2 0 0 0-2 2v3",key:"177gqh"}],["path",{d:"M21 21v.01",key:"ents32"}],["path",{d:"M12 7v3a2 2 0 0 1-2 2H7",key:"8crl2c"}],["path",{d:"M3 12h.01",key:"nlz23k"}],["path",{d:"M12 3h.01",key:"n36tog"}],["path",{d:"M12 16v.01",key:"133mhm"}],["path",{d:"M16 12h1",key:"1slzba"}],["path",{d:"M21 12v.01",key:"1lwtk9"}],["path",{d:"M12 21v-1",key:"1880an"}]],W=T("qr-code",Ie);/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],Fe=T("undo-2",Ae),w=ee((()=>null)),C=e=>{w.getState()!==null&&w.setState(e)};class Re extends p.Component{static getDerivedStateFromError(){return{hasError:!0}}componentDidCatch(t,o){this.props.onError(t)}componentDidUpdate(t){t.resetKey!==this.props.resetKey&&this.state.hasError&&this.setState({hasError:!1})}render(){return this.state.hasError?null:this.props.children}constructor(...t){super(...t),this.state={hasError:!1}}}function f(){let e=w(),{closePrivyModal:t,privy:o}=k(),n=(e==null?void 0:e.params)??null,s=(e==null?void 0:e.config)??{status:"loading"},a=p.useCallback((i=>{C({modalState:i})}),[]),l=p.useCallback((async()=>{if(n){C({config:{status:"loading"}});try{let i=await o.fetchPrivyRoute(Se,{});C({config:{status:"ready",data:{currencies:i.currencies,chains:i.chains}}})}catch(i){throw C({config:{status:"error",error:i instanceof Error?i:Error("Failed to load deposit config")}}),i}}}),[n,o]),u=p.useCallback((()=>{if(!e)return;let{modalState:i}=e;i.step==="complete"?e.onComplete():i.step==="failed"?e.onError(Error("DEPOSIT_FAILED")):i.step==="error"?e.onError(Error(i.error)):i.step==="refunded"?e.onError(Error("DEPOSIT_REFUNDED")):e.onError(Error("USER_EXITED")),t({shouldCallAuthOnSuccess:!1})}),[e,t]);return{modalState:(e==null?void 0:e.modalState)??{step:"intro"},setModalState:a,config:s,retryConfig:l,params:n,close:u}}function $(e){return e.startsWith("eip155:")?"ethereum":e.startsWith("solana:")?"solana":e.startsWith("bip122:")?"bitcoin-segwit":e.startsWith("tron:")?"tron":void 0}function $e(e,t,o){let n=Number(e);return!Number.isFinite(n)||n===0?`1 ${t} ≈ ${e} ${o}`:n>=.01?`1 ${t} ≈ ${M(n)} ${o}`:`${M(1/n)} ${t} ≈ 1 ${o}`}function M(e){return e>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.round(e)):e>=100?new Intl.NumberFormat("en-US",{maximumFractionDigits:1}).format(e):e>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(e):new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(e)}function O(e,t){let o=Number(e);if(!Number.isFinite(o)||o===0)return e;let n=t!=null?o/10**t:o;return n>=1e3?new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(n):n>=1?new Intl.NumberFormat("en-US",{maximumFractionDigits:4}).format(n):n>=1e-4?new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(n):new Intl.NumberFormat("en-US",{maximumSignificantDigits:4}).format(n)}function A({address:e,caip2:t,config:o}){let n=Object.values(o.chains).find((s=>s.caip2===t));if(!n)return{symbol:e,decimals:void 0};for(let s of o.currencies){let a=s.chains.find((l=>l.chainId===n.chainId&&l.address.toLowerCase()===e.toLowerCase()));if(a)return{symbol:s.symbol.toUpperCase(),decimals:a.decimals}}return{symbol:e,decimals:void 0}}function P(e,t){for(let o of Object.values(t))if(o.caip2===e)return o.displayName;return e}function Me(e,t,o){let n=Number(e);if(!Number.isFinite(n)||n===0)return e;let s=t<=6?2:t<=9?4:6,a=10**s,l=Math.ceil(n/10**t*a)/a,u=new Intl.NumberFormat("en-US",{minimumFractionDigits:s,maximumFractionDigits:s}).format(l);return o?`${u} ${o}`:u}function Oe(){let{privy:e,refreshSessionAndUser:t}=k(),{user:o}=oe();return p.useCallback((async(n,s)=>{if(s)return{ok:!0,address:s};let a=(function(u,i){let c=$(u);if(!c)return;let m=i.find((h=>h.type==="wallet"&&h.chainType===c&&h.address));return m==null?void 0:m.address})(n,(o==null?void 0:o.linkedAccounts)??[]);if(a)return{ok:!0,address:a};let l=$(n);if(!l)return{ok:!1,error:"UNSUPPORTED_CHAIN"};try{let u=await e.fetchPrivyRoute(ne,{body:{chain_type:l}});return await t(),{ok:!0,address:u.address}}catch{return{ok:!1,error:"REFUND_WALLET_CREATION_FAILED"}}}),[e,t,o])}function X(){let{params:e,setModalState:t}=f(),{privy:o}=k(),n=Oe(),[s,a]=p.useState(!1);return{fetchQuote:p.useCallback((async(l,u)=>{if(e){a(!0);try{let i=await n(l.caip2,e.refundAddress);if(!i.ok)return void t({step:"error",error:i.error});let c=await o.fetchPrivyRoute(je,{body:{source_chain:l.caip2,source_currency:l.currencyAddress,destination_chain:e.destinationChain,destination_currency:e.destinationCurrency,destination_address:e.destinationAddress,refund_address:i.address,...e.slippageBps!=null?{slippage_bps:e.slippageBps}:{}}});t({step:"address",selectedCurrency:u,selectedChain:l,quote:c})}catch(i){t({step:"error",error:(i instanceof Error?i:Error(String(i))).message})}finally{a(!1)}}}),[e,o,n,t]),isFetching:s}}let H=Math.ceil(360);function Y(e,t){switch(e.status){case"completed":return t({step:"complete",order:e});case"refunded":return t({step:"refunded",order:e});case"failed":return t({step:"failed",order:e});case"executing":return t({step:"processing",order:e});default:return e.status,t({step:"processing",order:e})}}function Pe({depositAddressId:e,enabled:t,quoteCreatedAt:o}){let{privy:n}=k(),{setModalState:s}=f();p.useEffect((()=>{if(!e)return;let a=new AbortController;return B({operation:async()=>(await n.fetchPrivyRoute(_e,{params:{deposit_address_id:e},query:{after:o}})).order??void 0,until:l=>l!==void 0,delay:5e3,interval:5e3,attempts:H,signal:a.signal}).then((l=>{a.signal.aborted||(l.status==="success"&&l.result?Y(l.result,s):l.status==="max_attempts"&&s({step:"error",error:"TIMEOUT_WAITING_FOR_NEXT_ORDER"}))})),()=>{a.abort()}}),[t,e,n,o,s])}function ze({orderId:e,enabled:t}){let{privy:o}=k(),{setModalState:n}=f();p.useEffect((()=>{let s=new AbortController;return B({operation:async()=>await o.fetchPrivyRoute(Ee,{params:{order_id:e}}),until:a=>a.status!=="executing",delay:5e3,interval:5e3,attempts:H,signal:s.signal}).then((a=>{s.signal.aborted||(a.status==="success"?Y(a.result,n):a.status==="max_attempts"&&n({step:"error",error:"TIMEOUT_ORDER_COMPLETION"}))})),()=>{s.abort()}}),[t,e,o,n])}const R=d(b)`
  #privy-content-footer-container {
    margin-top: 0;
  }
`,Le=d.p`
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.375rem;
  color: var(--privy-color-foreground-3);
  margin: 0.25rem 0 0;
`,G=d.img`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  object-fit: cover;
  flex-shrink: 0;
`,K=d.img`
  width: 2rem;
  height: 2rem;
  border-radius: var(--privy-border-radius-full);
  object-fit: cover;
  flex-shrink: 0;
`,Q=d.span`
  font-weight: 500;
`,Ve=d.span`
  font-size: 0.875rem;
  color: var(--privy-color-foreground-3);
  margin-left: auto;
`;d.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  min-height: 2.25rem;
  border-radius: 6.25rem;
  border: none;
  background-color: var(--privy-color-background-2);

  input {
    flex: 1;
    border: none;
    outline: none;
    box-shadow: none;
    font-size: 0.875rem;
    line-height: 1.25rem;
    background: transparent;
    color: var(--privy-color-foreground);

    &:focus {
      outline: none;
      box-shadow: none;
    }

    &::placeholder {
      color: var(--privy-color-foreground-3);
    }
  }
`;const J=d.button`
  && {
    position: relative;
    width: 100%;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.625rem 0.75rem;
    min-height: 3.5rem;
    border: 1px solid
      ${e=>e.$selected?"var(--privy-color-icon-interactive)":"var(--privy-color-foreground-4)"};
    border-radius: var(--privy-border-radius-md);
    background-color: ${e=>e.$selected?"var(--privy-color-info-bg)":"transparent"};
    color: var(--privy-color-foreground);
    font-size: 0.875rem;
    line-height: 1.5rem;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    transition:
      background-color 200ms ease,
      border-color 200ms ease;

    &:hover {
      background-color: var(--privy-color-background-2);
    }

    &:disabled {
      opacity: ${e=>e.$selected?1:.5};
      cursor: not-allowed;
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,z=d.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 0;
`,qe=d.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0.5rem 0;
`,U=d.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`,D=d.div`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: ${e=>e.$status==="done"?"var(--privy-color-success-light, #DCFCE7)":"var(--privy-color-background-2)"};
`,L=d.div`
  width: 2px;
  height: 1rem;
  background-color: var(--privy-color-background-2);
  margin-left: 0.6875rem;
`,I=d.span`
  font-size: 0.875rem;
  color: var(--privy-color-foreground);
`,Be=d.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--privy-border-radius-md);
  background-color: var(--privy-color-background-2);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-foreground-3);
`,j=d.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  line-height: 1.25rem;
`,E=d.span`
  color: var(--privy-color-foreground);
  font-weight: 400;
`,_=d.span`
  color: var(--privy-color-foreground);
  font-weight: 500;
  text-align: right;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`,Z=d(V)`
  && {
    margin-left: auto;
    height: 1.5rem;
    width: 1.5rem;
    border-width: 2px;
    flex-shrink: 0;
  }
`,We=({sourceAmount:e,sourceSymbol:t,sourceChainName:o,sourceDecimals:n,destinationAmount:s,destSymbol:a,destChainName:l,destDecimals:u,onClose:i})=>r.jsx(R,{icon:F,iconVariant:"success",title:"Transfer complete",subtitle:s?`Received ${O(e,n)} ${t} on ${o} and converted it to ${O(s,u)} ${a} on ${l}. Funds are available to use.`:`Your ${t} has been received and is now available in your wallet.`,showClose:!0,onClose:i,primaryCta:{label:"Done",onClick:i},watermark:!1});function Xe(){let{modalState:e,close:t,config:o}=f();if(e.step!=="complete"||o.status!=="ready")throw Error("UNEXPECTED_STATE");let{order:n}=e,{sourceSymbol:s,sourceChainName:a,sourceDecimals:l,destSymbol:u,destChainName:i,destDecimals:c}=p.useMemo((()=>{let m=A({address:n.source_currency,caip2:n.source_chain,config:o.data}),h=A({address:n.destination_currency,caip2:n.destination_chain,config:o.data});return{sourceSymbol:m.symbol,sourceChainName:P(n.source_chain,o.data.chains),sourceDecimals:m.decimals,destSymbol:h.symbol,destChainName:P(n.destination_chain,o.data.chains),destDecimals:h.decimals}}),[n,o]);return r.jsx(We,{sourceAmount:n.source_amount,sourceSymbol:s,sourceChainName:a,sourceDecimals:l,destinationAmount:n.destination_amount,destSymbol:u,destChainName:i,destDecimals:c,onClose:t})}function He(){let{modalState:e,setModalState:t,config:o,retryConfig:n,close:s}=f();if(e.step!=="error")throw Error("UNEXPECTED_STATE");let{error:a}=e,{title:l,subtitle:u,detail:i,iconVariant:c}=(v=>{switch(v){case"AMOUNT_TOO_LOW":return{title:"Amount too low",subtitle:"The deposit amount is below the minimum for this route.",detail:"Try a larger amount or a different token.",iconVariant:"warning"};case"INSUFFICIENT_LIQUIDITY":return{title:"Insufficient liquidity",subtitle:"There isn't enough liquidity for this route right now.",detail:"Try a smaller amount or a different network.",iconVariant:"warning"};case"UNSUPPORTED_CHAIN":return{title:"Unsupported chain",subtitle:"Deposits from this chain type aren't supported yet. Try a different network.",iconVariant:"warning"};case"UNSUPPORTED_CURRENCY":case"UNSUPPORTED_ROUTE":case"ROUTE_UNAVAILABLE":return{title:"Route not available",subtitle:"This deposit route isn't available right now. Try a different token or network.",iconVariant:"warning"};case"SANCTIONED_WALLET_ADDRESS":return{title:"Address restricted",subtitle:"This address cannot be used for deposits due to compliance restrictions.",iconVariant:"warning"};case"REFUND_WALLET_CREATION_FAILED":return{title:"Unable to set up refund address",subtitle:"We couldn't create a wallet to receive refunds on this chain. Please try again or select a different network.",iconVariant:"warning"};case"TIMEOUT_WAITING_FOR_NEXT_ORDER":case"TIMEOUT_ORDER_COMPLETION":return{title:"Taking longer than expected",subtitle:"Your funds are safe. The deposit is still being processed — check back later.",iconVariant:"subtle"};default:return{title:"Something went wrong",subtitle:"We couldn't complete your request. Please try again.",iconVariant:"subtle"}}})(a),[m,h]=p.useState(!1);return r.jsx(b,{icon:S,iconVariant:c,title:l,subtitle:u,showClose:!0,onClose:s,primaryCta:{label:"Try again",onClick:async()=>{if(o.status!=="ready"){h(!0);try{await n(),t({step:"token"})}catch{h(!1)}}else t({step:"token"})},loading:m},watermark:!0,children:i?r.jsxs(Be,{children:[r.jsx(S,{size:16,color:"var(--privy-color-foreground-3)",style:{flexShrink:0,marginTop:2}}),r.jsx("span",{children:i})]}):null})}function Ye(){let{modalState:e,close:t}=f();if(e.step!=="failed")throw Error("UNEXPECTED_STATE");let{order:o}=e;return r.jsx(b,{icon:S,iconVariant:"error",title:"Transfer failed",subtitle:"Something went wrong processing your transfer.",showClose:!0,onClose:t,primaryCta:{label:"Done",onClick:t},secondaryCta:{label:"Learn about manual recovery",onClick:()=>window.open("https://docs.privy.io","_blank","noopener,noreferrer")},watermark:!0,children:r.jsxs(Ge,{href:o.tracking_url,target:"_blank",rel:"noopener noreferrer",children:["Reference: ",o.provider_request_id]})})}let Ge=d.a`
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.7;
  text-decoration: underline;
  cursor: pointer;
  color: var(--privy-color-foreground-3);
`;function Ke(){let{close:e,setModalState:t,config:o}=f(),[n,s]=p.useState(!1);return p.useEffect((()=>{n&&(o.status==="ready"&&t({step:"token"}),o.status==="error"&&t({step:"error",error:"ROUTE_UNAVAILABLE"}))}),[n,o.status,t]),r.jsx(R,{icon:W,iconVariant:"subtle",title:"Add funds",subtitle:"Top up your account by sending crypto from any wallet. Conversion and routing handled by Relay.",showClose:!0,onClose:e,primaryCta:{label:"Continue",onClick:()=>s(!0),loading:n&&o.status==="loading",loadingText:null},watermark:!0})}function Qe(){let{modalState:e,setModalState:t,close:o}=f(),[n,s]=p.useState(-1);if(e.step!=="network")throw Error("UNEXPECTED_STATE");let{availableChains:a}=e,{confirm:l,isFetching:u}=(function(){let i=w(),{params:c}=f(),{fetchQuote:m,isFetching:h}=X();return{confirm:p.useCallback((async v=>{if(!v||!c)return;let g=i==null?void 0:i.modalState;g&&g.step==="network"&&await m(v,g.selectedCurrency)}),[c,i,m]),isFetching:h}})();return r.jsx(b,{title:"Select network",showBack:!0,onBack:()=>t({step:"token"}),showClose:!0,onClose:o,watermark:!0,children:r.jsx(q,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:a.map(((i,c)=>r.jsxs(J,{$selected:n===c,disabled:u,onClick:()=>{s(c),l(i)},children:[r.jsx(K,{src:i.iconUrl,alt:i.displayName}),r.jsx(Q,{children:i.displayName}),u&&c===n&&r.jsx(Z,{})]},i.chainId)))})})}const Je=({trackingUrl:e,onClose:t})=>r.jsx(b,{icon:Ce,iconVariant:"subtle",title:"Transfer in progress",subtitle:"Your deposit was received and the transfer is now processing.",showClose:!0,onClose:t,secondaryCta:{label:"View on block explorer ↗",onClick:()=>window.open(e,"_blank","noopener,noreferrer")},watermark:!1,children:r.jsxs(qe,{children:[r.jsxs(U,{children:[r.jsx(D,{$status:"done",children:r.jsx(F,{size:14,color:"var(--privy-color-icon-success)",strokeWidth:2})}),r.jsx(I,{children:"Deposit received"})]}),r.jsx(L,{}),r.jsxs(U,{children:[r.jsx(D,{$status:"active",children:r.jsx(Ze,{})}),r.jsx(I,{children:"Bridging"})]}),r.jsx(L,{}),r.jsxs(U,{children:[r.jsx(D,{$status:"pending"}),r.jsx(I,{children:"Funds arrived"})]})]})});let Ze=d.span`
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--privy-color-foreground-3);
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;function er(){let{modalState:e,close:t}=f();if(e.step!=="processing")throw Error("UNEXPECTED_STATE");let{order:o}=e;return ze({orderId:o.id,enabled:!0}),r.jsx(Je,{trackingUrl:o.tracking_url,onClose:t})}function rr(){let{modalState:e,close:t}=f();if(e.step!=="refunded")throw Error("UNEXPECTED_STATE");let{order:o}=e;return r.jsx(R,{icon:Fe,iconVariant:"subtle",title:"Transfer refunded",subtitle:"Your transfer was received, but the swap couldn't be completed. A refund has been started automatically.",showClose:!0,onClose:t,primaryCta:{label:"Done",onClick:t},secondaryCta:{label:"View transaction details",onClick:()=>window.open(o.tracking_url,"_blank","noopener,noreferrer")},watermark:!0})}function tr(){let{close:e,setModalState:t,config:o}=f(),{confirm:n,currencies:s,isFetching:a}=(function(){let{config:i,setModalState:c}=f(),{fetchQuote:m,isFetching:h}=X(),v=i.status==="ready"?i.data.currencies:[];return{confirm:p.useCallback((async g=>{if(i.status!=="ready"||!g)return;let N=g.chains.map((y=>{let x=i.data.chains[y.chainId];return x?{chainId:y.chainId,caip2:x.caip2,displayName:x.displayName,iconUrl:x.iconUrl,vmType:x.vmType,currencyAddress:y.address,currencyDecimals:y.decimals}:null})).filter((y=>y!==null));if(N.length!==1)c({step:"network",selectedCurrency:g,availableChains:N});else{let y=N[0];await m(y,g)}}),[i,m,c]),currencies:v,isFetching:h}})(),[l,u]=p.useState(-1);return r.jsx(b,{title:"Select token",showBack:!0,onBack:()=>t({step:"intro"}),showClose:!0,onClose:e,watermark:!0,children:o.status==="error"?r.jsx(z,{children:r.jsx(Le,{children:"Failed to load tokens"})}):o.status==="loading"?r.jsx(z,{children:r.jsx(V,{})}):r.jsx(q,{style:{marginTop:"1rem",height:"22rem"},$colorScheme:"light",children:s.map(((i,c)=>r.jsxs(J,{$selected:l===c,disabled:a,onClick:()=>{u(c),n(i)},children:[r.jsx(G,{src:i.logoURI,alt:i.symbol}),r.jsx(Q,{children:i.name}),a&&c===l?r.jsx(Z,{}):r.jsx(Ve,{children:i.symbol})]},i.symbol)))})})}function or({address:e,onClick:t}){let[o,n]=p.useState(!1);return r.jsx(r.Fragment,{children:o?r.jsx(nr,{onClick:()=>n(!1),style:{marginTop:"1.5rem"},children:r.jsx(ae,{url:e,size:312,hideLogo:!0})}):r.jsxs(ir,{title:"Click to copy address",onClick:t,style:{marginTop:"1.5rem"},children:[r.jsxs(sr,{children:[r.jsx(ar,{children:"Deposit address"}),r.jsx(lr,{children:e})]}),r.jsx(dr,{children:r.jsx(cr,{type:"button",onClick:s=>{s.stopPropagation(),n(!0)},children:r.jsx(W,{size:16,color:"var(--privy-color-icon-muted)"})})})]})})}let nr=d.div`
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: hidden;
`,ir=d.div`
  display: flex;
  border-radius: var(--privy-border-radius-md);
  background: var(--privy-color-background-clicked, #f1f2f9);
  padding: 1rem;
  cursor: pointer;
  gap: 0.5rem;
`,sr=d.div`
  flex: 1;
  min-width: 0;
  text-align: left;
`,ar=d.div`
  font-size: 0.75rem;
  color: var(--privy-color-icon-muted);
  line-height: 1rem;
  margin-bottom: 0.25rem;
`,lr=d.div`
  word-break: break-all;
  font-size: 0.875rem;
  font-family: ui-monospace, monospace;
  font-weight: 500;
  line-height: 1.375rem;
  color: var(--privy-color-foreground);
`,dr=d.div`
  width: 1.5rem;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 0.25rem;
`,cr=d.button`
  && {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    outline: none;
    box-shadow: none;
    border-radius: var(--privy-border-radius-xs);

    &:hover {
      background: var(--privy-color-background);
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`;function ur({quote:e,selectedCurrency:t,selectedChain:o,destinationSymbol:n}){let[s,a]=p.useState(!1),l=t.symbol.toUpperCase(),u=o.displayName,i=p.useRef(null);return r.jsxs(mr,{children:[r.jsxs(pr,{onClick:p.useCallback((()=>{let c=document.getElementById("privy-modal-content");c&&(i.current&&clearTimeout(i.current),c.style.transition="none",i.current=setTimeout((()=>{c.style.transition="",i.current=null}),160)),a((m=>!m))}),[]),children:[r.jsxs(hr,{children:[t.logoURI&&r.jsx(G,{src:t.logoURI,alt:l,style:{width:"2rem",height:"2rem"}}),o.iconUrl&&r.jsx(fr,{src:o.iconUrl,alt:u})]}),r.jsxs(gr,{children:[r.jsx(yr,{children:"You send"}),r.jsxs(br,{children:[l," on ",u]})]}),r.jsx(vr,{children:r.jsx(s?Ne:ie,{size:16})})]}),r.jsx(Cr,{$expanded:s,children:r.jsx(jr,{children:r.jsxs(xr,{children:[e.indicative_rate&&r.jsxs(j,{children:[r.jsx(E,{children:"Conversion rate"}),r.jsxs(_,{style:{display:"flex",alignItems:"center",gap:"0.25rem"},children:[$e(e.indicative_rate,l,n.toUpperCase()),r.jsx(Er,{content:"Estimated rate based on current market conditions. Final execution price may vary depending on transfer size and routing."})]})]}),r.jsxs(j,{children:[r.jsx(E,{children:"Max slippage"}),r.jsxs(_,{children:[(e.slippage_bps/100).toFixed(1),"%"]})]}),e.minimum_amount&&o&&r.jsxs(j,{children:[r.jsx(E,{children:"Min amount"}),r.jsx(_,{children:Me(e.minimum_amount,o.currencyDecimals,t.symbol)})]}),r.jsxs(j,{children:[r.jsx(E,{children:"Refund address"}),r.jsx(_,{children:r.jsx(ke,{value:e.refund_address,iconOnly:!0,iconSize:11,children:te(e.refund_address,4,4)})})]})]})})}),r.jsxs(wr,{children:[r.jsx(S,{size:16,color:"var(--privy-color-icon-muted)",style:{flexShrink:0}}),r.jsxs(kr,{children:["Only send ",r.jsx("strong",{children:l})," on ",r.jsx("strong",{children:u}),". Other assets may be lost."]})]})]})}let mr=d.div`
  border-radius: var(--privy-border-radius-md);
  border: 1px solid var(--privy-color-foreground-4);
  overflow: hidden;
`,pr=d.button`
  && {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--privy-color-foreground);
    outline: none;
    box-shadow: none;

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }
  }
`,hr=d.span`
  position: relative;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
`,fr=d(K)`
  && {
    position: absolute;
    top: -0.125rem;
    right: -0.25rem;
    width: 0.75rem;
    height: 0.75rem;
    box-sizing: content-box;
    border: 1.5px solid #fff;
    background-color: #fff;
  }
`,gr=d.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`,yr=d.span`
  font-size: 0.75rem;
  color: var(--privy-color-foreground-3);
  line-height: 1rem;
`,br=d.span`
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
`,vr=d.span`
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--privy-border-radius-full);
  background-color: var(--privy-color-background-clicked, #f1f2f9);
  color: var(--privy-color-foreground-3);
`,xr=d.div`
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.75rem;

  & > * {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--privy-color-foreground-4);
  }

  & > *:last-child {
    border-bottom: none;
  }
`,wr=d.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0.75rem 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--privy-border-radius-sm);
  background: #f8f9fc;
`,kr=d.span`
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--privy-color-icon-muted);
  text-align: left;
`,Cr=d.div`
  display: grid;
  grid-template-rows: ${({$expanded:e})=>e?"1fr":"0fr"};
  transition: grid-template-rows 150ms ease-out;
`,jr=d.div`
  overflow: hidden;
`;function Er({content:e}){let[t,o]=p.useState(!1),{refs:n,floatingStyles:s,context:a}=le({open:t,onOpenChange:o,placement:"top",whileElementsMounted:be,middleware:[ve(6),xe(),we({padding:8})]}),l=de(a,{move:!1,handleClose:ce()}),u=ue(a),{getReferenceProps:i,getFloatingProps:c}=me([l,u,pe(a),he(a),fe(a,{role:"tooltip"})]),{isMounted:m,styles:h}=ge(a,{duration:150});return r.jsxs(r.Fragment,{children:[r.jsx("button",{ref:n.setReference,type:"button","aria-label":"More information about conversion rate",style:{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:0,border:"none",background:"none",color:"var(--privy-color-icon-muted)",cursor:"pointer"},...i(),children:r.jsx(De,{size:14})}),m&&r.jsx(ye,{root:document.getElementById("privy-modal-content")??void 0,children:r.jsx(_r,{ref:n.setFloating,style:{...s,...h},...c(),children:e})})]})}let _r=d.div`
  max-width: 13rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--privy-border-radius-sm, 0.375rem);
  background: var(--privy-color-foreground);
  color: var(--privy-color-background);
  font-size: 0.6875rem;
  line-height: 1rem;
  font-weight: 400;
  text-align: left;
  z-index: 10;
`;const Sr=({quote:e,selectedCurrency:t,selectedChain:o,destinationSymbol:n,onBack:s,onClose:a})=>{var h;let[l,u]=p.useState(!1),i=((h=t==null?void 0:t.symbol)==null?void 0:h.toUpperCase())??"funds",c=(o==null?void 0:o.displayName)??"",m=async()=>{l||(await navigator.clipboard.writeText(e.deposit_address),u(!0),setTimeout((()=>u(!1)),2e3))};return r.jsxs(b,{title:`Send ${i}${c?` on ${c}`:""}`,subtitle:"Send funds to the address below. Conversion and routing handled by Relay.",showBack:!0,onBack:s,showClose:!0,onClose:a,watermark:!1,children:[r.jsx(ur,{quote:e,selectedCurrency:t,selectedChain:o,destinationSymbol:n}),r.jsx(or,{address:e.deposit_address,onClick:m}),r.jsx(se,{style:{marginTop:"1rem",marginBottom:"0.5rem",...l?{backgroundColor:"var(--privy-color-icon-success)",borderColor:"var(--privy-color-icon-success)"}:{}},onClick:m,children:l?r.jsxs(r.Fragment,{children:["Copied ",r.jsx(F,{size:16,style:{marginLeft:"0.25rem"}})]}):"Copy address"}),r.jsx(Tr,{children:"Routing and bridging are handled by Relay. Privy does not control execution timing, liquidity, or transaction outcomes."})]})};let Tr=d.p`
  && {
    margin: 0.5rem 0 0;
    font-size: 0.6875rem;
    line-height: 1.125rem;
    color: var(--privy-color-icon-muted);
    text-align: center;
  }
`;function Nr(){let{modalState:e,setModalState:t,close:o,config:n,params:s}=f();if(e.step!=="address"||n.status!=="ready")throw Error("UNEXPECTED_STATE");let{quote:a,selectedCurrency:l,selectedChain:u}=e;Pe({depositAddressId:a.id,enabled:!0,quoteCreatedAt:a.created_at});let i=p.useMemo((()=>l.chains.map((c=>{let m=n.data.chains[c.chainId];return m?{...m,currencyAddress:c.address,currencyDecimals:c.decimals}:null})).filter((c=>c!==null))),[l,n]);return r.jsx(Sr,{quote:a,selectedCurrency:l,selectedChain:u,destinationSymbol:p.useMemo((()=>{let c=(s==null?void 0:s.destinationCurrency)??"",m=(s==null?void 0:s.destinationChain)??"";return c&&m?A({address:c,caip2:m,config:n.data}).symbol:""}),[s==null?void 0:s.destinationCurrency,s==null?void 0:s.destinationChain,n]),onBack:()=>t({step:"network",selectedCurrency:l,availableChains:i}),onClose:o})}function Ur(){let{modalState:e,setModalState:t}=f();return r.jsx(Re,{onError:o=>t({step:"error",error:o.message||"UNEXPECTED_STATE"}),resetKey:e.step,children:r.jsx(Dr,{})})}function Dr(){let{modalState:e}=f();switch(e.step){case"intro":return r.jsx(Ke,{});case"token":return r.jsx(tr,{});case"network":return r.jsx(Qe,{});case"address":return r.jsx(Nr,{});case"processing":return r.jsx(er,{});case"complete":return r.jsx(Xe,{});case"refunded":return r.jsx(rr,{});case"failed":return r.jsx(Ye,{});case"error":return r.jsx(He,{});default:return null}}var Yr={component:()=>{let{onUserCloseViaDialogOrKeybindRef:e}=re(),t=w(),{close:o,config:n}=f();return p.useEffect((()=>{e.current=o}),[e,o]),p.useEffect((()=>{if(n.status==="ready"){for(let s of n.data.currencies)new Image().src=s.logoURI;for(let s of Object.values(n.data.chains))new Image().src=s.iconUrl}}),[n]),t?r.jsx(Ur,{}):null}};export{Yr as default};
