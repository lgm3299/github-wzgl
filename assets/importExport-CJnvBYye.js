function h(o,r){const t=o.map(c=>c.label).join(","),s=o.map(c=>"").join(","),l=`\uFEFF${t}
${s}`,e=new Blob([l],{type:"text/csv;charset=utf-8;"}),n=document.createElement("a");n.href=URL.createObjectURL(e),n.download=`${r}.csv`,n.click(),URL.revokeObjectURL(n.href)}function p(o,r,t){const s=r.map(a=>a.label).join(","),l=o.map(a=>r.map(u=>{let f=a[u.key];if(f==null)return"";const i=String(f);return i.includes(",")||i.includes(`
`)||i.includes('"')?`"${i.replace(/"/g,'""')}"`:i}).join(",")),e=`\uFEFF${s}
${l.join(`
`)}`,n=new Blob([e],{type:"text/csv;charset=utf-8;"}),c=document.createElement("a");c.href=URL.createObjectURL(n),c.download=`${t}.csv`,c.click(),URL.revokeObjectURL(c.href)}function d(o){const r=[];let t=[],s="",l=!1;for(let e=0;e<o.length;e++){const n=o[e];l?n==='"'?e+1<o.length&&o[e+1]==='"'?(s+='"',e++):l=!1:s+=n:n==='"'?l=!0:n===","?(t.push(s),s=""):n===`
`||n==="\r"?(n==="\r"&&e+1<o.length&&o[e+1]===`
`&&e++,t.push(s),t.some(c=>c.trim()!=="")&&r.push(t),t=[],s=""):s+=n}return t.push(s),t.some(e=>e.trim()!=="")&&r.push(t),r}function m(o,r){const t=d(o);return t.length<2?[]:t.slice(1).map(l=>{const e={};return r.forEach((n,c)=>{const a=l[c]||"",u=Number(a);e[n.key]=a===""?null:!isNaN(u)&&a.trim()!==""?u:a}),e})}export{h as a,m as c,p as d};
