import { start } from "./common.js"; import { fmtDate,statusText } from "../core/ui.js";
start("لوحة تحكم الطالب",u=>`<h1>مرحبًا ${u.name||""}</h1><div class="grid">
<div class="card"><div>المرحلة</div><div class="stat">${u.stage||"—"}</div></div>
<div class="card"><div>الاشتراك</div><div class="stat">${statusText(u.subscriptionStatus)}</div></div>
<div class="card"><div>ينتهي في</div><div class="stat">${fmtDate(u.subscriptionEnd)}</div></div>
</div><div class="card"><h3>المحتوى المخصص لك</h3><p>ستظهر هنا المحاضرات والاختبارات والتنبيهات الخاصة بمرحلتك فقط.</p></div>`);
