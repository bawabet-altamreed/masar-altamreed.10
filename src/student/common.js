import { guard } from "../core/guard.js"; import { shell } from "../core/layout.js";
export function start(title,render){guard("student",{requireActiveSubscription:true});window.addEventListener("masar-ready",e=>{document.querySelector("#root").innerHTML=shell("student",title,render(e.detail));});}
