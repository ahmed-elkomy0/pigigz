# PiGigz — باي جيجز

سوق خدمات حرة للروّاد (Pioneers) في مصر والعالم العربي، الدفع فيه بعملة Pi:
الفريلانسر ينشر خدمة بسعر Pi، العميل يدفع ويتحجز المبلغ في الضمان (escrow)،
وبعد التسليم والموافقة التطبيق يدفع للفريلانسر ناقص عمولة 10%.

واجهة عربي/إنجليزي (RTL/LTR)، دخول حقيقي بحساب Pi، دفع Pi حقيقي في الاتجاهين
(عميل ← التطبيق ← فريلانسر) على Testnet، وخريطة استكشاف تفاعلية (كرة ثلاثية
الأبعاد + خريطة مسطحة).

## بنية المشروع

- `client/` — واجهة React (المخرجات الجاهزة للنشر في `client/dist`)
- `server/` — أكشنز السيرفر وقاعدة بيانات SQLite (الطلبات، الدفع، الضمان)
- `server/src/vercel-entry.ts` + `server/gen-vercel.mjs` — تشغيل نفس
  الأكشنز على Vercel: البناء بيولّد `.vercel/output` (بصيغة Vercel Build
  Output API) فيه الموقع الثابت ودالة سيرفر (Serverless Function) بترد
  على `POST /actions` وبتشغّل نفس الأكشنز ونفس معالجات دفع Pi، وقاعدة
  البيانات على libSQL مستضافة (Turso)
- `vendor/space-sdk.tgz` — نسخة مضمّنة من حزمة `@hatch/space-sdk` جوه
  المشروع نفسه، فالتثبيت (`bun install`) يشتغل في أي مكان من غير أي مسار
  محلي على جهاز معيّن
- `vercel.json` — إعدادات البناء على Vercel (الهيدرز والراوتس بتتولّد
  جوه `.vercel/output/config.json` وقت البناء)
- `.env.example` — أسماء متغيرات البيئة المطلوبة على السيرفر (من غير قيم)

## متغيرات البيئة المطلوبة على السيرفر

| المتغير | فايدته | منين ييجي |
| --- | --- | --- |
| `PI_NETWORK_API_KEY` | مفتاح سيرفر التطبيق: الموافقة على دفع العميل وإتمامه، وإنشاء دفعات التطبيق للفريلانسر | Pi Developer Portal ← تطبيق PiGigz ← Settings ← API key (بيظهر كامل مرة واحدة بس لما يتولّد) |
| `PI_WALLET_SEED` | سر محفظة التطبيق (بيبدأ بحرف `S`): توقيع معاملة دفع الفريلانسر على بلوكتشين Pi Testnet | إعداد محفظة التطبيق (App Wallet) في Pi Developer Portal |
| `TURSO_DATABASE_URL` | عنوان قاعدة بيانات libSQL المستضافة اللي السوق بيخزّن فيها بياناته على Vercel (بصيغة `libsql://…`) | حساب مجاني على [Turso](https://turso.tech): اعمل Database وانسخ الـ URL بتاعها |
| `TURSO_AUTH_TOKEN` | توكن الوصول لقاعدة بيانات Turso | من صفحة نفس قاعدة البيانات في Turso (Create Token) |

- المتغيرات دي سرية: بتتحط في إعدادات الاستضافة بس، وممنوع تتحط في الكود أو
  في أي ملف بيترفع على GitHub (ملف `.env.example` فيه الأسماء بس).
- طول ما متغيرات Pi مش محطوطة، التطبيق بيشتغل بمحاكاة Testnet موضّحة في
  الواجهة، وبيتحوّل للدفع الحقيقي تلقائيًا أول ما تتحط.
- قاعدة البيانات على Vercel لازم تكون مستضافة: دوال Vercel المؤقتة
  (Serverless) مفيهاش ديسك دائم، فمن غير `TURSO_DATABASE_URL` الدالة
  بتستخدم ملف مؤقت جوه نسختها — الموقع هيفتح ويشتغل للتجربة، لكن
  البيانات مش دائمة وبتختلف من نسخة دالة للتانية. حط متغيرات Turso
  عشان البيانات تفضل محفوظة بجد.

## خطوات النشر على Vercel من GitHub

1. ارفع الكود على GitHub: اعمل Repository جديد وحط فيه ملفات المشروع
   (ملف `.gitignore` الجاهز بيمنع رفع الأسرار وقاعدة البيانات وملفات البناء).
2. في [Vercel](https://vercel.com) دوس **Add New → Project** واختار
   **Import** للـ Repository. لو سجّلت في Vercel بالإيميل، اربط حساب GitHub
   الأول من **Settings → Connected Accounts** عشان الـ Repository يظهر.
3. إعدادات البناء بتتقرأ تلقائيًا من `vercel.json`، متغيّرش حاجة:
   - Install Command: `bun install`
   - Build Command: `bun run build`
   - الـ Output مش مجلد ثابت: البناء بيولّد `.vercel/output` كامل
     (الموقع + دالة `/actions`)، فسيب أي إعداد Output على افتراضيته.
4. قبل أول Deploy، ضيف متغيرات البيئة: من صفحة المشروع روح
   **Settings → Environment Variables** وضيف الأربعة (اختار Production
   و Preview): `PI_NETWORK_API_KEY` و `PI_WALLET_SEED` بالقيم اللي معاك
   من Pi Developer Portal، و `TURSO_DATABASE_URL` و `TURSO_AUTH_TOKEN`
   من قاعدة بيانات Turso اللي عملتها. متكتبهومش في أي مكان تاني.
5. دوس **Deploy** واستنى البناء يخلص، وبعدها هتاخد دومين عام بصيغة
   `https://<project>.vercel.app`.
6. اربط الدومين بـ Pi: في Pi Developer Portal ← تطبيق PiGigz، حدّث حقل
   **Development URL** (وهو الـ `frontend_url` بتاع التطبيق) لدومين Vercel
   الجديد، وبعدها كمّل خطوة **التحقق من ملكية الدومين (Domain Validation)**
   لو اتطلبت: Vercel بيضيف ملف التحقق أو سجل DNS حسب ما Pi يطلب، ولازم
   التحقق ينجح عشان التطبيق يفتح جوه Pi Sandbox و Pi Browser وياخد
   رابط Pi الرسمي.

## الأمان والتضمين داخل Pi

البناء بيولّد هيدر `Content-Security-Policy` في
`.vercel/output/config.json` مضبوط على احتياجات التطبيق:

- `frame-ancestors` بيسمح بالتضمين من `sandbox.minepi.com` ودومينات
  `minepi.com` بس، عشان التطبيق يشتغل جوه Pi Sandbox و Pi Browser ومحدش
  تاني يضمّنه في موقع غريب.
- `script-src` بيسمح بسكربت Pi SDK الرسمي (`sdk.minepi.com`)، و
  `connect-src` بيسمح بـ Pi Platform API و Pi Testnet Horizon وخوادم
  بلاطات الخريطة وخطوط Google — وكل حاجة تانية مقفولة افتراضيًا.

## ملحوظة عن التشغيل

من غير دالة سيرفر، الموقع الثابت بيفتح لكن كل طلب `POST /actions` بيرجع
404 والتطبيق بيظهر «حصلت مشكلة في التحميل» — عشان كده البناء بيولّد
دالة Vercel باسم `actions` وبيوجّه لها أي طلب `/actions` قبل ما يخدم
الملفات الثابتة. الدالة بتشغّل نفس كود السيرفر بالكامل: السوق، الضمان،
الشات، طلبات الشغل، المحفظة، والدفع الحقيقي لما مفاتيح Pi موجودة في
متغيرات البيئة (والدالة بتقرأ نفس أسماء المتغيرات
`PI_NETWORK_API_KEY` / `PI_WALLET_SEED` من إعدادات Vercel مباشرة).
