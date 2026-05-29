import{eJ as F,fZ as I,ax as T,h3 as u,eK as k,fL as t,f$ as x,a as O,fa as n}from"./index-iKsKSpsI.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-CGEP9iMQ.js";import{n as B}from"./OpenLink-DZHy38vr-CTnHE4Jc.js";import{C as E}from"./QrCode-OkYCvx8_-D7cNaEoi.js";import{n as A}from"./ScreenLayout-DW4XCaib-ov8LrQNU.js";import{l as h}from"./farcaster-DPlSjvF5-D4eYrZnn.js";import"./dijkstra-COg3n3zL.js";import"./ModalHeader-CxoNYPcm-BrfyvqLZ.js";import"./Screen-DjSkXYWO-CpMk095U.js";import"./index-Dq_xe9dz-BZVDm0Yz.js";let S="#8a63d2";const M=({appName:p,loading:m,success:i,errorMessage:e,connectUri:r,onBack:s,onClose:c,onOpenFarcaster:o})=>t.jsx(A,x.isMobile||m?x.isIOS?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${p} to add casts, likes, follows, and more on your behalf.`,icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},primaryCta:r&&o?{label:"Open Farcaster app",onClick:o}:void 0,onBack:s,onClose:c,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},onBack:s,onClose:c,watermark:!0,children:r&&x.isMobile&&t.jsx(_,{children:t.jsx(B,{text:"Take me to Farcaster",url:r,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${p} to add casts, likes, follows, and more on your behalf.`,onBack:s,onClose:c,watermark:!0,children:t.jsxs(L,{children:[t.jsx(R,{children:r?t.jsx(E,{url:r,size:275,squareLogoElement:h}):t.jsx(V,{children:t.jsx(O,{})})}),t.jsxs(N,{children:[t.jsx(P,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),r&&t.jsx(q,{text:r,itemName:"link",color:S})]})]})});let _=n.div`
  margin-top: 24px;
`,L=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,R=n.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,N=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,P=n.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,V=n.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const X={component:()=>{let{lastScreen:p,navigateBack:m,data:i}=F(),e=I(),{requestFarcasterSignerStatus:r,closePrivyModal:s}=T(),[c,o]=u.useState(void 0),[j,v]=u.useState(!1),[b,y]=u.useState(!1),f=u.useRef([]),a=i==null?void 0:i.farcasterSigner;u.useEffect((()=>{let w=Date.now(),l=setInterval((async()=>{if(!(a!=null&&a.public_key))return clearInterval(l),void o({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});a.status==="approved"&&(clearInterval(l),v(!1),y(!0),f.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),k)));let d=await r(a==null?void 0:a.public_key),C=Date.now()-w;d.status==="approved"?(clearInterval(l),v(!1),y(!0),f.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),k))):C>3e5?(clearInterval(l),o({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):d.status==="revoked"&&(clearInterval(l),o({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(l),f.current.forEach((d=>clearTimeout(d)))}}),[]);let g=(a==null?void 0:a.status)==="pending_approval"?a.signer_approval_url:void 0;return t.jsx(M,{appName:e.name,loading:j,success:b,errorMessage:c,connectUri:g,onBack:p?m:void 0,onClose:s,onOpenFarcaster:()=>{g&&(window.location.href=g)}})}};export{X as FarcasterSignerStatusScreen,M as FarcasterSignerStatusView,X as default};
