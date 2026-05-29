import{h3 as c,fL as e,fa as r}from"./index-iKsKSpsI.js";import{$ as p}from"./ModalHeader-CxoNYPcm-BrfyvqLZ.js";import{e as f}from"./ErrorMessage-D8VaAP5m-DqOCwa5M.js";import{r as x}from"./LabelXs-oqZNqbm_-D6D-HWu-.js";import{d as h}from"./Address-DiVzpvVq-BofNTLE_.js";import{d as g}from"./shared-FM0rljBt-4p2MxchU.js";import{C as j}from"./check-CA7WBk13.js";import{C as u}from"./copy-7aDjzBiz.js";let v=r(g)`
  && {
    padding: 0.75rem;
    height: 56px;
  }
`,C=r.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`,y=r.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`,b=r.div`
  font-size: 12px;
  line-height: 1rem;
  color: var(--privy-color-foreground-3);
`,w=r(x)`
  text-align: left;
  margin-bottom: 0.5rem;
`,z=r(f)`
  margin-top: 0.25rem;
`,E=r(p)`
  && {
    gap: 0.375rem;
    font-size: 14px;
  }
`;const M=({errMsg:t,balance:i,address:a,className:d,title:n,showCopyButton:m=!1})=>{let[o,l]=c.useState(!1);return c.useEffect((()=>{if(o){let s=setTimeout((()=>l(!1)),3e3);return()=>clearTimeout(s)}}),[o]),e.jsxs("div",{children:[n&&e.jsx(w,{children:n}),e.jsx(v,{className:d,$state:t?"error":void 0,children:e.jsxs(C,{children:[e.jsxs(y,{children:[e.jsx(h,{address:a,showCopyIcon:!1}),i!==void 0&&e.jsx(b,{children:i})]}),m&&e.jsx(E,{onClick:function(s){s.stopPropagation(),navigator.clipboard.writeText(a).then((()=>l(!0))).catch(console.error)},size:"sm",children:e.jsxs(e.Fragment,o?{children:["Copied",e.jsx(j,{size:14})]}:{children:["Copy",e.jsx(u,{size:14})]})})]})}),t&&e.jsx(z,{children:t})]})};export{M as j};
