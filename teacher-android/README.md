# Teacher Android — مسار التمريض

## مهم قبل البناء

استبدل `google-services.json` الموجود هنا بملف Firebase الحقيقي لتطبيق Android
ذي package name:

`com.masaraltamreed.teacher`

## Firebase

التطبيق يستخدم:
- Firebase Authentication
- Cloud Firestore

المسار:
Firebase Auth → UID → users/{UID} → role=teacher + isActive=true
→ lectures/{lectureId} → teacherId=UID → roomName → LiveKit

## تسجيل الدخول

Firebase Auth يحتفظ بالجلسة، لذلك لن يظهر Login في كل مرة.
يظهر مرة أخرى فقط بعد Sign out أو انتهاء/فقدان الجلسة.

## LiveKit

نسخة SDK:
`2.28.1`

Development Token Server ID المستخدم للاختبار:
`masaraltamreed-5uoy7c`

هذا مناسب للاختبار فقط، وليس إعداد إنتاج نهائي.

## Deep Link

الصيغة الحالية:

`masaraltamreed://lecture?lectureId=LECTURE_ID`

الربط النهائي مع lectures.html يحتاج إضافة intent/deep-link handling بحيث يتم فتح
المحاضرة المطلوبة مباشرة داخل التطبيق.

## Screen Share

Android يطلب موافقة النظام على MediaProjection في كل جلسة مشاركة شاشة.
بعد الموافقة يستطيع المدرس مغادرة التطبيق وفتح PDF أو أي تطبيق آخر، وسيتم بث
شاشة الهاتف عبر LiveKit طالما أن جلسة المشاركة ما زالت فعالة.

## ملاحظة

هذه حزمة اختبار أولية. لا تعتبر APK إنتاجيًا قبل تجربة:
Login → Lecture → LiveKit → Camera → Camera switch → Screen Share
على جهاز Android فعلي.
