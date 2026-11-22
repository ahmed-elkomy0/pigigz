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
- `vercel.json` — إعدادات البناء والتشغيل والهيدرز على Vercel
- `.env.example` — أسماء متغيرات البيئة المطلوبة على السيرفر (من غير قيم)

## متغيرات البيئة المطلوبة على السيرفر

| المتغير | فايدته | منين ييجي |
| --- | --- | --- |
| `PI_NETWORK_API_KEY` | مفتاح سيرفر التطبيق: الموافقة على دفع العميل وإتمامه، وإنشاء دفعات التطبيق للفريلانسر | Pi Developer Portal ← تطبيق PiGigz ← Settings ← API key (بيظهر كامل مرة واحدة بس لما يتولّد) |
| `PI_WALLET_SEED` | سر محفظة التطبيق (بيبدأ بحرف `S`): توقيع معاملة دفع الفريلانسر على بلوكتشين Pi Testnet | إعداد محفظة التطبيق (App Wallet) في Pi Developer Portal |

- المتغيرات دي سرية: بتتحط في إعدادات الاستضافة بس، وممنوع تتحط في الكود أو
  في أي ملف بيترفع على GitHub (ملف `.env.example` فيه الأسماء بس).
- طول ما المتغيرات مش محطوطة، التطبيق بيشتغل بمحاكاة Testnet موضّحة في
  الواجهة، وبيتحوّل للدفع الحقيقي تلقائيًا أول ما تتحط.

## خطوات النشر على Vercel من GitHub

1. ارفع الكود على GitHub: اعمل Repository جديد وحط فيه ملفات المشروع
   (ملف `.gitignore` الجاهز بيمنع رفع الأسرار وقاعدة البيانات وملفات البناء).
2. في [Vercel](https://vercel.com) دوس **Add New → Project** واختار
   **Import** للـ Repository. لو سجّلت في Vercel بالإيميل، اربط حساب GitHub
   الأول من **Settings → Connected Accounts** عشان الـ Repository يظهر.
3. إعدادات البناء بتتقرأ تلقائيًا من `vercel.json`، متغيّرش حاجة:
   - Install Command: `bun install`
   - Build Command: `bun run build`
   - Output Directory: `client/dist`
4. قبل أول Deploy، ضيف متغيرات البيئة: من صفحة المشروع روح
   **Settings → Environment Variables** وضيف `PI_NETWORK_API_KEY` و
   `PI_WALLET_SEED` (اختار Production و Preview)، بالقيم اللي معاك من
   Pi Developer Portal. متكتبهومش في أي مكان تاني.
5. دوس **Deploy** واستنى البناء يخلص، وبعدها هتاخد دومين عام بصيغة
   `https://<project>.vercel.app`.
6. اربط الدومين بـ Pi: في Pi Developer Portal ← تطبيق PiGigz، حدّث حقل
   **Development URL** (وهو الـ `frontend_url` بتاع التطبيق) لدومين Vercel
   الجديد، وبعدها كمّل خطوة **التحقق من ملكية الدومين (Domain Validation)**
   لو اتطلبت: Vercel بيضيف ملف التحقق أو سجل DNS حسب ما Pi يطلب، ولازم
   التحقق ينجح عشان التطبيق يفتح جوه Pi Sandbox و Pi Browser وياخد
   رابط Pi الرسمي.

## الأمان والتضمين داخل Pi

ملف `vercel.json` بيضيف هيدر `Content-Security-Policy` مضبوط على احتياجات
التطبيق:

- `frame-ancestors` بيسمح بالتضمين من `sandbox.minepi.com` ودومينات
  `minepi.com` بس، عشان التطبيق يشتغل جوه Pi Sandbox و Pi Browser ومحدش
  تاني يضمّنه في موقع غريب.
- `script-src` بيسمح بسكربت Pi SDK الرسمي (`sdk.minepi.com`)، و
  `connect-src` بيسمح بـ Pi Platform API و Pi Testnet Horizon وخوادم
  بلاطات الخريطة وخطوط Google — وكل حاجة تانية مقفولة افتراضيًا.

## ملحوظة عن التشغيل

واجهة التطبيق بتتنشر من `client/dist` بهيدرز الأمان اللي فوق. أكشنز السيرفر
وقاعدة البيانات لازم يشتغلوا على سيرفر يقدر يحط متغيرات البيئة اللي فوق؛
على Vercel بتتحط من **Settings → Environment Variables** زي ما هو موضّح في
الخطوة 4.
