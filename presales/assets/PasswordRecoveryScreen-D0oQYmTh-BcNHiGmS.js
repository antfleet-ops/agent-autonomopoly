import{h3 as a,fM as R,ax as _,eJ as T,fL as e,cL as E,i0 as F,di as U,fa as p,eI as W}from"./index-BO8doAA9.js";import{F as N}from"./ShieldCheckIcon-BMFNqQ2p.js";import{m as O}from"./ModalHeader-CxoNYPcm-7mYNvjbv.js";import{l as V}from"./Layouts-BlFm53ED-BbovkXPK.js";import{g as H,h as M,u as z,b as L,k as B}from"./shared-DchfUPW1-B-mIZA_i.js";import{w as s}from"./Screen-DjSkXYWO-BwYLYKn0.js";import"./index-Dq_xe9dz-B6mFek4a.js";const re={component:()=>{let[o,y]=a.useState(!0),{authenticated:m,user:b}=R(),{walletProxy:i,closePrivyModal:v,createAnalyticsEvent:x,client:j}=_(),{navigate:k,data:C,onUserCloseViaDialogOrKeybindRef:$}=T(),[l,A]=a.useState(void 0),[f,d]=a.useState(""),[c,g]=a.useState(!1),{entropyId:h,entropyIdVerifier:S,onCompleteNavigateTo:w,onSuccess:u,onFailure:I}=C.recoverWallet,n=(r="User exited before their wallet could be recovered")=>{v({shouldCallAuthOnSuccess:!1}),I(typeof r=="string"?new U(r):r)};return $.current=n,a.useEffect((()=>{if(!m)return n("User must be authenticated and have a Privy wallet before it can be recovered")}),[m]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:N,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:n}),e.jsx(s.Body,{children:e.jsx(D,{children:e.jsxs("div",{children:[e.jsxs(H,{children:[e.jsx(M,{type:o?"password":"text",onChange:r=>(t=>{t&&A(t)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),e.jsx(z,{style:{right:"0.75rem"},children:o?e.jsx(L,{onClick:()=>y(!1)}):e.jsx(B,{onClick:()=>y(!0)})})]}),!!f&&e.jsx(J,{children:f})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(K,{loading:c||!i,disabled:!l,onClick:async()=>{g(!0);let r=await j.getAccessToken(),t=E(b,h);if(!r||!t||l===null)return n("User must be authenticated and have a Privy wallet before it can be recovered");try{x({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await(i==null?void 0:i.recover({accessToken:r,entropyId:h,entropyIdVerifier:S,recoveryPassword:l})),d(""),w?k(w):v({shouldCallAuthOnSuccess:!1}),u==null||u(t),x({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(P){F(P)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{g(!1)}},$hideAnimations:!h&&c,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let D=p.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,J=p.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,K=p(O)`
  ${({$hideAnimations:o})=>o&&W`
      && {
        // Remove animations because the recoverWallet task on the iframe partially
        // blocks the renderer, so the animation stutters and doesn't look good
        transition: none;
      }
    `}
`;export{re as PasswordRecoveryScreen,re as default};
