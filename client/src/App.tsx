import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api, type ApiResponse } from "./api";
import "./assets/hatch-maps.css";
import GlobeView from "./Globe";
import logoImg from "./assets/pigigz-logo.png";
import catDesign from "./assets/cat-design.webp";
import catCode from "./assets/cat-code.webp";
import catVideo from "./assets/cat-video.webp";
import catTranslation from "./assets/cat-translation.webp";
import catWriting from "./assets/cat-writing.webp";
import catMarketing from "./assets/cat-marketing.webp";

const FIELDS = actionFields<typeof Actions>();

type Gig = ApiResponse<typeof api, "listGigs">["gigs"][number];
type Order = ApiResponse<typeof api, "listOrders">["orders"][number];
type JobRequest = ApiResponse<typeof api, "listJobRequests">["requests"][number];
type Profile = ApiResponse<typeof api, "getFreelancerProfile">;
type Category = Gig["category"];
type View = "market" | "sell" | "jobs" | "orders" | "wallet" | "map";
type Lang = "ar" | "en";

const CATEGORIES: { key: Category; img: string }[] = [
  { key: "design", img: catDesign },
  { key: "code", img: catCode },
  { key: "video", img: catVideo },
  { key: "translation", img: catTranslation },
  { key: "writing", img: catWriting },
  { key: "marketing", img: catMarketing },
];

const CAT_IMG: Record<Category, string> = {
  design: catDesign,
  code: catCode,
  video: catVideo,
  translation: catTranslation,
  writing: catWriting,
  marketing: catMarketing,
};

/* ------------------------------------------------------------------ */
/* i18n: Arabic is the default (RTL); English switches the UI to LTR.  */
/* ------------------------------------------------------------------ */

const ar = {
  cat: {
    design: "تصميم",
    code: "برمجة",
    video: "مونتاج",
    translation: "ترجمة",
    writing: "كتابة",
    marketing: "تسويق",
  } as Record<Category, string>,
  nav: { market: "السوق", sell: "انشر خدمة", jobs: "طلبات الشغل", orders: "الطلبات", wallet: "المحفظة", map: "الخريطة" },
  langToggle: "English",
  testnetBadge: "وضع التجربة · Testnet",
  heroTitleA: "شغلك بالـ ",
  heroSubtitle:
    "سوق خدمات للبايونيرز في مصر والوطن العربي: اطلب تصميم، برمجة، مونتاج، ترجمة… وادفع بـ Pi. فلوسك محفوظة في ضمان PiGigz لحد ما تستلم شغلك وتوافق عليه.",
  statGigs: (n: number) => `${n} خدمة منشورة`,
  statCompleted: (n: number) => `${n} طلب اكتمل`,
  statVolume: (v: string) => `حجم التعاملات ${v}`,
  login: "الدخول بحساب Pi",
  loggingIn: "بنفتح دخول Pi…",
  logout: "تسجيل الخروج",
  verifyingSession: "مسجّل دخول بحساب Pi · بنأكد الجلسة…",
  accountVerified: "حساب Pi متأكد منه على السيرفر ✓",
  accountUnverified: "مسجّل دخول بحساب Pi · تحقق السيرفر لسه مكملش",
  accountCounts: (g: number, b: number, s: number) =>
    `خدماتي ${g} · اشتريت ${b} · بعت ${s}`,
  loginHintPi: "ادخل بحساب Pi عشان تنشر خدمات وتطلب باسمك.",
  loginHintWeb:
    "الدخول الحقيقي بيكمل من بيئة Pi الخاصة بالتطبيق (الـ Sandbox طول ما التطبيق على Testnet) — التصفح شغال من أي متصفح.",
  loginHintSandbox:
    "إنت في بيئة Pi Sandbox (تجربة Testnet) — الدخول بحساب Pi بيشتغل من هنا.",
  incompletePayment: (id: string) =>
    `عندك دفعة قديمة غير مكتملة على حسابك (رقمها ${id}) — هتتكمل أو تتلغي يدويًا.`,
  loginErrorSdk:
    "Pi SDK مش متاح هنا. افتح PiGigz من بيئة Pi (الـ Sandbox للتجربة) وسجّل دخولك.",
  loginErrorGeneric:
    "الدخول مكمّلش. اتأكد إنك فاتح من بيئة Pi الخاصة بالتطبيق (الـ Sandbox طول ما التطبيق على Testnet) ومسجّل دخول بحساب Pi، ووافق على طلب الدخول.",
  pinetNote:
    "تنبيه: إنت فاتح التطبيق من لينك PiNet (app5122.pinet.com)، ودي بيئة عرض محدودة من Pi — الدخول والدفع بـ Pi مش بيكملوا منها. وPiGigz لسه تطبيق Testnet، فالدخول بيه بيكمل من بيئة Pi Sandbox الرسمية للتجربة: افتح لينك الـ Sandbox بتاع التطبيق من متصفحك وسجّل دخولك من هناك.",
  loginErrorPinet:
    "Pi نفسه رفض الدخول برسالة «Authentication failed»: لينك PiNet مش بيكمّل تسجيل الدخول، وPiGigz تطبيق Testnet فدخوله بيكمل من بيئة Pi Sandbox الرسمية للتجربة — افتح لينك الـ Sandbox بتاع التطبيق وجرّب الدخول من هناك.",
  sandboxNote:
    "إنت دلوقتي في بيئة Pi Sandbox، وهي بيئة Pi الرسمية لتجربة تطبيقات Testnet زي PiGigz — الدخول بحساب Pi بيكمل من هنا. وافق على طلب الدخول وهيتم تسجيلك بحساب Pi بتاعك (Testnet).",
  loginErrorTestnet:
    "Pi نفسه رفض الدخول برسالة «Authentication failed». السبب: PiGigz لسه تطبيق Testnet، وقشرة Pi Browser الحية (Mainnet) مش بتكمّل دخول تطبيقات Testnet — التحقق الداخلي بتاع Pi بيفشل بعد الموافقة على الصلاحيات على طول. الدخول للتجربة بيكمل من بيئة Pi Sandbox الرسمية: افتح لينك الـ Sandbox بتاع التطبيق وسجّل دخولك من هناك.",
  openSandbox: "افتح بيئة Pi Sandbox",
  logoAltHeader:
    "لوجو PiGigz الرسمي: فريلانسر قاعد على لابتوب وحوله كروت خدمات نازلة عليه",
  logoAltHero:
    "لوجو PiGigz الرسمي: فريلانسر قاعد على لابتوب ذهبي وحوله كروت خدمات — تصميم وترجمة ومونتاج وتسويق — نازلة عليه، بألوان موف غامق وذهبي",
  gateTitle: "سجّل دخولك بـ Pi الأول",
  gateBody: (action: string) =>
    `${action} بيتم بحساب Pi بتاعك، واسمك في Pi هو اللي بيظهر على شغلك وطلباتك — مفيش تسجيل منفصل ولا كلمة سر جديدة.`,
  gatePreparing: "بنجهّز Pi SDK…",
  gateStepsTitle: "الدخول بيشتغل من بيئة Pi بس:",
  gateSteps: [
    "PiGigz لسه تطبيق Testnet، والدخول للتجربة بيكمل من بيئة Pi Sandbox الرسمية.",
    "افتح لينك الـ Sandbox بتاع التطبيق من المتصفح، وفعّل الـ Sandbox من تطبيق Pi (Pi Utilities ← Authorize Sandbox) لو اتطلب منك.",
    "من جوه الـ Sandbox دوس «الدخول بحساب Pi» ووافق على صلاحيات الاسم والدفع وعنوان المحفظة.",
  ],
  gateWebNote:
    "المتصفح العادي مفيهوش حساب Pi، فالدخول الحقيقي مش هيكمل منه — لكن التصفح والبحث شغالين عادي. وفتح التطبيق من Pi Browser مباشرة مش بيكمّل دخول تطبيقات Testnet؛ بيئة التجربة الرسمية هي الـ Sandbox.",
  gateIncomplete: (id: string) =>
    `عندك دفعة قديمة غير مكتملة على حسابك (رقمها ${id}) — فريق PiGigz هيكمّلها أو يلغيها يدويًا.`,
  searchLabel: "دوّر على خدمة",
  searchPlaceholder: "دوّر على خدمة أو فريلانسر…",
  publishCta: "+ انشر خدمتك",
  categoryFilterNote: (label: string) => `بتشوف قسم ${label} بس — `,
  showAll: "شوف الكل",
  loadingGigs: "بنحمّل الخدمات…",
  loadError: "حصلت مشكلة في التحميل. حدّث الصفحة وحاول تاني.",
  emptyGigsTitle: "لسه مفيش خدمات هنا",
  emptyGigsSearch:
    "مفيش نتائج مطابقة لبحثك. جرّب كلمة تانية أو شوف كل الأقسام.",
  emptyGigsFresh: "السوق لسه بيبدأ. كن أول فريلانسر ينشر خدمته ويقبض بـ Pi.",
  publishFirst: "انشر أول خدمة",
  pausedBadge: "متوقفة مؤقتًا",
  piAccountBadge: "حساب Pi",
  ordersCount: (n: number) => `${n} طلب`,
  deliveryIn: (d: number) => `التسليم في ${d} ${d === 1 ? "يوم" : "أيام"}`,
  orderNow: "اطلب دلوقتي",
  catImgAlt: (label: string) => `رسمة توضيحية لقسم ${label}`,
  backToMarket: "→ ارجع للسوق",
  gigNotFound: "الخدمة دي مش موجودة.",
  offeredBy: "بيقدّمها",
  ratingsFrom: (avg: number, n: number) => `${avg} من ${n} تقييم`,
  totalPrice: "السعر الإجمالي",
  commissionLine: "عمولة PiGigz ‏(10%)",
  sellerNetLine: "اللي هيوصل للفريلانسر بعد اعتمادك",
  escrowExplain:
    "الدفع بيتحجز في ضمان PiGigz الأول، ومش بيتحوّل للفريلانسر غير لما يسلّم الشغل وإنت تعتمده من صفحة الطلبات.",
  gigPausedNote: "الخدمة دي متوقفة مؤقتًا ومش متاحة للطلب دلوقتي.",
  ownGigNote: (u: string) =>
    `دي خدمتك إنت يا @${u} — مش هينفع تطلبها من نفسك. حد تاني من البايونيرز يقدر يطلبها بحسابه.`,
  orderAsNote: (u: string) =>
    `هتطلب باسم حساب Pi بتاعك: @${u} — والطلب هيتربط بحسابك عشان إنت بس اللي تعتمد التسليم أو تلغي.`,
  briefLabel: "اشرح طلبك للفريلانسر",
  briefPlaceholder:
    "مثال: عايز لوجو لمحل قهوة، ألوانه بني ودهبي، والتسليم PNG وملف المصدر…",
  briefError: "اشرح طلبك في جملة واضحة على الأقل.",
  payBtn: (price: string) => `ادفع ${price} بـ Pi`,
  paySimNote:
    "الدخول بحساب Pi حقيقي ومربوط باسمك، لكن خطوة الدفع لسه محاكاة Testnet — الدفع الفعلي بيشتغل تلقائيًا أول ما المطوّر يفعّل مفتاح API السيرفر من بوابة مطوّري Pi.",
  payRealNote:
    "الدفع حقيقي على Testnet عبر Pi: هتوقّع الدفعة من محفظتك، والسيرفر بيوافق عليها ويكمّلها على الشبكة، والمبلغ بيتحجز في ضمان PiGigz.",
  payCancelled: "الدفعة اتلغت من محفظة Pi — مفيش حاجة اتخصمت.",
  payErrorGeneric: "الدفعة مكمّلتش. حاول تاني.",
  reviewsTitle: "تقييمات العملاء",
  loadingReviews: "بنحمّل التقييمات…",
  noReviews: "لسه مفيش تقييمات على الخدمة دي.",
  payDialogTitle: "الدفع بـ Pi",
  paySteps: [
    "التحقق من حساب Pi بتاعك…",
    "وقّع الدفعة من محفظتك…",
    "السيرفر بيوافق على الدفعة…",
    "بنكمّل الدفعة على الشبكة…",
  ],
  paySuccess: "الدفعة تمّت واتحجزت في الضمان",
  payRef: "رقم العملية",
  payPaid: "المدفوع",
  payNetLine: "هيتحوّل للفريلانسر بعد اعتمادك",
  viewMyOrders: "شوف طلباتي",
  needLogin: "لازم تسجّل دخولك بـ Pi الأول.",
  sellTitle: "انشر خدمتك واقبض بـ Pi",
  sellSubtitle:
    "العميل بيدفع الأول والفلوس بتتحجز في ضمان PiGigz، وبعد ما تسلّم ويعتمد العميل، بيتحوّل لك صافي المبلغ بعد عمولة 10%.",
  sellAsNote: (u: string) =>
    `بتنشر باسم حساب Pi بتاعك: @${u} — الخدمة هتتربط بحسابك، وإنت بس اللي تقدر توقّفها أو تفعّلها، والطلبات اللي تجيلك هتوصلك على نفس الحساب.`,
  sellDone: "خدمتك اتنشرت في السوق.",
  sellDoneLink: "شوفها في السوق",
  gigTitleLabel: "عنوان الخدمة",
  gigTitlePlaceholder: "مثال: هصمّم لك لوجو احترافي + ملفات المصدر",
  gigCategoryLabel: "القسم",
  gigDescLabel: "وصف الخدمة",
  gigDescPlaceholder: "اشرح هتسلّم إيه بالظبط، عدد التعديلات، وصيغ الملفات…",
  priceLabel: "السعر بـ Pi",
  daysLabel: "مدة التسليم (أيام)",
  netPreview: (v: string) =>
    `بعد عمولة PiGigz ‏(10%) هيوصلك ${v} عن كل طلب مكتمل.`,
  publishBtn: "انشر الخدمة",
  publishing: "بننشر…",
  sellErrTitle: "عنوان الخدمة قصير جدًا.",
  sellErrDesc: "اكتب وصفًا أوضح: هتسلّم إيه بالظبط؟",
  sellErrPrice: "حط سعر صحيح بالـ Pi أكبر من صفر.",
  sellErrDays: "مدة التسليم من يوم لحد 90 يوم.",
  sellErrGeneric: "النشر مكمّلش. راجع البيانات وحاول تاني.",
  statusErrGeneric: "تغيير حالة الخدمة مكمّلش. حاول تاني.",
  myGigsTitle: (u: string) => `خدماتي المنشورة باسم @${u}`,
  myGigsBtn: "خدماتي",
  gigActive: "شغالة",
  gigPausedState: "متوقفة",
  pauseBtn: "إيقاف مؤقت",
  activateBtn: "تفعيل",
  editBtn: "تعديل",
  deleteBtn: "مسح",
  confirmDeleteBtn: "متأكد؟ امسحها",
  saveEditBtn: "احفظ التعديلات",
  savingEdit: "بيتحفظ…",
  cancelEditBtn: "إلغاء التعديل",
  editingNote: "بتعدّل خدمة موجودة — احفظ عشان التعديلات تتطبق.",
  walletAddrErr: "عنوان المحفظة مش صحيح — لازم يبدأ بـ G ويكون 56 حرف.",
  editErrGeneric: "التعديل مكمّلش. حاول تاني.",
  deleteErrGeneric: "المسح مكمّلش. حاول تاني.",
  actionPublish: "نشر خدمة",
  actionOrder: "طلب الخدمة",
  actionOrders: "إدارة طلباتك",
  ordersTitle: "الطلبات",
  ordersSubtitle:
    "كل طلب بيعدّي بثلاث خطوات: الدفع يتحجز في الضمان، الفريلانسر يسلّم، العميل يعتمد فتتحرّر الفلوس بعد خصم عمولة 10%. التسليم بيتم من حساب الفريلانسر، والاعتماد والإلغاء والتقييم من حساب العميل.",
  ordersGuestNote:
    "من غير دخول هتشوف الطلبات للاطلاع بس، من غير أزرار تسليم أو اعتماد.",
  filterAll: "كل الطلبات",
  filterBuying: (u: string) => `طلباتي كعميل · @${u}`,
  filterSelling: (u: string) => `طلباتي كفريلانسر · @${u}`,
  loadingOrders: "بنحمّل الطلبات…",
  emptyOrdersTitle: "لسه مفيش طلبات",
  emptyOrdersFiltered: "مفيش طلبات في الفلتر ده",
  emptyOrdersBody:
    "أول ما حد يطلب خدمة ويدفع بـ Pi، الطلب هيظهر هنا بحالة الضمان بتاعته.",
  emptyBuyingBody: "لسه مشتريتش حاجة بحسابك. اطلب خدمة من السوق وهتظهر هنا.",
  emptySellingBody: "لسه مجالكش طلبات على خدماتك. انشر خدمة واستنى أول عميل.",
  status: {
    awaiting_delivery: "مدفوع · في الضمان، مستني التسليم",
    delivered: "اتسلّم · مستني اعتماد العميل",
    completed: "اكتمل · الدفع اتحرّر للفريلانسر",
    cancelled: "اتلغى · المبلغ رجع للعميل",
  } as Record<Order["status"], string>,
  clientLabel: "العميل",
  freelancerLabel: "الفريلانسر",
  legacyOrder: "طلب قديم من قبل تفعيل دخول Pi",
  roleBoth: "الطلب ده طرفيه حسابات قديمة جزئيًا — إجراءاتك متاحة حسب دورك.",
  roleBuyer: "إنت العميل في الطلب ده.",
  roleSeller: "إنت الفريلانسر في الطلب ده.",
  roleOutsider: "الطلب ده بين مستخدمين تانيين — للاطلاع بس.",
  briefShownLabel: "طلب العميل:",
  paidInEscrow: "المدفوع (في الضمان)",
  netFreelancer: "صافي الفريلانسر",
  paymentRefLabel: "رقم عملية الدفع:",
  deliveryNoteShown: "ملحوظة التسليم:",
  fromJobRequest: "من طلب شغل",
  deliverNoteLabel: "ملحوظة التسليم (رابط الشغل أو وصف مكان التسليم)",
  deliverNotePlaceholder: "مثال: سلّمت الملفات على درايف، ودي نسخة معاينة…",
  confirmDelivery: "تأكيد التسليم",
  back: "رجوع",
  loginToAct: "سجّل دخولك بـ Pi عشان الفريلانسر يسلّم أو العميل يلغي الطلب.",
  waitingSeller: "مستني الفريلانسر يسلّم الشغل — الإجراءات هنا متاحة لأطراف الطلب بس.",
  deliverBtn: "تم التسليم · أنا الفريلانسر",
  cancelBtn: "إلغاء الطلب واسترداد المبلغ · أنا العميل",
  approveBtn: (v: string) => `أنا العميل · استلمت، حرّر ${v} للفريلانسر`,
  deliveredWaiting: "الشغل اتسلّم ومستني اعتماد العميل صاحب الطلب.",
  deliveredWaitingGuest: "الشغل اتسلّم — اعتماد العميل بيتم بعد دخوله بـ Pi.",
  reviewedDone: "✓ تم تقييم الطلب ده.",
  payoutLabel: "دفعة الفريلانسر من التطبيق:",
  payoutStatus: {
    pending: "معلّقة · لسه هتتبعت",
    submitted: "اتبعتت · بتتأكد على الشبكة",
    completed: "اكتملت · وصلت محفظة الفريلانسر",
    failed: "فشلت · محتاجة إعادة محاولة",
    simulated: "اتحرّرت (وضع المحاكاة)",
  } as Record<string, string>,
  retryPayoutBtn: "إعادة محاولة دفع الفريلانسر",
  payoutPendingWallet: "أرباح مكتملة لسه في طريقها لمحفظتك",
  incompleteResolved: (r: string): string =>
    r === "completed"
      ? "الدفعة المعلّقة القديمة اكتملت واتسجّلت بنجاح."
      : r === "cancelled"
        ? "الدفعة المعلّقة القديمة اتلغت من السيرفر."
        : "الدفعة المعلّقة القديمة كانت محسومة قبل كده.",
  reviewByBuyerOnly: "الطلب اكتمل — التقييم بيتم من حساب العميل صاحب الطلب.",
  reviewTitle: "قيّم تجربتك مع الفريلانسر",
  starsLabel: "التقييم بالنجوم",
  starLabel: (n: number) => `${n} من 5 نجوم`,
  reviewCommentLabel: "تعليقك على الشغل",
  reviewPlaceholder: "الشغل كان عامل إزاي؟ الالتزام بالميعاد؟",
  reviewCommentError: "اكتب تعليقك على الشغل.",
  publishReview: "انشر التقييم",
  actionErrGeneric: "الإجراء مكمّلش. حاول تاني.",
  starsAria: (v: number) => `${v} من 5`,
  /* Chat */
  chatTitle: "شات الطلب",
  chatToggle: (n: number) => (n > 0 ? `شات الطلب (${n})` : "شات الطلب"),
  chatEmpty: "لسه مفيش رسائل. ابدأ المحادثة مع الطرف التاني عشان تتفقوا على التفاصيل.",
  chatLoading: "بنحمّل الرسائل…",
  chatPlaceholder: "اكتب رسالتك…",
  chatSend: "ابعت",
  chatPartyOnly: "الشات متاح للعميل والفريلانسر أصحاب الطلب بس.",
  /* Profile */
  profileBack: "→ رجوع",
  profileNotFound: "البروفايل ده مش موجود.",
  verifiedBadge: "فريلانسر موثّق",
  verifiedBadgeHint: (n: number) => `أتمّ ${n} طلبات مكتملة على PiGigz`,
  piVerifiedBadge: "حساب Pi متأكد",
  joinedOn: (d: string) => `انضم ${d}`,
  completedOrders: "طلب مكتمل",
  totalOrders: "إجمالي الطلبات",
  profileGigsTitle: "خدمات الفريلانسر",
  profileNoGigs: "لسه منشرش خدمات.",
  portfolioTitle: "معرض الأعمال",
  portfolioEmpty: "لسه مفيش أعمال في المعرض.",
  visitWork: "شوف العمل",
  profileReviewsTitle: "تقييمات العملاء",
  bioTitle: "نبذة",
  noBio: "لسه مكتبش نبذة.",
  bioLabel: "نبذتك التعريفية",
  bioPlaceholder: "اكتب نبذة مختصرة عن خبرتك وشغلك…",
  saveBio: "احفظ النبذة",
  bioSaved: "اتحفظت النبذة.",
  addWorkTitle: "ضيف عمل للمعرض",
  workTitleLabel: "عنوان العمل",
  workDescLabel: "وصف مختصر",
  workLinkLabel: "رابط العمل (اختياري)",
  workCategoryLabel: "القسم (اختياري)",
  workCategoryNone: "من غير قسم",
  addWorkBtn: "ضيف للمعرض",
  deleteWork: "حذف",
  viewProfile: "البروفايل",
  /* Job requests & offers */
  jobsTitle: "طلبات الشغل والعروض",
  jobsSubtitle:
    "انشر طلب شغل بميزانية بالـ Pi، والفريلانسرز يقدّموا عروض سعر ومدة. لما تختار عرض، بيتحوّل لطلب مدفوع محجوز في الضمان بنفس عمولة 10%.",
  postJobTitle: "انشر طلب شغل",
  jobTitleLabel: "عنوان طلب الشغل",
  jobTitlePlaceholder: "مثال: محتاج مونتاج لفيديو يوتيوب 10 دقايق",
  jobDescLabel: "تفاصيل الشغل المطلوب",
  jobDescPlaceholder: "اشرح المطلوب بالتفصيل، والملفات اللي هتسلّمها للفريلانسر…",
  budgetLabel: "الميزانية بـ Pi",
  durationLabel: "المدة المطلوبة (أيام)",
  postJobBtn: "انشر طلب الشغل",
  postingJob: "بننشر…",
  jobPosted: "طلب الشغل اتنشر. الفريلانسرز يقدروا يقدّموا عروضهم دلوقتي.",
  actionPostJob: "نشر طلب شغل",
  jobStatus: {
    open: "مفتوح للعروض",
    awarded: "اتحسم · بقى طلب مدفوع",
    cancelled: "ملغي",
  } as Record<JobRequest["status"], string>,
  budgetLine: (v: string) => `الميزانية ${v}`,
  durationLine: (d: number) => `المدة ${d} ${d === 1 ? "يوم" : "أيام"}`,
  offersCount: (n: number) => `${n} عرض`,
  viewOffers: "شوف العروض",
  hideOffers: "اخفي العروض",
  noOffersYet: "لسه مفيش عروض على الطلب ده.",
  offerPrice: (v: string) => `السعر ${v}`,
  offerDays: (d: number) => `التسليم في ${d} ${d === 1 ? "يوم" : "أيام"}`,
  offerStatus: {
    pending: "لسه تحت المراجعة",
    accepted: "اتقبل · بقى طلب مدفوع",
    rejected: "متقبلش",
  } as Record<string, string>,
  acceptOfferBtn: "اقبل العرض وادفع بـ Pi",
  yourRequestNote: "ده طلب الشغل بتاعك — اختار العرض المناسب من العروض اللي وصلتك.",
  cancelJobBtn: "إلغاء طلب الشغل",
  offerFormTitle: "قدّم عرضك",
  offerPriceLabel: "سعرك بـ Pi",
  offerDaysLabel: "هتسلّم في كام يوم؟",
  offerMsgLabel: "رسالتك للعميل",
  offerMsgPlaceholder: "اشرح هتنفّذ الشغل إزاي وليه إنت المناسب…",
  sendOfferBtn: "ابعت العرض",
  offerSent: "عرضك اتبعت للعميل.",
  loginToOffer: "سجّل دخولك بـ Pi عشان تقدّم عرض.",
  loadingJobs: "بنحمّل طلبات الشغل…",
  emptyJobsTitle: "لسه مفيش طلبات شغل",
  emptyJobsBody: "انشر أول طلب شغل وخلي الفريلانسرز يتنافسوا بعروضهم.",
  acceptPayTitle: "قبول العرض والدفع بـ Pi",
  acceptPaySuccess: "العرض اتقبل والدفعة اتحجزت في الضمان",
  goToOrder: "روح للطلب",
  /* Wallet */
  walletTitle: "المحفظة والأرباح",
  walletSubtitle: "كل أرقامك بالـ Pi: أرباحك كفريلانسر، ومصاريفك كعميل، واللي لسه محجوز في الضمان.",
  actionWallet: "عرض محفظتك",
  loadingWallet: "بنحمّل محفظتك…",
  asFreelancer: "كفريلانسر",
  earnedReleased: "أرباح اتحرّرت ووصلتك (صافي)",
  commissionDeducted: "عمولة PiGigz اللي اتخصمت (10%)",
  pendingEscrowNet: "معلّق في الضمان · هيوصلك (صافي)",
  pendingEscrowGross: (v: string) => `إجمالي المعلّق قبل العمولة: ${v}`,
  completedCountLabel: "طلبات مكتملة",
  pendingCountLabel: "طلبات شغالة دلوقتي",
  asClient: "كعميل",
  spentTotal: "إجمالي اللي دفعته على طلبات مكتملة",
  inEscrowNow: "محجوز في الضمان دلوقتي",
  boughtCompletedLabel: "طلبات اشتريتها واكتملت",
  boughtPendingLabel: "طلبات مستنية التسليم/الاعتماد",
  walletNote:
    "أول ما العميل يعتمد التسليم، التطبيق بيدفع للفريلانسر صافي المبلغ بعد عمولة 10% بدفعة Pi حقيقية (app_to_user) من السيرفر، وحالتها (معلّقة/مُرسلة/مكتملة/فاشلة) بتظهر على كل طلب. في وضع المحاكاة التحرير بيكون لحظيًا.",
  payoutWalletTitle: "عنوان محفظتك للاستلام",
  payoutWalletHint:
    "دفعات الفريلانسر بتتبعت على العنوان ده. انسخه من محفظة Pi بتاعتك (wallet.pi) والصقه هنا — لازم يبدأ بـ G ويكون 56 حرف.",
  payoutWalletPlaceholder: "G… (56 حرف)",
  payoutWalletSave: "احفظ العنوان",
  payoutWalletSaved: "اتحفظ عنوان محفظتك ✓",
  payoutWalletMissing: "مش متسجل عنوان محفظة — الدفعات مش هتوصلك من غيره.",
  deliverNeedsWallet:
    "احفظ عنوان محفظتك من تبويب المحفظة الأول عشان تقدر تسلّم — من غيره الدفعة مش هتوصلك.",
  /* Explore map */
  mapTitle: "استكشف العالم",
  mapSubtitle:
    "لفّ الكرة الأرضية بإيدك وكبّر وصغّر، ودوس على أي نقطة مرقّمة عشان تشوف الجيج والفريلانسر وسعره بالـ Pi — وتقدر تبدّل للخريطة العادية في أي وقت. النقاط دي خدمات ناس اختاروا يحدّدوا مدينتهم في بروفايلهم بنفسهم.",
  mapAllCats: "كل الأقسام",
  mapEmptyTitle: "لسه مفيش خدمات على الخريطة",
  mapEmptyBody:
    "أول ما فريلانسر يحدّد مدينته من بروفايله وينشر خدمة شغالة، الخدمة هتظهر هنا على الخريطة.",
  mapFilteredEmpty: "مفيش خدمات في القسم ده على الخريطة حاليًا.",
  mapUnavailable:
    "الخريطة التفاعلية مش متاحة في المتصفح ده — دي نفس الخدمات في قائمة تحت.",
  mapLoading: "بنحمّل أماكن الخدمات…",
  mapViewLabel: "طريقة العرض",
  mapViewGlobe: "الكرة الأرضية 3D",
  mapViewFlat: "الخريطة العادية",
  globeHint:
    "اسحب بإيدك أو بالماوس عشان تلفّ الكرة، وكبّر وصغّر بعجلة الماوس أو بالقرص بإصبعين. الكرة بتلفّ ببطء لوحدها، ودوس على أي نقطة مرقّمة عشان تشوف الجيج في القائمة تحت.",
  globeAria: "كرة أرضية ثلاثية الأبعاد تفاعلية عليها نقاط الخدمات",
  globeUnavailable:
    "الكرة الأرضية ثلاثية الأبعاد مش متاحة في المتصفح ده — دي نفس الخدمات في قائمة تحت، أو جرّب الخريطة العادية.",
  cityLabel: "مدينتك (بتظهر على خريطة الاستكشاف)",
  cityNone: "مش محددة",
  cityInProfile: (city: string) => `📍 ${city}`,
  saveProfile: "احفظ البروفايل",
  profileSaved: "اتحفظت بيانات البروفايل.",
  /* Demo preview mode */
  demoTry: "جرّب النسخة التجريبية",
  demoExit: "الخروج من التجريبي",
  demoBannerTitle: "وضع تجريبي · بيانات للعرض فقط",
  demoBannerText:
    "كل الخدمات والفريلانسرز والطلبات والأرقام اللي هنا وهمية للمعاينة بس — مفيش حاجة بتتحفظ في السوق الحقيقي ولا بتأثر عليه. اخرج في أي وقت وارجع للسوق زي ما هو بالظبط.",
  demoNote: "بيانات تجريبية للعرض",
  demoSellNote:
    "النشر معطّل في الوضع التجريبي. دي معاينة للعرض بس، فمش هتقدر تنشر أو تطلب بجد من هنا — اخرج من التجريبي وارجع للسوق الحقيقي عشان تنشر خدمتك وتطلب بجد.",
  demoExitToReal: "الخروج من التجريبي والرجوع للسوق الحقيقي",
  demoOrderNote: "ده طلب تجريبي للعرض — مش هيتحفظ ولا هيأثر على طلباتك الحقيقية.",
  demoPostJobNote: "طلب الشغل ده تجريبي للعرض — مش هيتنشر في السوق الحقيقي.",
};

type Dict = typeof ar;

const en: Dict = {
  cat: {
    design: "Design",
    code: "Programming",
    video: "Video editing",
    translation: "Translation",
    writing: "Writing",
    marketing: "Marketing",
  },
  nav: { market: "Market", sell: "Post a gig", jobs: "Job requests", orders: "Orders", wallet: "Wallet", map: "Explore" },
  langToggle: "العربية",
  testnetBadge: "Testnet · Sandbox mode",
  heroTitleA: "Your work, paid in ",
  heroSubtitle:
    "A services marketplace for Pioneers in Egypt and the Arab world: order design, programming, video editing, translation… and pay with Pi. Your money stays in PiGigz escrow until you receive the work and approve it.",
  statGigs: (n) => `${n} gigs published`,
  statCompleted: (n) => `${n} orders completed`,
  statVolume: (v) => `Volume ${v}`,
  login: "Log in with Pi",
  loggingIn: "Opening Pi login…",
  logout: "Log out",
  verifyingSession: "Signed in with Pi · confirming session…",
  accountVerified: "Pi account verified on the server ✓",
  accountUnverified: "Signed in with Pi · server verification pending",
  accountCounts: (g, b, s) => `My gigs ${g} · Bought ${b} · Sold ${s}`,
  loginHintPi: "Log in with Pi to publish gigs and order under your name.",
  loginHintWeb:
    "Real login completes inside Pi's own environment for this app (the Sandbox while it's on Testnet) — browsing works in any browser.",
  loginHintSandbox: "You're in the Pi Sandbox (Testnet testing) — Pi login works from here.",
  incompletePayment: (id) =>
    `You have an old incomplete payment on your account (ID ${id}) — it will be completed or cancelled manually.`,
  loginErrorSdk: "The Pi SDK isn't available here. Open PiGigz inside Pi's environment (the Sandbox, for testing) and log in.",
  loginErrorGeneric:
    "Login didn't complete. Make sure you're in Pi's environment for this app (the Sandbox while it's on Testnet), signed in to Pi, and approve the login request.",
  pinetNote:
    "Note: you opened the app through the PiNet link (app5122.pinet.com), a limited preview environment from Pi — Pi sign-in and payments don't complete from it. PiGigz is still a Testnet app, so its sign-in completes in Pi's official Pi Sandbox test environment: open the app's Sandbox link in your browser and sign in there.",
  loginErrorPinet:
    "Pi itself rejected the sign-in (“Authentication failed”): the PiNet link can't complete login, and PiGigz is a Testnet app, so its sign-in completes in Pi's official Pi Sandbox test environment — open the app's Sandbox link and sign in there.",
  sandboxNote:
    "You're in the Pi Sandbox, Pi's official environment for testing Testnet apps like PiGigz — Pi sign-in completes here. Approve the consent request and you'll be signed in with your Pi account (Testnet).",
  loginErrorTestnet:
    "Pi itself rejected the sign-in (“Authentication failed”). The reason: PiGigz is still a Testnet app, and Pi Browser's live (Mainnet) shell doesn't complete sign-in for Testnet apps — Pi's internal validation fails right after you approve the scopes. Test sign-in completes in Pi's official Pi Sandbox environment: open the app's Sandbox link and sign in there.",
  openSandbox: "Open the Pi Sandbox",
  logoAltHeader: "The official PiGigz logo: a freelancer at a laptop with gig cards falling onto it",
  logoAltHero:
    "The official PiGigz logo: a freelancer at a golden laptop surrounded by service cards — design, translation, video editing and marketing — in dark plum and gold",
  gateTitle: "Log in with Pi first",
  gateBody: (action) =>
    `${action} uses your Pi account, and your Pi username is what appears on your work and orders — no separate sign-up or new password.`,
  gatePreparing: "Preparing the Pi SDK…",
  gateStepsTitle: "Login only works inside Pi's environment:",
  gateSteps: [
    "PiGigz is still a Testnet app, and test sign-in completes in Pi's official Pi Sandbox environment.",
    "Open the app's Sandbox link in your browser, and authorize the Sandbox from the Pi app (Pi Utilities → Authorize Sandbox) if it asks.",
    "Inside the Sandbox, tap “Log in with Pi” and approve the username, payments and wallet address scopes.",
  ],
  gateWebNote:
    "A regular browser has no Pi account, so real login can't complete there — but browsing and search work fine. Opening the app directly in Pi Browser doesn't complete sign-in for Testnet apps either; the official test environment is the Sandbox.",
  gateIncomplete: (id) =>
    `You have an old incomplete payment on your account (ID ${id}) — the PiGigz team will complete or cancel it manually.`,
  searchLabel: "Search for a service",
  searchPlaceholder: "Search for a service or freelancer…",
  publishCta: "+ Post your gig",
  categoryFilterNote: (label) => `Showing the ${label} category only — `,
  showAll: "Show all",
  loadingGigs: "Loading gigs…",
  loadError: "Something went wrong while loading. Refresh the page and try again.",
  emptyGigsTitle: "No gigs here yet",
  emptyGigsSearch: "No results match your search. Try another word or view all categories.",
  emptyGigsFresh: "The market is just starting. Be the first freelancer to publish a gig and get paid in Pi.",
  publishFirst: "Publish the first gig",
  pausedBadge: "Paused",
  piAccountBadge: "Pi account",
  ordersCount: (n) => `${n} orders`,
  deliveryIn: (d) => `Delivery in ${d} ${d === 1 ? "day" : "days"}`,
  orderNow: "Order now",
  catImgAlt: (label) => `Illustration for the ${label} category`,
  backToMarket: "← Back to market",
  gigNotFound: "This gig doesn't exist.",
  offeredBy: "Offered by",
  ratingsFrom: (avg, n) => `${avg} from ${n} reviews`,
  totalPrice: "Total price",
  commissionLine: "PiGigz commission (10%)",
  sellerNetLine: "What the freelancer receives after your approval",
  escrowExplain:
    "Payment is held in PiGigz escrow first, and only moves to the freelancer once they deliver and you approve it from the Orders page.",
  gigPausedNote: "This gig is paused and not available to order right now.",
  ownGigNote: (u) =>
    `This is your own gig, @${u} — you can't order it from yourself. Other Pioneers can order it with their accounts.`,
  orderAsNote: (u) =>
    `You'll order as your Pi account: @${u} — the order is tied to your account so only you can approve delivery or cancel.`,
  briefLabel: "Explain your request to the freelancer",
  briefPlaceholder: "Example: I need a logo for a coffee shop, brown and gold, delivered as PNG plus the source file…",
  briefError: "Explain your request in at least one clear sentence.",
  payBtn: (price) => `Pay ${price} with Pi`,
  paySimNote:
    "Pi login is real and tied to your name, but the payment step is still a Testnet simulation — real payments switch on automatically once the developer configures the server API key from the Pi Developer Portal.",
  payRealNote:
    "This is a real Testnet payment through Pi: you sign it from your wallet, the server approves and completes it on the network, and the amount is held in PiGigz escrow.",
  payCancelled: "The payment was cancelled in the Pi wallet — nothing was charged.",
  payErrorGeneric: "The payment didn't complete. Try again.",
  reviewsTitle: "Client reviews",
  loadingReviews: "Loading reviews…",
  noReviews: "No reviews on this gig yet.",
  payDialogTitle: "Pay with Pi",
  paySteps: [
    "Verifying your Pi account…",
    "Sign the payment from your wallet…",
    "The server approves the payment…",
    "Completing the payment on the network…",
  ],
  paySuccess: "Payment done and held in escrow",
  payRef: "Transaction ID",
  payPaid: "Paid",
  payNetLine: "Goes to the freelancer after your approval",
  viewMyOrders: "View my orders",
  needLogin: "You need to log in with Pi first.",
  sellTitle: "Publish your gig and get paid in Pi",
  sellSubtitle:
    "The client pays first and the money is held in PiGigz escrow; once you deliver and the client approves, you receive the net amount after the 10% commission.",
  sellAsNote: (u) =>
    `You're publishing as your Pi account: @${u} — the gig is tied to your account, only you can pause or activate it, and orders on it arrive on the same account.`,
  sellDone: "Your gig is live in the market.",
  sellDoneLink: "See it in the market",
  gigTitleLabel: "Gig title",
  gigTitlePlaceholder: "Example: I'll design a professional logo + source files",
  gigCategoryLabel: "Category",
  gigDescLabel: "Gig description",
  gigDescPlaceholder: "Explain exactly what you'll deliver, number of revisions, file formats…",
  priceLabel: "Price in Pi",
  daysLabel: "Delivery time (days)",
  netPreview: (v) => `After the PiGigz commission (10%) you'll receive ${v} for each completed order.`,
  publishBtn: "Publish the gig",
  publishing: "Publishing…",
  sellErrTitle: "The gig title is too short.",
  sellErrDesc: "Write a clearer description: what exactly will you deliver?",
  sellErrPrice: "Enter a valid Pi price greater than zero.",
  sellErrDays: "Delivery time must be between 1 and 90 days.",
  sellErrGeneric: "Publishing didn't complete. Check the details and try again.",
  statusErrGeneric: "Changing the gig status didn't complete. Try again.",
  myGigsTitle: (u) => `My gigs published as @${u}`,
  myGigsBtn: "My gigs",
  gigActive: "Active",
  gigPausedState: "Paused",
  pauseBtn: "Pause",
  activateBtn: "Activate",
  editBtn: "Edit",
  deleteBtn: "Delete",
  confirmDeleteBtn: "Sure? Delete it",
  saveEditBtn: "Save changes",
  savingEdit: "Saving…",
  cancelEditBtn: "Cancel editing",
  editingNote: "Editing an existing gig — save to apply your changes.",
  walletAddrErr: "Wallet address is invalid — it must start with G and be 56 characters.",
  editErrGeneric: "The edit didn't complete. Try again.",
  deleteErrGeneric: "The delete didn't complete. Try again.",
  actionPublish: "Publishing a gig",
  actionOrder: "Ordering this gig",
  actionOrders: "Managing your orders",
  ordersTitle: "Orders",
  ordersSubtitle:
    "Every order goes through three steps: payment is held in escrow, the freelancer delivers, and the client approves so the money is released after the 10% commission. Delivery happens from the freelancer's account; approval, cancellation and reviews from the client's.",
  ordersGuestNote: "Without login you'll see orders read-only, with no deliver or approve buttons.",
  filterAll: "All orders",
  filterBuying: (u) => `My orders as a client · @${u}`,
  filterSelling: (u) => `My orders as a freelancer · @${u}`,
  loadingOrders: "Loading orders…",
  emptyOrdersTitle: "No orders yet",
  emptyOrdersFiltered: "No orders in this filter",
  emptyOrdersBody: "As soon as someone orders a gig and pays with Pi, the order will appear here with its escrow status.",
  emptyBuyingBody: "You haven't bought anything with your account yet. Order a gig from the market and it will show up here.",
  emptySellingBody: "No orders on your gigs yet. Publish a gig and wait for your first client.",
  status: {
    awaiting_delivery: "Paid · in escrow, awaiting delivery",
    delivered: "Delivered · awaiting client approval",
    completed: "Completed · payment released to the freelancer",
    cancelled: "Cancelled · amount refunded to the client",
  },
  clientLabel: "Client",
  freelancerLabel: "Freelancer",
  legacyOrder: "Legacy order from before Pi login",
  roleBoth: "This order's parties are partly legacy accounts — your actions are available per your role.",
  roleBuyer: "You are the client on this order.",
  roleSeller: "You are the freelancer on this order.",
  roleOutsider: "This order is between other users — read-only.",
  briefShownLabel: "Client's request:",
  paidInEscrow: "Paid (in escrow)",
  netFreelancer: "Freelancer net",
  paymentRefLabel: "Payment transaction ID:",
  deliveryNoteShown: "Delivery note:",
  fromJobRequest: "From a job request",
  deliverNoteLabel: "Delivery note (link to the work or where it was delivered)",
  deliverNotePlaceholder: "Example: Delivered the files on Drive, here's a preview copy…",
  confirmDelivery: "Confirm delivery",
  back: "Back",
  loginToAct: "Log in with Pi so the freelancer can deliver or the client can cancel.",
  waitingSeller: "Waiting for the freelancer to deliver — actions here are for the order's parties only.",
  deliverBtn: "Mark as delivered · I'm the freelancer",
  cancelBtn: "Cancel order & refund · I'm the client",
  approveBtn: (v) => `I'm the client · Received it, release ${v} to the freelancer`,
  deliveredWaiting: "The work was delivered and is awaiting approval by the client who placed the order.",
  deliveredWaitingGuest: "The work was delivered — the client approves after logging in with Pi.",
  reviewedDone: "✓ This order has been reviewed.",
  payoutLabel: "Freelancer payout from the app:",
  payoutStatus: {
    pending: "Pending · not sent yet",
    submitted: "Submitted · confirming on the network",
    completed: "Completed · reached the freelancer's wallet",
    failed: "Failed · needs a retry",
    simulated: "Released (simulation mode)",
  },
  retryPayoutBtn: "Retry freelancer payout",
  payoutPendingWallet: "Completed earnings still on their way to your wallet",
  incompleteResolved: (r: string): string =>
    r === "completed"
      ? "Your old incomplete payment was completed and recorded."
      : r === "cancelled"
        ? "Your old incomplete payment was cancelled on the server."
        : "Your old incomplete payment was already settled.",
  reviewByBuyerOnly: "Order completed — the review is done from the account of the client who placed it.",
  reviewTitle: "Rate your experience with the freelancer",
  starsLabel: "Star rating",
  starLabel: (n) => `${n} of 5 stars`,
  reviewCommentLabel: "Your comment on the work",
  reviewPlaceholder: "How was the work? Did they meet the deadline?",
  reviewCommentError: "Write your comment on the work.",
  publishReview: "Publish review",
  actionErrGeneric: "The action didn't complete. Try again.",
  starsAria: (v) => `${v} of 5`,
  chatTitle: "Order chat",
  chatToggle: (n) => (n > 0 ? `Order chat (${n})` : "Order chat"),
  chatEmpty: "No messages yet. Start the conversation with the other party to agree on the details.",
  chatLoading: "Loading messages…",
  chatPlaceholder: "Write your message…",
  chatSend: "Send",
  chatPartyOnly: "Chat is available to the order's client and freelancer only.",
  profileBack: "← Back",
  profileNotFound: "This profile doesn't exist.",
  verifiedBadge: "Verified freelancer",
  verifiedBadgeHint: (n) => `Completed ${n} orders on PiGigz`,
  piVerifiedBadge: "Verified Pi account",
  joinedOn: (d) => `Joined ${d}`,
  completedOrders: "completed orders",
  totalOrders: "Total orders",
  profileGigsTitle: "Freelancer's gigs",
  profileNoGigs: "No gigs published yet.",
  portfolioTitle: "Portfolio",
  portfolioEmpty: "No work samples in the portfolio yet.",
  visitWork: "View work",
  profileReviewsTitle: "Client reviews",
  bioTitle: "About",
  noBio: "No bio written yet.",
  bioLabel: "Your bio",
  bioPlaceholder: "Write a short bio about your experience and work…",
  saveBio: "Save bio",
  bioSaved: "Bio saved.",
  addWorkTitle: "Add work to the portfolio",
  workTitleLabel: "Work title",
  workDescLabel: "Short description",
  workLinkLabel: "Work link (optional)",
  workCategoryLabel: "Category (optional)",
  workCategoryNone: "No category",
  addWorkBtn: "Add to portfolio",
  deleteWork: "Delete",
  viewProfile: "Profile",
  jobsTitle: "Job requests & offers",
  jobsSubtitle:
    "Post a job request with a Pi budget, and freelancers submit priced offers with a delivery time. When you pick an offer, it becomes a paid order held in escrow with the same 10% commission.",
  postJobTitle: "Post a job request",
  jobTitleLabel: "Job request title",
  jobTitlePlaceholder: "Example: Need editing for a 10-minute YouTube video",
  jobDescLabel: "Details of the work needed",
  jobDescPlaceholder: "Explain what's needed in detail, and the files you'll hand to the freelancer…",
  budgetLabel: "Budget in Pi",
  durationLabel: "Required duration (days)",
  postJobBtn: "Post the job request",
  postingJob: "Posting…",
  jobPosted: "Your job request is live. Freelancers can submit offers now.",
  actionPostJob: "Posting a job request",
  jobStatus: { open: "Open for offers", awarded: "Awarded · became a paid order", cancelled: "Cancelled" },
  budgetLine: (v) => `Budget ${v}`,
  durationLine: (d) => `Duration ${d} ${d === 1 ? "day" : "days"}`,
  offersCount: (n) => `${n} offers`,
  viewOffers: "View offers",
  hideOffers: "Hide offers",
  noOffersYet: "No offers on this request yet.",
  offerPrice: (v) => `Price ${v}`,
  offerDays: (d) => `Delivery in ${d} ${d === 1 ? "day" : "days"}`,
  offerStatus: { pending: "Under review", accepted: "Accepted · became a paid order", rejected: "Not accepted" },
  acceptOfferBtn: "Accept offer & pay with Pi",
  yourRequestNote: "This is your job request — pick the right offer from the ones you received.",
  cancelJobBtn: "Cancel job request",
  offerFormTitle: "Submit your offer",
  offerPriceLabel: "Your price in Pi",
  offerDaysLabel: "Delivery in how many days?",
  offerMsgLabel: "Your message to the client",
  offerMsgPlaceholder: "Explain how you'll do the work and why you're the right fit…",
  sendOfferBtn: "Send offer",
  offerSent: "Your offer was sent to the client.",
  loginToOffer: "Log in with Pi to submit an offer.",
  loadingJobs: "Loading job requests…",
  emptyJobsTitle: "No job requests yet",
  emptyJobsBody: "Post the first job request and let freelancers compete with their offers.",
  acceptPayTitle: "Accept offer & pay with Pi",
  acceptPaySuccess: "Offer accepted and the payment is held in escrow",
  goToOrder: "Go to the order",
  walletTitle: "Wallet & earnings",
  walletSubtitle: "All your numbers in Pi: your earnings as a freelancer, your spending as a client, and what's still held in escrow.",
  actionWallet: "Viewing your wallet",
  loadingWallet: "Loading your wallet…",
  asFreelancer: "As a freelancer",
  earnedReleased: "Earnings released to you (net)",
  commissionDeducted: "PiGigz commission deducted (10%)",
  pendingEscrowNet: "Pending in escrow · coming to you (net)",
  pendingEscrowGross: (v) => `Total pending before commission: ${v}`,
  completedCountLabel: "Completed orders",
  pendingCountLabel: "Orders in progress",
  asClient: "As a client",
  spentTotal: "Total you paid on completed orders",
  inEscrowNow: "Currently held in escrow",
  boughtCompletedLabel: "Orders you bought & completed",
  boughtPendingLabel: "Orders awaiting delivery/approval",
  walletNote:
    "As soon as the client approves delivery, the app pays the freelancer the net amount after the 10% commission with a real server-side Pi payment (app_to_user), and its status (pending / submitted / completed / failed) shows on each order. In simulation mode the release is instant.",
  payoutWalletTitle: "Your payout wallet address",
  payoutWalletHint:
    "Freelancer payouts are sent to this address. Copy it from your Pi Wallet (wallet.pi) and paste it here — it must start with G and be 56 characters.",
  payoutWalletPlaceholder: "G… (56 characters)",
  payoutWalletSave: "Save address",
  payoutWalletSaved: "Your wallet address was saved ✓",
  payoutWalletMissing: "No wallet address saved — payouts can't reach you without it.",
  deliverNeedsWallet:
    "Save your wallet address in the Wallet tab first so you can deliver — without it the payout can't reach you.",
  mapTitle: "Explore the world",
  mapSubtitle:
    "Spin the 3D globe with your hand, zoom in and out, and tap any numbered pin to see the gig, the freelancer and its Pi price — or switch to the flat map anytime. Pins are gigs from freelancers who picked their own city on their profile.",
  mapAllCats: "All categories",
  mapEmptyTitle: "No gigs on the map yet",
  mapEmptyBody:
    "As soon as a freelancer sets their city on their profile and publishes an active gig, it will appear here on the map.",
  mapFilteredEmpty: "No gigs in this category on the map right now.",
  mapUnavailable:
    "The interactive map isn't available in this browser — here are the same gigs in a list below.",
  mapLoading: "Loading gig locations…",
  mapViewLabel: "View",
  mapViewGlobe: "3D Globe",
  mapViewFlat: "Flat map",
  globeHint:
    "Drag with your finger or mouse to spin the globe, and zoom with the scroll wheel or a two-finger pinch. It rotates slowly on its own — tap any numbered pin to see the gig in the list below.",
  globeAria: "Interactive 3D globe with gig pins",
  globeUnavailable:
    "The 3D globe isn't available in this browser — the same gigs are in the list below, or try the flat map.",
  cityLabel: "Your city (shown on the explore map)",
  cityNone: "Not set",
  cityInProfile: (city: string) => `📍 ${city}`,
  saveProfile: "Save profile",
  profileSaved: "Profile saved.",
  /* Demo preview mode */
  demoTry: "Try the demo",
  demoExit: "Exit demo",
  demoBannerTitle: "Demo mode · Sample data for preview only",
  demoBannerText:
    "Every gig, freelancer, order and number here is made-up preview data — nothing is saved to the real marketplace or affects it. Exit any time to go back to the real market exactly as it is.",
  demoNote: "Demo sample data",
  demoSellNote:
    "Publishing is disabled in demo mode. This is a preview only, so you can't really publish or order here — exit the demo and go back to the real marketplace to publish your gig and order for real.",
  demoExitToReal: "Exit demo & back to the real market",
  demoOrderNote: "This is a demo order for preview — it won't be saved or affect your real orders.",
  demoPostJobNote: "This job request is demo preview data — it won't be posted to the real marketplace.",
};

const STR: Record<Lang, Dict> = { ar, en };

/* ------------------------------------------------------------------ */

const I18nCtx = createContext<{
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
}>({ lang: "ar", t: ar, setLang: () => {} });

function useI18n() {
  return useContext(I18nCtx);
}

function fmtPi(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} π`;
}

function fmtDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const { t } = useI18n();
  return (
    <span className={`${size} leading-none text-[var(--gold)]`} aria-label={t.starsAria(value)}>
      {"★".repeat(Math.round(value))}
      <span className="text-[var(--border)]">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

const STATUS_CLASS: Record<Order["status"], string> = {
  awaiting_delivery: "bg-[var(--gold-soft)] text-[#8a5d00] dark:text-[var(--gold)]",
  delivered: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Real Pi login (Pi SDK)                                              */
/* ------------------------------------------------------------------ */

type PiAuthResult = {
  accessToken: string;
  user: { uid: string; username: string; walletAddress?: string };
};

type PiPayment = { identifier: string };

type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: PiPayment) => void;
};

type PiSdk = {
  init: (config: { version: string; sandbox: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: PiPayment) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (
    data: { amount: number; memo: string; metadata: Record<string, unknown> },
    callbacks: PiPaymentCallbacks,
  ) => Promise<unknown>;
};

/** Scopes requested at Pi login; wallet_address lets the app pay the user back (app_to_user payouts). */
const PI_SCOPES = ["username", "payments", "wallet_address"];

/**
 * Whether this page is running inside the Pi Sandbox web app
 * (sandbox.minepi.com), which embeds the app in a frame for testing.
 *
 * Pi docs say sandbox mode is only for testing outside Pi Browser
 * ("use sandbox: false in production"). Reading the current pi-sdk.js
 * source shows this SDK version actually auto-detects sandbox mode
 * itself — from an ancestor origin of sandbox.minepi.com or a
 * ?sandbox=true query param — and never reads the init flag; we still
 * pass the detected value so the init call stays truthful in every
 * environment: the Sandbox test link gets sandbox:true, everything
 * else (Pi Browser direct, PiNet) gets sandbox:false.
 */
function detectPiSandbox(): boolean {
  try {
    const ancestors = window.location.ancestorOrigins;
    for (let i = 0; i < ancestors.length; i++) {
      if (ancestors[i]?.includes("sandbox.minepi.com")) return true;
    }
  } catch {
    /* ancestorOrigins unavailable in this webview */
  }
  try {
    if (document.referrer.includes("sandbox.minepi.com")) return true;
  } catch {
    /* referrer unavailable */
  }
  return false;
}

/**
 * Whether this page is framed by PiNet (app5122.pinet.com) — Pi's public
 * web gateway, which embeds the app's registered frontend URL in an
 * iframe. PiNet is a limited preview environment, not the full Pi Browser
 * app shell: the Pi SDK itself refuses payments there
 * (Pi.createPayment throws "Method unsupported in PiNet"), and
 * Pi.authenticate also dies there.
 *
 * The full "Authentication failed." diagnosis (verified 2026-11-24 by
 * reading the current pi-sdk.js source and testing the deployed server):
 * Pi.authenticate runs the consent sheet through the host, then takes
 * {accessToken, backendURL} from the host's communication-info reply and
 * validates the token itself with GET {backendURL}/v2/me; any failure
 * there — before this app's server is ever contacted — rejects with
 * exactly "Authentication failed.". PiGigz is a Testnet (Staging) app,
 * and that validation fails in BOTH non-Testnet hosts: PiNet's preview
 * shell and Pi Browser's live Mainnet shell (the user approved the
 * consent sheet in Pi Browser on the app's own Vercel address and still
 * got "Authentication failed."; the deployed server meanwhile answers a
 * bogus token with its invalid-token error and a real payment config,
 * so the server path is healthy). The one environment where a Testnet
 * app's login completes is Pi's own Sandbox (sandbox.minepi.com), whose
 * host supplies Testnet communication info — which is why the app's
 * Developer Portal development_url (what the Sandbox loads) was pointed
 * at the deployed Vercel URL instead of the original localhost:3000.
 * The UI detects each environment (same signals the SDK uses: ancestor
 * origins / referrer) and routes the user to the Sandbox instead of
 * leaving them with Pi's raw error.
 */
function detectPiNet(): boolean {
  try {
    const ancestors = window.location.ancestorOrigins;
    for (let i = 0; i < ancestors.length; i++) {
      if (ancestors[i]?.includes("pinet.com")) return true;
    }
  } catch {
    /* ancestorOrigins unavailable in this webview */
  }
  try {
    if (document.referrer.includes("pinet.com")) return true;
  } catch {
    /* referrer unavailable */
  }
  return false;
}

declare global {
  interface Window {
    Pi?: PiSdk;
  }
}

type PiSession = {
  piUid: string;
  username: string;
  accessToken: string;
  walletAddress?: string;
};

/** This app's official Pi Sandbox link — the Testnet test environment where Pi login completes for this staging app. */
const PI_SANDBOX_URL = "https://sandbox.minepi.com/mobile-app-ui/app/pigigz-bt8b";

// v2: sessions saved before the wallet_address scope was added are dropped,
// so every user signs in again and grants the new scopes.
const SESSION_KEY = "pigigz:pi-session:v2";
const LANG_KEY = "pigigz:lang:v1";

function loadSession(): PiSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PiSession>;
    if (parsed.piUid && parsed.username && parsed.accessToken) {
      return {
        piUid: parsed.piUid,
        username: parsed.username,
        accessToken: parsed.accessToken,
        walletAddress: parsed.walletAddress,
      };
    }
  } catch {
    /* corrupted storage: treat as signed out */
  }
  return null;
}

function authOf(session: PiSession): PiSession {
  return {
    piUid: session.piUid,
    username: session.username,
    accessToken: session.accessToken,
    walletAddress: session.walletAddress,
  };
}

type RealPaymentResult = {
  orderId: number;
  paymentRef: string;
  amountPi: number;
  commissionPi: number;
  sellerNetPi: number;
};

/**
 * Runs a real user_to_app Pi payment for a prepared server intent:
 * Pi.createPayment → the user signs in their wallet →
 * onReadyForServerApproval calls the server approve action →
 * onReadyForServerCompletion calls the server complete action, which
 * creates the escrow order. Resolves with the created order's summary.
 */
function runRealPiPayment(opts: {
  session: PiSession;
  intentId: number;
  amountPi: number;
  memo: string;
  onStep: (n: number) => void;
  cancelledMessage: string;
  errorMessage: string;
}): Promise<RealPaymentResult> {
  return new Promise((resolve, reject) => {
    const pi = window.Pi;
    if (!pi) {
      reject(new Error(opts.errorMessage));
      return;
    }
    let settled = false;
    // Diagnostic fix (2026-11-25): the Pi SDK calls onError with its own
    // generic "Something went wrong" when the approval sheet times out, which
    // overwrote the server's exact error. Keep the last server-side error
    // (approve/complete) and prefer it over the SDK's generic one.
    let serverError: Error | null = null;
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      const err = serverError ?? (e instanceof Error ? e : new Error(opts.errorMessage));
      reject(err);
    };
    const failServer = (e: unknown) => {
      const msg = e instanceof Error && e.message ? e.message : opts.errorMessage;
      serverError = new Error(
        msg.startsWith("خطأ السيرفر:") || msg === opts.cancelledMessage
          ? msg
          : `خطأ السيرفر: ${msg}`,
      );
      fail(serverError);
    };
    const markFailed = (paymentId: string | null, reason: "cancelled" | "error") => {
      void api
        .failPayment({
          auth: authOf(opts.session),
          intentId: opts.intentId,
          paymentId,
          reason,
        })
        .catch(() => {
          /* best effort — an approved payment is resolved at next login */
        });
    };
    opts.onStep(1);
    try {
      const maybePromise = pi.createPayment(
        {
          amount: opts.amountPi,
          memo: opts.memo,
          metadata: { intentId: opts.intentId },
        },
        {
          onReadyForServerApproval: (paymentId) => {
            opts.onStep(2);
            void api
              .approvePayment({
                auth: authOf(opts.session),
                intentId: opts.intentId,
                paymentId,
              })
              .catch(failServer);
          },
          onReadyForServerCompletion: (paymentId, txid) => {
            opts.onStep(3);
            void api
              .completePayment({
                auth: authOf(opts.session),
                intentId: opts.intentId,
                paymentId,
                txid,
              })
              .then((res) => {
                if (settled) return;
                settled = true;
                resolve(res);
              })
              .catch(failServer);
          },
          onCancel: (paymentId) => {
            markFailed(paymentId ?? null, "cancelled");
            fail(new Error(opts.cancelledMessage));
          },
          onError: (error, payment) => {
            markFailed(payment?.identifier ?? null, "error");
            // Prefer the server's exact error (if approve/complete already
            // failed) over the SDK's generic timeout message.
            fail(serverError ?? error);
          },
        },
      );
      if (maybePromise && typeof maybePromise === "object" && "catch" in maybePromise) {
        void (maybePromise as Promise<unknown>).catch(fail);
      }
    } catch (e) {
      fail(e);
    }
  });
}

type LoginGateProps = {
  sdkReady: boolean;
  inPiBrowser: boolean;
  inPiNet: boolean;
  inSandbox: boolean;
  loginBusy: boolean;
  loginError: string | null;
  loginSandboxHint: boolean;
  incompletePaymentId: string | null;
  onLogin: () => void;
};

function LoginGate({
  actionLabel,
  sdkReady,
  inPiBrowser,
  inPiNet,
  inSandbox,
  loginBusy,
  loginError,
  loginSandboxHint,
  incompletePaymentId,
  onLogin,
}: LoginGateProps & { actionLabel: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-[var(--radius)] border border-[var(--gold)] bg-[var(--gold-soft)] p-5 text-center dark:bg-[var(--surface-alt)]">
      <p className="font-display text-lg font-black">{t.gateTitle}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[var(--dim)]">
        {t.gateBody(actionLabel)}
      </p>
      {inPiNet && (
        <p className="mx-auto mt-3 max-w-md rounded-xl bg-[var(--surface)] p-3 text-start text-sm font-semibold leading-relaxed">
          {t.pinetNote}
        </p>
      )}
      {inSandbox && (
        <p className="mx-auto mt-3 max-w-md rounded-xl bg-[var(--surface)] p-3 text-start text-sm font-semibold leading-relaxed">
          {t.sandboxNote}
        </p>
      )}
      {inPiBrowser || inSandbox ? (
        <>
          <button
            type="button"
            onClick={onLogin}
            disabled={loginBusy || !sdkReady}
            className="mt-4 rounded-full bg-[var(--gold)] px-6 py-3 font-display text-base font-black text-[#3b1145] disabled:opacity-60"
          >
            {loginBusy ? t.loggingIn : t.login}
          </button>
          {!sdkReady && <p className="mt-2 text-xs text-[var(--dim)]">{t.gatePreparing}</p>}
        </>
      ) : (
        <>
          <div className="mx-auto mt-4 max-w-md rounded-xl bg-[var(--surface)] p-4 text-start text-sm leading-relaxed">
            <p className="font-bold">{t.gateStepsTitle}</p>
            <ol className="mt-1 list-decimal space-y-1 ps-5">
              {t.gateSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-2 text-[var(--dim)]">{t.gateWebNote}</p>
          </div>
          <a
            href={PI_SANDBOX_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-full bg-[var(--gold)] px-6 py-3 font-display text-base font-black text-[#3b1145]"
          >
            {t.openSandbox}
          </a>
        </>
      )}
      {incompletePaymentId && (
        <p className="mt-3 text-sm font-semibold">{t.gateIncomplete(incompletePaymentId)}</p>
      )}
      {loginError && (
        <p role="alert" className="mt-3 font-semibold text-[var(--danger)]">
          {loginError}
        </p>
      )}
      {loginError && loginSandboxHint && (
        <a
          href={PI_SANDBOX_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-full bg-[var(--gold)] px-6 py-3 font-display text-base font-black text-[#3b1145]"
        >
          {t.openSandbox}
        </a>
      )}
    </div>
  );
}

/** Pi payment sheet (real Pi.createPayment flow when the server has payments enabled, otherwise the labeled Testnet simulation), shared by gig orders and offer acceptance. */
function PaymentSheet({
  amountPi,
  step,
  result,
  onDone,
  doneLabel,
}: {
  amountPi: number;
  step: number;
  result: { paymentRef: string; amountPi: number; commissionPi: number; sellerNetPi: number } | null;
  onDone: () => void;
  doneLabel: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.payDialogTitle}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-3xl bg-[var(--surface)] p-6 pb-safe sm:rounded-3xl">
        <p className="text-center font-display text-xl font-black">
          {t.payDialogTitle} <span className="text-sm font-bold text-[var(--dim)]">· Testnet</span>
        </p>
        <p className="mt-1 text-center font-display text-3xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
          {fmtPi(amountPi)}
        </p>
        {step < 4 ? (
          <ol className="mt-6 space-y-4">
            {t.paySteps.map((label, i) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-black ${
                    i < step
                      ? "bg-[var(--success)] text-white"
                      : i === step
                        ? "step-pop bg-[var(--gold)] text-[#3b1145]"
                        : "bg-[var(--surface-alt)] text-[var(--dim)]"
                  }`}
                >
                  {i < step ? "✓" : i + 1}
                </span>
                <span className={i <= step ? "font-semibold" : "text-[var(--dim)]"}>{label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-6 text-center">
            <p className="step-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)] font-display text-3xl font-black text-white">
              ✓
            </p>
            <p className="mt-3 font-display text-xl font-black">{t.paySuccess}</p>
            {result && (
              <div className="mt-4 space-y-1 rounded-[var(--radius)] bg-[var(--surface-alt)] p-4 text-start text-sm">
                <p className="flex justify-between gap-2">
                  <span>{t.payRef}</span>
                  <span dir="ltr" className="font-mono text-xs">{result.paymentRef}</span>
                </p>
                <p className="flex justify-between">
                  <span>{t.payPaid}</span>
                  <span>{fmtPi(result.amountPi)}</span>
                </p>
                <p className="flex justify-between">
                  <span>{t.commissionLine}</span>
                  <span>{fmtPi(result.commissionPi)}</span>
                </p>
                <p className="flex justify-between font-bold">
                  <span>{t.payNetLine}</span>
                  <span>{fmtPi(result.sellerNetPi)}</span>
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={onDone}
              className="mt-5 w-full rounded-full bg-[var(--accent)] py-3 font-display text-lg font-bold text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
            >
              {doneLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function App() {
  const queryClient = useQueryClient();
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return window.localStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
    } catch {
      return "ar";
    }
  });
  const t = STR[lang];
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<View>("market");
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [selectedGigId, setSelectedGigId] = useState<number | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);

  const [session, setSession] = useState<PiSession | null>(null);
  const [profile, setProfile] = useState<ApiResponse<typeof api, "piLogin"> | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [inPiBrowser, setInPiBrowser] = useState(false);
  const [inPiNet, setInPiNet] = useState(false);
  const [inSandbox, setInSandbox] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSandboxHint, setLoginSandboxHint] = useState(false);
  const [incompletePaymentId, setIncompletePaymentId] = useState<string | null>(null);
  const [incompleteResolvedMsg, setIncompleteResolvedMsg] = useState<string | null>(null);
  const resolvingIncompleteRef = useRef<string | null>(null);

  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.getStats({}),
  });

  // Orders needing my action: as seller, paid orders awaiting delivery;
  // as buyer, delivered orders awaiting my approval. Same cache key as
  // OrdersPanel, so this shares its fetch instead of adding another one.
  const ordersBadge = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.listOrders({ limit: 50 }),
    enabled: session != null,
  });
  const actionCount = (ordersBadge.data?.orders ?? []).filter((o) => {
    if (!session) return false;
    if (o.status === "awaiting_delivery" && o.sellerPiUid === session.piUid) return true;
    if (o.status === "delivered" && o.buyerPiUid === session.piUid) return true;
    return false;
  }).length;

  function setLang(l: Lang) {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }

  useEffect(() => {
    setInPiBrowser(/PiBrowser/i.test(window.navigator.userAgent));
    setInPiNet(detectPiNet());
    setInSandbox(detectPiSandbox());
    let cancelled = false;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (window.Pi) {
        window.clearInterval(timer);
        try {
          window.Pi.init({ version: "2.0", sandbox: detectPiSandbox() });
        } catch {
          /* already initialised */
        }
        if (!cancelled) setSdkReady(true);
      } else if (tries > 30) {
        window.clearInterval(timer);
      }
    }, 200);
    const saved = loadSession();
    if (saved) {
      setSession(saved);
      void api
        .piLogin(authOf(saved))
        .then((p) => {
          if (!cancelled) setProfile(p);
        })
        .catch(() => {
          if (!cancelled) {
            setSession(null);
            setProfile(null);
            window.localStorage.removeItem(SESSION_KEY);
          }
        });
    }
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function loginWithPi() {
    setLoginError(null);
    setLoginSandboxHint(false);
    if (!window.Pi) {
      setLoginError(t.loginErrorSdk);
      return;
    }
    setLoginBusy(true);
    try {
      const authResult = await window.Pi.authenticate(PI_SCOPES, (payment) =>
        setIncompletePaymentId(payment.identifier),
      );
      const next: PiSession = {
        piUid: authResult.user.uid,
        username: authResult.user.username,
        accessToken: authResult.accessToken,
        walletAddress: authResult.user.walletAddress,
      };
      const p = await api.piLogin(authOf(next));
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      setProfile(p);
      void queryClient.invalidateQueries({ queryKey: ["gigs"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (e) {
      // Show the underlying reason (the server's own Arabic message, or
      // the Pi SDK's error) next to the generic text, so a failed login
      // says exactly what went wrong instead of just "didn't complete".
      // Special case: the SDK's own "Authentication failed." means Pi's
      // host environment rejected the flow during the SDK's internal
      // token validation, before our server was contacted. PiGigz is a
      // Testnet app, so that happens in every non-Testnet host (PiNet's
      // preview shell and Pi Browser's live Mainnet shell alike); the
      // working path is Pi's Sandbox test environment, so say exactly
      // that and offer its link. Inside the Sandbox itself, fall through
      // to the generic message with the raw detail.
      const detail = e instanceof Error && e.message ? e.message : "";
      if (detail.includes("Authentication failed") && inPiNet) {
        setLoginError(t.loginErrorPinet);
        setLoginSandboxHint(true);
      } else if (detail.includes("Authentication failed") && !inSandbox) {
        setLoginError(t.loginErrorTestnet);
        setLoginSandboxHint(true);
      } else {
        setLoginError(detail ? `${t.loginErrorGeneric} (${detail})` : t.loginErrorGeneric);
      }
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProfile(null);
    setIncompletePaymentId(null);
    setIncompleteResolvedMsg(null);
    setLoginError(null);
    setLoginSandboxHint(false);
  }

  // An incomplete payment reported during Pi.authenticate is resolved
  // server-side as soon as we have a session: completed (and its escrow
  // order created) when it was approved with a transaction, else cancelled.
  useEffect(() => {
    if (!session || !incompletePaymentId) return;
    if (resolvingIncompleteRef.current === incompletePaymentId) return;
    resolvingIncompleteRef.current = incompletePaymentId;
    const paymentId = incompletePaymentId;
    void api
      .resolveIncompletePayment({ auth: authOf(session), paymentId })
      .then((res) => {
        if (res.resolution !== "not_configured") {
          setIncompletePaymentId(null);
          setIncompleteResolvedMsg(t.incompleteResolved(res.resolution));
          void queryClient.invalidateQueries({ queryKey: ["orders"] });
          void queryClient.invalidateQueries({ queryKey: ["stats"] });
        }
      })
      .catch(() => {
        /* keep the manual note visible; resolution retries next login */
        resolvingIncompleteRef.current = null;
      });
  }, [session, incompletePaymentId, queryClient, t]);

  const loginGateProps: LoginGateProps = {
    sdkReady,
    inPiBrowser,
    inPiNet,
    inSandbox,
    loginBusy,
    loginError,
    loginSandboxHint,
    incompletePaymentId,
    onLogin: () => void loginWithPi(),
  };

  const goOrders = () => {
    setSelectedGigId(null);
    setProfileUid(null);
    setView("orders");
  };

  // Jump flag: the hero "خدماتي" button opens the Sell view and scrolls
  // straight to the my-gigs list so the seller can edit right away.
  const [sellJump, setSellJump] = useState(false);
  const goMyGigs = () => {
    setSelectedGigId(null);
    setProfileUid(null);
    setView("sell");
    setSellJump(true);
  };

  const openProfile = (uid: string) => {
    setSelectedGigId(null);
    setProfileUid(uid);
  };

  const openGig = (id: number) => {
    setProfileUid(null);
    setSelectedGigId(id);
    setView("market");
  };

  return (
    <I18nCtx.Provider value={{ lang, t, setLang }}>
      <div
        dir={lang === "ar" ? "rtl" : "ltr"}
        lang={lang}
        className="min-h-screen bg-[var(--bg)] text-[var(--text)]"
      >
        <header className="bg-[var(--accent)] text-[#f7efe4] dark:bg-[#170720]">
          <div className="mx-auto max-w-5xl px-4 pt-safe">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={logoImg}
                  alt={t.logoAltHeader}
                  className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-md ring-2 ring-[var(--gold)] sm:h-14 sm:w-14"
                />
                <p className="font-display text-xl font-black tracking-tight sm:text-2xl">
                  PiGigz <span className="text-[var(--gold)]">· باي جيجز</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDemo((d) => !d)}
                  aria-pressed={demo}
                  className={`rounded-full px-4 py-1.5 font-display text-sm font-black ${
                    demo
                      ? "bg-white text-[#3b1145]"
                      : "bg-[var(--gold)] text-[#3b1145] ring-2 ring-white/70"
                  }`}
                >
                  {demo ? t.demoExit : t.demoTry}
                </button>
                <button
                  type="button"
                  onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                  aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
                  className="rounded-full bg-[var(--gold)] px-4 py-1.5 font-display text-sm font-black text-[#3b1145]"
                >
                  {t.langToggle}
                </button>
                <span className="hidden rounded-full border border-[var(--gold)] px-3 py-1 text-xs font-bold text-[var(--gold)] sm:inline">
                  {t.testnetBadge}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 pb-1">
              {session ? (
                <>
                  <span className="rounded-full bg-[var(--gold)] px-3.5 py-1.5 font-display text-sm font-black text-[#3b1145]">
                    @{session.username}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                    {profile == null
                      ? t.verifyingSession
                      : profile.verified
                        ? t.accountVerified
                        : t.accountUnverified}
                  </span>
                  {profile && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
                      {t.accountCounts(profile.gigCount, profile.boughtCount, profile.soldCount)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-bold"
                  >
                    {t.logout}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void loginWithPi()}
                    disabled={loginBusy}
                    className="rounded-full bg-[var(--gold)] px-4 py-2 font-display text-sm font-black text-[#3b1145] disabled:opacity-60"
                  >
                    {loginBusy ? t.loggingIn : t.login}
                  </button>
                  <span className="text-xs leading-relaxed text-[#e8d9f2]">
                    {inSandbox ? t.loginHintSandbox : inPiBrowser ? t.loginHintPi : t.loginHintWeb}
                  </span>
                </>
              )}
            </div>
            {inPiNet && !session && (
              <p className="pb-1 text-sm font-semibold leading-relaxed text-[#ffe1a8]">
                {t.pinetNote}
              </p>
            )}
            {inSandbox && !session && (
              <p className="pb-1 text-sm font-semibold leading-relaxed text-[#ffe1a8]">
                {t.sandboxNote}
              </p>
            )}
            {loginError && !session && (
              <p role="alert" className="pb-1 text-sm font-semibold text-[#ffb4a2]">
                {loginError}
              </p>
            )}
            {loginError && loginSandboxHint && !session && (
              <p className="pb-2">
                <a
                  href={PI_SANDBOX_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block rounded-full bg-[var(--gold)] px-4 py-2 font-display text-sm font-black text-[#3b1145]"
                >
                  {t.openSandbox}
                </a>
              </p>
            )}
            {incompletePaymentId && session && (
              <p className="pb-1 text-xs font-semibold text-[#ffe1a8]">
                {t.incompletePayment(incompletePaymentId)}
              </p>
            )}
            {incompleteResolvedMsg && (
              <p className="pb-1 text-xs font-semibold text-[#b8f4d4]">
                {incompleteResolvedMsg}
              </p>
            )}
            <div className="grid items-center gap-4 pb-6 pt-2 sm:grid-cols-2">
              <div>
                <h1 className="font-display text-4xl font-black leading-tight">
                  {t.heroTitleA}
                  <span className="text-[var(--gold)]">Pi</span>
                </h1>
                <p className="mt-2 text-base leading-relaxed text-[#e8d9f2]">{t.heroSubtitle}</p>
                {stats.data && (
                  <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {t.statGigs(stats.data.gigCount)}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {t.statCompleted(stats.data.completedCount)}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {t.statVolume(fmtPi(stats.data.volumePi))}
                    </span>
                  </div>
                )}
                {session && view === "market" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={goOrders}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-4 py-2 font-display text-sm font-black text-[#3b1145]"
                    >
                      {t.viewMyOrders}
                      {actionCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-black text-white">
                          {actionCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={goMyGigs}
                      className="inline-flex items-center gap-2 rounded-full border border-white/40 px-4 py-2 font-display text-sm font-black text-white"
                    >
                      {t.myGigsBtn}
                    </button>
                  </div>
                )}
              </div>
              <img
                src={logoImg}
                alt={t.logoAltHero}
                className="mx-auto w-full max-w-sm rounded-[var(--radius)] object-cover shadow-lg ring-2 ring-[var(--gold)]/60 sm:max-w-none"
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-10 pl-20 xl:pl-4">
          {demo ? (
            <DemoMode onExit={() => setDemo(false)} />
          ) : profileUid != null ? (
            <FreelancerProfile
              piUid={profileUid}
              session={session}
              loginGateProps={loginGateProps}
              onBack={() => setProfileUid(null)}
              onOpenGig={openGig}
            />
          ) : (
            <>
              {view === "market" &&
                (selectedGigId != null ? (
                  <GigDetail
                    gigId={selectedGigId}
                    session={session}
                    loginGateProps={loginGateProps}
                    onBack={() => setSelectedGigId(null)}
                    onOrdered={goOrders}
                    onOpenProfile={openProfile}
                  />
                ) : (
                  <Market
                    category={category}
                    setCategory={setCategory}
                    query={query}
                    setQuery={setQuery}
                    onOpen={openGig}
                    onPublish={() => setView("sell")}
                    onOpenProfile={openProfile}
                    onTryDemo={() => setDemo(true)}
                  />
                ))}
              {view === "sell" && (
                <SellPanel
                  session={session}
                  loginGateProps={loginGateProps}
                  onPublished={() => setView("market")}
                  jumpToMyGigs={sellJump}
                  onJumped={() => setSellJump(false)}
                />
              )}
              {view === "jobs" && (
                <JobsPanel
                  session={session}
                  loginGateProps={loginGateProps}
                  onOrdered={goOrders}
                  onOpenProfile={openProfile}
                />
              )}
              {view === "orders" && (
                <OrdersPanel
                  session={session}
                  loginGateProps={loginGateProps}
                  onOpenProfile={openProfile}
                />
              )}
              {view === "wallet" && (
                <WalletPanel session={session} loginGateProps={loginGateProps} />
              )}
              {view === "map" && (
                <MapPanel onOpenGig={openGig} onOpenProfile={openProfile} />
              )}
            </>
          )}
        </main>

        {!demo && (
        <nav
          aria-label="Main"
          className="fixed left-2 top-1/2 z-40 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          <div className="flex w-16 flex-col py-1">
            {(
              [
                { key: "market", label: t.nav.market },
                { key: "jobs", label: t.nav.jobs },
                { key: "sell", label: t.nav.sell },
                { key: "orders", label: t.nav.orders },
                { key: "wallet", label: t.nav.wallet },
                { key: "map", label: t.nav.map },
              ] as { key: View; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-current={view === tab.key && profileUid == null ? "page" : undefined}
                onClick={() => {
                  setView(tab.key);
                  setProfileUid(null);
                  if (tab.key === "market") setSelectedGigId(null);
                }}
                className={`px-1 py-3 text-center font-display text-[10px] font-bold leading-tight sm:text-[11px] ${
                  view === tab.key && profileUid == null
                    ? "text-[var(--accent)] dark:text-[var(--gold)]"
                    : "text-[var(--dim)]"
                }`}
              >
                <span className="relative inline-block">
                  {tab.label}
                  {tab.key === "orders" && actionCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-black text-white">
                      {actionCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </nav>
        )}
      </div>
    </I18nCtx.Provider>
  );
}

function Market({
  category,
  setCategory,
  query,
  setQuery,
  onOpen,
  onPublish,
  onOpenProfile,
  onTryDemo,
}: {
  category: Category | null;
  setCategory: (c: Category | null) => void;
  query: string;
  setQuery: (q: string) => void;
  onOpen: (id: number) => void;
  onPublish: () => void;
  onOpenProfile: (uid: string) => void;
  onTryDemo?: () => void;
}) {
  const { t } = useI18n();
  const gigs = useQuery({
    queryKey: ["gigs", category, query],
    queryFn: () => api.listGigs({ category, query, limit: 50 }),
  });

  return (
    <section aria-label={t.nav.market}>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.key)}
              className={`overflow-hidden rounded-[var(--radius)] border-2 bg-[var(--surface)] text-center transition ${
                active ? "border-[var(--gold)] shadow-md" : "border-[var(--border)]"
              }`}
            >
              <img src={c.img} alt="" className="h-16 w-full object-cover sm:h-20" />
              <span className="block py-2 font-display text-sm font-bold sm:text-base">
                {t.cat[c.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="gig-search">
          {t.searchLabel}
        </label>
        <input
          id="gig-search"
          {...FIELDS.listGigs.query}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-base"
        />
        <button
          type="button"
          onClick={onPublish}
          className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2.5 font-display text-base font-bold text-[#3b1145]"
        >
          {t.publishCta}
        </button>
      </div>

      {category && (
        <p className="mt-3 text-sm text-[var(--dim)]">
          {t.categoryFilterNote(t.cat[category])}
          <button
            type="button"
            className="font-bold text-[var(--accent)] underline dark:text-[var(--gold)]"
            onClick={() => setCategory(null)}
          >
            {t.showAll}
          </button>
        </p>
      )}

      {gigs.isPending && <p className="py-10 text-center text-[var(--dim)]">{t.loadingGigs}</p>}
      {gigs.error && <p className="py-10 text-center text-[var(--danger)]">{t.loadError}</p>}
      {gigs.data && gigs.data.gigs.length === 0 && (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">{t.emptyGigsTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--dim)]">
            {query || category ? t.emptyGigsSearch : t.emptyGigsFresh}
          </p>
          <button
            type="button"
            onClick={onPublish}
            className="mt-5 rounded-full bg-[var(--accent)] px-6 py-3 font-display text-base font-bold text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
          >
            {t.publishFirst}
          </button>
          {onTryDemo && !query && !category && (
            <div className="mt-6 border-t border-dashed border-[var(--border)] pt-5">
              <p className="text-sm text-[var(--dim)]">{t.demoBannerText}</p>
              <button
                type="button"
                onClick={onTryDemo}
                className="mt-3 rounded-full bg-[var(--gold)] px-6 py-3 font-display text-base font-black text-[#3b1145]"
              >
                {t.demoTry}
              </button>
            </div>
          )}
        </div>
      )}
      {gigs.data && gigs.data.gigs.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.data.gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} onOpen={onOpen} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      )}
    </section>
  );
}

function GigCard({
  gig,
  onOpen,
  onOpenProfile,
}: {
  gig: Gig;
  onOpen: (id: number) => void;
  onOpenProfile?: (uid: string) => void;
}) {
  const { t } = useI18n();
  return (
    <article
      className={`overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-sm ${
        gig.status === "paused" ? "opacity-70" : ""
      }`}
    >
      <img
        src={CAT_IMG[gig.category]}
        alt={t.catImgAlt(t.cat[gig.category])}
        className="h-36 w-full object-cover"
      />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold">
            {t.cat[gig.category]}
          </span>
          {gig.status === "paused" && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 dark:bg-red-950 dark:text-red-300">
              {t.pausedBadge}
            </span>
          )}
        </div>
        <h2 className="mt-2 font-display text-lg font-bold leading-snug">{gig.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--dim)]">
          {gig.description}
        </p>
        <p className="mt-2 text-sm">
          {gig.sellerPiUid && onOpenProfile ? (
            <button
              type="button"
              onClick={() => onOpenProfile(gig.sellerPiUid!)}
              className="font-semibold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
            >
              @{gig.sellerName}
            </button>
          ) : (
            <span className="font-semibold">
              {gig.sellerPiUid ? `@${gig.sellerName}` : gig.sellerName}
            </span>
          )}
          {gig.sellerPiUid && (
            <span className="ms-1.5 rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[11px] font-bold text-[#8a5d00] dark:text-[var(--gold)]">
              {t.piAccountBadge}
            </span>
          )}
          {gig.avgRating != null && (
            <span className="ms-2">
              <Stars value={gig.avgRating} size="text-sm" />{" "}
              <span className="text-[var(--dim)]">
                {gig.avgRating} ({gig.reviewCount})
              </span>
            </span>
          )}
          {gig.orderCount > 0 && (
            <span className="ms-2 text-[var(--dim)]">· {t.ordersCount(gig.orderCount)}</span>
          )}
        </p>
        <div className="mt-3 flex items-end justify-between border-t border-[var(--border)] pt-3">
          <p>
            <span className="font-display text-2xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
              {fmtPi(gig.pricePi)}
            </span>
            <span className="block text-xs text-[var(--dim)]">{t.deliveryIn(gig.deliveryDays)}</span>
          </p>
          <button
            type="button"
            onClick={() => onOpen(gig.id)}
            className="rounded-full bg-[var(--gold)] px-5 py-2.5 font-display text-base font-bold text-[#3b1145]"
          >
            {t.orderNow}
          </button>
        </div>
      </div>
    </article>
  );
}

function GigDetail({
  gigId,
  session,
  loginGateProps,
  onBack,
  onOrdered,
  onOpenProfile,
}: {
  gigId: number;
  session: PiSession | null;
  loginGateProps: LoginGateProps;
  onBack: () => void;
  onOrdered: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const gigs = useQuery({
    queryKey: ["gigs", null, ""],
    queryFn: () => api.listGigs({ category: null, query: "", limit: 50 }),
  });
  const reviews = useQuery({
    queryKey: ["reviews", gigId],
    queryFn: () => api.listReviews({ gigId }),
  });
  const gig = gigs.data?.gigs.find((g) => g.id === gigId);

  const [brief, setBrief] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [payStep, setPayStep] = useState<number | null>(null);
  const [payResult, setPayResult] = useState<{
    paymentRef: string;
    amountPi: number;
    commissionPi: number;
    sellerNetPi: number;
  } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const paymentConfig = useQuery({
    queryKey: ["paymentConfig"],
    queryFn: () => api.getPaymentConfig({}),
  });
  const realPayments = paymentConfig.data?.realPayments ?? false;

  const createOrder = useMutation({
    mutationFn: async (input: { gigId: number; brief: string }) => {
      if (!session) throw new Error(t.needLogin);
      return await api.createOrder({
        auth: authOf(session),
        gigId: input.gigId,
        brief: input.brief,
      });
    },
    onError: (err) =>
      setPayError(err instanceof Error && err.message ? err.message : t.payErrorGeneric),
  });

  async function runPayment(e: FormEvent) {
    e.preventDefault();
    if (!gig || !session) return;
    if (brief.trim().length < 5) {
      setFormError(t.briefError);
      return;
    }
    setFormError(null);
    setPayError(null);
    setPayResult(null);
    setPayStep(0);
    if (realPayments) {
      // Real user_to_app payment: server intent → Pi.createPayment → server
      // approve → server complete → escrow order.
      try {
        const intent = await api.preparePayment({
          auth: authOf(session),
          kind: "gig",
          gigId: gig.id,
          offerId: null,
          brief: brief.trim(),
        });
        const res = await runRealPiPayment({
          session,
          intentId: intent.intentId,
          amountPi: intent.amountPi,
          memo: intent.memo,
          onStep: setPayStep,
          cancelledMessage: t.payCancelled,
          errorMessage: t.payErrorGeneric,
        });
        setPayResult(res);
        setPayStep(4);
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        void queryClient.invalidateQueries({ queryKey: ["stats"] });
      } catch (err) {
        setPayStep(null);
        setPayError(err instanceof Error && err.message ? err.message : t.payErrorGeneric);
      }
      return;
    }
    await sleep(900);
    setPayStep(1);
    await sleep(900);
    setPayStep(2);
    await sleep(1200);
    setPayStep(3);
    try {
      const res = await createOrder.mutateAsync({ gigId: gig.id, brief: brief.trim() });
      setPayResult(res);
      setPayStep(4);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    } catch {
      setPayStep(null);
    }
  }

  if (gigs.isPending) return <p className="py-10 text-center text-[var(--dim)]">{t.loadingGigs}</p>;
  if (!gig) {
    return (
      <div className="py-10 text-center">
        <p className="text-[var(--dim)]">{t.gigNotFound}</p>
        <button type="button" onClick={onBack} className="mt-3 font-bold underline">
          {t.backToMarket}
        </button>
      </div>
    );
  }

  const commission = Math.round(gig.pricePi * 0.1 * 10000) / 10000;
  const sellerNet = Math.round((gig.pricePi - commission) * 10000) / 10000;

  return (
    <section aria-label={gig.title} className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="font-display text-base font-bold text-[var(--accent)] dark:text-[var(--gold)]"
      >
        {t.backToMarket}
      </button>

      <div className="mt-3 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
        <img
          src={CAT_IMG[gig.category]}
          alt={t.catImgAlt(t.cat[gig.category])}
          className="h-48 w-full object-cover sm:h-64"
        />
        <div className="p-5">
          <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-bold">
            {t.cat[gig.category]}
          </span>
          <h2 className="mt-3 font-display text-2xl font-black leading-snug sm:text-3xl">
            {gig.title}
          </h2>
          <p className="mt-2 text-base">
            {t.offeredBy}{" "}
            {gig.sellerPiUid ? (
              <button
                type="button"
                onClick={() => onOpenProfile(gig.sellerPiUid!)}
                className="font-bold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
              >
                @{gig.sellerName}
              </button>
            ) : (
              <strong>{gig.sellerName}</strong>
            )}
            {gig.sellerPiUid && (
              <span className="ms-1.5 rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[11px] font-bold text-[#8a5d00] dark:text-[var(--gold)]">
                {t.piAccountBadge}
              </span>
            )}
            {gig.avgRating != null && (
              <>
                {" · "}
                <Stars value={gig.avgRating} size="text-sm" />{" "}
                {t.ratingsFrom(gig.avgRating, gig.reviewCount)}
              </>
            )}
            {" · "}
            {t.deliveryIn(gig.deliveryDays)}
          </p>
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[var(--dim)]">
            {gig.description}
          </p>

          <div className="mt-5 rounded-[var(--radius)] bg-[var(--surface-alt)] p-4">
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">{t.totalPrice}</span>
              <span className="font-display text-3xl font-black">{fmtPi(gig.pricePi)}</span>
            </p>
            <p className="mt-2 flex justify-between text-sm text-[var(--dim)]">
              <span>{t.commissionLine}</span>
              <span>{fmtPi(commission)}</span>
            </p>
            <p className="flex justify-between text-sm text-[var(--dim)]">
              <span>{t.sellerNetLine}</span>
              <span>{fmtPi(sellerNet)}</span>
            </p>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed">
              {t.escrowExplain}
            </p>
          </div>

          {gig.status === "paused" ? (
            <p className="mt-5 rounded-[var(--radius)] bg-red-50 p-4 font-semibold text-[var(--danger)] dark:bg-red-950">
              {t.gigPausedNote}
            </p>
          ) : !session ? (
            <div className="mt-5">
              <LoginGate actionLabel={t.actionOrder} {...loginGateProps} />
            </div>
          ) : gig.sellerPiUid && gig.sellerPiUid === session.piUid ? (
            <p className="mt-5 rounded-[var(--radius)] bg-[var(--surface-alt)] p-4 font-semibold">
              {t.ownGigNote(session.username)}
            </p>
          ) : (
            <form onSubmit={runPayment} className="mt-5 space-y-3">
              <p className="rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm">
                {t.orderAsNote(session.username)}
              </p>
              <div>
                <label htmlFor="order-brief" className="mb-1 block font-semibold">
                  {t.briefLabel}
                </label>
                <textarea
                  id="order-brief"
                  {...FIELDS.createOrder.brief}
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  rows={4}
                  placeholder={t.briefPlaceholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
              {formError && (
                <p role="alert" className="font-semibold text-[var(--danger)]">
                  {formError}
                </p>
              )}
              {payError && (
                <p role="alert" className="font-semibold text-[var(--danger)]">
                  {payError}
                </p>
              )}
              <button
                type="submit"
                disabled={payStep != null}
                className="w-full rounded-full bg-[var(--gold)] py-3.5 font-display text-lg font-black text-[#3b1145] disabled:opacity-60"
              >
                {t.payBtn(fmtPi(gig.pricePi))}
              </button>
              <p className="text-center text-xs leading-relaxed text-[var(--dim)]">
                {realPayments ? t.payRealNote : t.paySimNote}
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-display text-xl font-black">{t.reviewsTitle}</h3>
        {reviews.isPending && <p className="mt-2 text-[var(--dim)]">{t.loadingReviews}</p>}
        {reviews.data && reviews.data.reviews.length === 0 && (
          <p className="mt-2 text-[var(--dim)]">{t.noReviews}</p>
        )}
        <ul className="mt-3 space-y-3">
          {reviews.data?.reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="flex flex-wrap items-center gap-2">
                <strong>{r.buyerPiUid ? `@${r.buyerName}` : r.buyerName}</strong>
                <Stars value={r.rating} size="text-sm" />
                <span className="text-xs text-[var(--dim)]">{fmtDate(r.createdAt, lang)}</span>
              </p>
              <p className="mt-1 leading-relaxed">{r.comment}</p>
            </li>
          ))}
        </ul>
      </div>

      {payStep != null && (
        <PaymentSheet
          amountPi={gig.pricePi}
          step={payStep}
          result={payResult}
          onDone={onOrdered}
          doneLabel={t.viewMyOrders}
        />
      )}
    </section>
  );
}

function SellPanel({
  session,
  loginGateProps,
  onPublished,
  jumpToMyGigs,
  onJumped,
}: {
  session: PiSession | null;
  loginGateProps: LoginGateProps;
  onPublished: () => void;
  jumpToMyGigs?: boolean;
  onJumped?: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("design");
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("3");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [walletAddr, setWalletAddr] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Shared with the Wallet tab / order cards: the seller's saved payout
  // wallet, used to pre-fill the wallet field when editing a gig.
  const wallet = useQuery({
    queryKey: ["wallet", session?.piUid ?? ""],
    queryFn: () => api.getWallet({ auth: authOf(session!) }),
    enabled: !!session,
  });

  // The hero "خدماتي" button opens this view and jumps straight to the list.
  useEffect(() => {
    if (!jumpToMyGigs) return;
    document.getElementById("my-gigs")?.scrollIntoView({ behavior: "smooth" });
    onJumped?.();
  }, [jumpToMyGigs, onJumped]);

  const myGigs = useQuery({
    queryKey: ["gigs", null, ""],
    queryFn: () => api.listGigs({ category: null, query: "", limit: 50 }),
  });

  const createGig = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t.needLogin);
      return await api.createGig({
        auth: authOf(session),
        title: title.trim(),
        description: description.trim(),
        category,
        pricePi: Number(price),
        deliveryDays: Number(days),
      });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.sellErrGeneric),
  });

  const setStatus = useMutation({
    mutationFn: async (input: { id: number; status: "active" | "paused" }) => {
      if (!session) throw new Error(t.needLogin);
      return await api.setGigStatus({ ...input, auth: authOf(session) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gigs"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => setError(t.statusErrGeneric),
  });

  const updateGig = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t.needLogin);
      if (editingId == null) throw new Error(t.editErrGeneric);
      const nextWallet = walletAddr.trim();
      if (nextWallet && nextWallet !== (wallet.data?.walletAddress ?? "")) {
        if (!/^G[A-Z2-7]{55}$/.test(nextWallet)) throw new Error(t.walletAddrErr);
        await api.setWalletAddress({ auth: authOf(session), walletAddress: nextWallet });
      }
      return await api.updateGig({
        auth: authOf(session),
        id: editingId,
        title: title.trim(),
        description: description.trim(),
        category,
        pricePi: Number(price),
        deliveryDays: Number(days),
      });
    },
    onSuccess: () => {
      setEditingId(null);
      setTitle("");
      setDescription("");
      setCategory("design");
      setPrice("");
      setDays("3");
      setWalletAddr("");
      setDone(false);
      void queryClient.invalidateQueries({ queryKey: ["gigs"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet", session?.piUid ?? ""] });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.editErrGeneric),
  });

  const deleteGig = useMutation({
    mutationFn: async (id: number) => {
      if (!session) throw new Error(t.needLogin);
      return await api.deleteGig({ auth: authOf(session), id });
    },
    onSuccess: () => {
      setConfirmDeleteId(null);
      if (editingId != null) cancelEdit();
      void queryClient.invalidateQueries({ queryKey: ["gigs"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.deleteErrGeneric),
  });

  function startEdit(g: {
    id: number;
    title: string;
    description: string;
    category: Category;
    pricePi: number;
    deliveryDays: number;
  }) {
    setEditingId(g.id);
    setTitle(g.title);
    setDescription(g.description);
    setCategory(g.category);
    setPrice(String(g.pricePi));
    setDays(String(g.deliveryDays));
    setWalletAddr(wallet.data?.walletAddress ?? "");
    setError(null);
    setDone(false);
    setConfirmDeleteId(null);
    document.getElementById("gig-form")?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("design");
    setPrice("");
    setDays("3");
    setWalletAddr("");
    setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!session) return setError(t.needLogin);
    if (title.trim().length < 3) return setError(t.sellErrTitle);
    if (description.trim().length < 10) return setError(t.sellErrDesc);
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return setError(t.sellErrPrice);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 90) return setError(t.sellErrDays);
    if (editingId != null) {
      updateGig.mutate();
      return;
    }
    createGig.mutate(undefined, {
      onSuccess: () => {
        setDone(true);
        setTitle("");
        setDescription("");
        setPrice("");
        void queryClient.invalidateQueries({ queryKey: ["gigs"] });
        void queryClient.invalidateQueries({ queryKey: ["stats"] });
      },
    });
  }

  return (
    <section aria-label={t.nav.sell} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.sellTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.sellSubtitle}</p>

      {!session ? (
        <div className="mt-4">
          <LoginGate actionLabel={t.actionPublish} {...loginGateProps} />
        </div>
      ) : (
        <>
          <p className="mt-4 rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm">
            {t.sellAsNote(session.username)}
          </p>
          <button
            type="button"
            onClick={() =>
              document.getElementById("my-gigs")?.scrollIntoView({ behavior: "smooth" })
            }
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
          >
            {t.myGigsBtn}
          </button>
          {done && (
            <div className="mt-4 rounded-[var(--radius)] bg-emerald-100 p-4 font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              {t.sellDone}{" "}
              <button type="button" onClick={onPublished} className="underline">
                {t.sellDoneLink}
              </button>
            </div>
          )}

          {editingId != null && (
            <p className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {t.editingNote}{" "}
              <button type="button" onClick={cancelEdit} className="underline">
                {t.cancelEditBtn}
              </button>
            </p>
          )}

          <form
            id="gig-form"
            onSubmit={submit}
            className="mt-4 space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div>
              <label htmlFor="gig-title" className="mb-1 block font-semibold">
                {t.gigTitleLabel}
              </label>
              <input
                id="gig-title"
                {...FIELDS.createGig.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.gigTitlePlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
            </div>
            <div>
              <span className="mb-2 block font-semibold" id="gig-category-label">
                {t.gigCategoryLabel}
              </span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="gig-category-label">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={category === c.key}
                    onClick={() => setCategory(c.key)}
                    className={`overflow-hidden rounded-xl border-2 ${
                      category === c.key ? "border-[var(--gold)]" : "border-[var(--border)]"
                    }`}
                  >
                    <img src={c.img} alt="" className="h-12 w-full object-cover" />
                    <span className="block py-1.5 font-display text-sm font-bold">{t.cat[c.key]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="gig-desc" className="mb-1 block font-semibold">
                {t.gigDescLabel}
              </label>
              <textarea
                id="gig-desc"
                {...FIELDS.createGig.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={t.gigDescPlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gig-price" className="mb-1 block font-semibold">
                  {t.priceLabel}
                </label>
                <input
                  id="gig-price"
                  {...FIELDS.createGig.pricePi}
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="25"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
              <div>
                <label htmlFor="gig-days" className="mb-1 block font-semibold">
                  {t.daysLabel}
                </label>
                <input
                  id="gig-days"
                  {...FIELDS.createGig.deliveryDays}
                  type="number"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
            </div>
            {editingId != null && (
              <div>
                <label htmlFor="gig-wallet" className="mb-1 block font-semibold">
                  {t.payoutWalletTitle}
                </label>
                <input
                  id="gig-wallet"
                  value={walletAddr}
                  onChange={(e) => setWalletAddr(e.target.value)}
                  placeholder={t.payoutWalletPlaceholder}
                  dir="ltr"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-[var(--dim)]">{t.payoutWalletHint}</p>
              </div>
            )}
            {price && Number(price) > 0 && (
              <p className="rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm">
                {t.netPreview(fmtPi(Math.round(Number(price) * 0.9 * 10000) / 10000))}
              </p>
            )}
            {error && (
              <p role="alert" className="font-semibold text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={createGig.isPending || updateGig.isPending}
              className="w-full rounded-full bg-[var(--gold)] py-3.5 font-display text-lg font-black text-[#3b1145] disabled:opacity-60"
            >
              {editingId != null
                ? updateGig.isPending
                  ? t.savingEdit
                  : t.saveEditBtn
                : createGig.isPending
                  ? t.publishing
                  : t.publishBtn}
            </button>
          </form>
        </>
      )}

      {session &&
        myGigs.data &&
        myGigs.data.gigs.filter((g) => g.sellerPiUid === session.piUid).length > 0 && (
          <div id="my-gigs" className="mt-8 scroll-mt-4">
            <h3 className="font-display text-xl font-black">{t.myGigsTitle(session.username)}</h3>
            <ul className="mt-3 space-y-3">
              {myGigs.data.gigs
                .filter((g) => g.sellerPiUid === session.piUid)
                .map((g) => (
                  <li
                    key={g.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-display font-bold">{g.title}</p>
                      <p className="text-sm text-[var(--dim)]">
                        {g.sellerName} · {t.cat[g.category]} · {fmtPi(g.pricePi)} ·{" "}
                        {g.status === "active" ? t.gigActive : t.gigPausedState}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
                      >
                        {t.editBtn}
                      </button>
                      <button
                        type="button"
                        disabled={deleteGig.isPending}
                        onClick={() => {
                          if (confirmDeleteId === g.id) {
                            setError(null);
                            deleteGig.mutate(g.id);
                          } else {
                            setConfirmDeleteId(g.id);
                          }
                        }}
                        className={`rounded-full border px-4 py-2 font-display text-sm font-bold disabled:opacity-60 ${
                          confirmDeleteId === g.id
                            ? "border-[var(--danger)] bg-[var(--danger)] text-white"
                            : "border-[var(--danger)] text-[var(--danger)]"
                        }`}
                      >
                        {confirmDeleteId === g.id ? t.confirmDeleteBtn : t.deleteBtn}
                      </button>
                      <button
                        type="button"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({
                            id: g.id,
                            status: g.status === "active" ? "paused" : "active",
                          })
                        }
                        className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
                      >
                        {g.status === "active" ? t.pauseBtn : t.activateBtn}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
    </section>
  );
}

function JobsPanel({
  session,
  loginGateProps,
  onOrdered,
  onOpenProfile,
}: {
  session: PiSession | null;
  loginGateProps: LoginGateProps;
  onOrdered: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("design");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const requests = useQuery({
    queryKey: ["jobRequests"],
    queryFn: () => api.listJobRequests({ status: null, limit: 50 }),
  });

  const createReq = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t.needLogin);
      return await api.createJobRequest({
        auth: authOf(session),
        title: title.trim(),
        description: description.trim(),
        category,
        budgetPi: Number(budget),
        durationDays: Number(days),
      });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.sellErrGeneric),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!session) return setError(t.needLogin);
    if (title.trim().length < 3) return setError(t.sellErrTitle);
    if (description.trim().length < 10) return setError(t.sellErrDesc);
    const b = Number(budget);
    if (!Number.isFinite(b) || b <= 0) return setError(t.sellErrPrice);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 180) return setError(t.sellErrDays);
    createReq.mutate(undefined, {
      onSuccess: () => {
        setPosted(true);
        setTitle("");
        setDescription("");
        setBudget("");
        void queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
      },
    });
  }

  return (
    <section aria-label={t.nav.jobs} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.jobsTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.jobsSubtitle}</p>

      {!session ? (
        <div className="mt-4">
          <LoginGate actionLabel={t.actionPostJob} {...loginGateProps} />
        </div>
      ) : (
        <div className="mt-4">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full rounded-full bg-[var(--gold)] py-3 font-display text-base font-black text-[#3b1145]"
            >
              + {t.postJobTitle}
            </button>
          ) : (
            <form
              onSubmit={submit}
              className="space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <h3 className="font-display text-lg font-black">{t.postJobTitle}</h3>
              {posted && (
                <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  {t.jobPosted}
                </p>
              )}
              <div>
                <label htmlFor="job-title" className="mb-1 block font-semibold">
                  {t.jobTitleLabel}
                </label>
                <input
                  id="job-title"
                  {...FIELDS.createJobRequest.title}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.jobTitlePlaceholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
              <div>
                <span className="mb-2 block font-semibold" id="job-category-label">
                  {t.gigCategoryLabel}
                </span>
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="job-category-label">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={category === c.key}
                      onClick={() => setCategory(c.key)}
                      className={`overflow-hidden rounded-xl border-2 ${
                        category === c.key ? "border-[var(--gold)]" : "border-[var(--border)]"
                      }`}
                    >
                      <img src={c.img} alt="" className="h-12 w-full object-cover" />
                      <span className="block py-1.5 font-display text-sm font-bold">{t.cat[c.key]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="job-desc" className="mb-1 block font-semibold">
                  {t.jobDescLabel}
                </label>
                <textarea
                  id="job-desc"
                  {...FIELDS.createJobRequest.description}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t.jobDescPlaceholder}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="job-budget" className="mb-1 block font-semibold">
                    {t.budgetLabel}
                  </label>
                  <input
                    id="job-budget"
                    {...FIELDS.createJobRequest.budgetPi}
                    type="number"
                    inputMode="decimal"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="30"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                  />
                </div>
                <div>
                  <label htmlFor="job-days" className="mb-1 block font-semibold">
                    {t.durationLabel}
                  </label>
                  <input
                    id="job-days"
                    {...FIELDS.createJobRequest.durationDays}
                    type="number"
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                  />
                </div>
              </div>
              {error && (
                <p role="alert" className="font-semibold text-[var(--danger)]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={createReq.isPending}
                className="w-full rounded-full bg-[var(--gold)] py-3 font-display text-base font-black text-[#3b1145] disabled:opacity-60"
              >
                {createReq.isPending ? t.postingJob : t.postJobBtn}
              </button>
            </form>
          )}
        </div>
      )}

      {requests.isPending && <p className="py-8 text-center text-[var(--dim)]">{t.loadingJobs}</p>}
      {requests.error && <p className="py-8 text-center text-[var(--danger)]">{t.loadError}</p>}
      {requests.data && requests.data.requests.length === 0 && (
        <div className="mt-6 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">{t.emptyJobsTitle}</p>
          <p className="mt-2 text-[var(--dim)]">{t.emptyJobsBody}</p>
        </div>
      )}
      <div className="mt-5 space-y-4">
        {requests.data?.requests.map((req) => (
          <JobRequestCard
            key={req.id}
            req={req}
            session={session}
            onOrdered={onOrdered}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </section>
  );
}

function JobRequestCard({
  req,
  session,
  onOrdered,
  onOpenProfile,
}: {
  req: JobRequest;
  session: PiSession | null;
  onOrdered: () => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [showOffers, setShowOffers] = useState(false);
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("3");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offerSent, setOfferSent] = useState(false);
  const [payStep, setPayStep] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payResult, setPayResult] = useState<{
    paymentRef: string;
    amountPi: number;
    commissionPi: number;
    sellerNetPi: number;
  } | null>(null);

  const isOwner = !!session && !!req.buyerPiUid && req.buyerPiUid === session.piUid;

  const offers = useQuery({
    queryKey: ["offers", req.id],
    queryFn: () => api.listOffers({ jobRequestId: req.id }),
    enabled: showOffers,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["jobRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["offers", req.id] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };
  const onErr = (err: unknown) =>
    setError(err instanceof Error && err.message ? err.message : t.actionErrGeneric);

  const createOffer = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t.needLogin);
      return await api.createOffer({
        auth: authOf(session),
        jobRequestId: req.id,
        pricePi: Number(price),
        deliveryDays: Number(days),
        message: message.trim(),
      });
    },
    onSuccess: () => {
      setOfferSent(true);
      setPrice("");
      setMessage("");
      invalidate();
    },
    onError: onErr,
  });

  const cancelReq = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t.needLogin);
      return await api.cancelJobRequest({ auth: authOf(session), id: req.id });
    },
    onSuccess: invalidate,
    onError: onErr,
  });

  const acceptOffer = useMutation({
    mutationFn: async (offerId: number) => {
      if (!session) throw new Error(t.needLogin);
      return await api.acceptOffer({ auth: authOf(session), offerId });
    },
    onError: (err) => {
      setPayStep(null);
      onErr(err);
    },
  });

  const paymentConfig = useQuery({
    queryKey: ["paymentConfig"],
    queryFn: () => api.getPaymentConfig({}),
  });
  const realPayments = paymentConfig.data?.realPayments ?? false;

  async function runAccept(offerId: number, amount: number) {
    if (!session) return;
    setError(null);
    setPayResult(null);
    setPayAmount(amount);
    setPayStep(0);
    if (realPayments) {
      // Real user_to_app payment for the accepted offer, same flow as gigs.
      try {
        const intent = await api.preparePayment({
          auth: authOf(session),
          kind: "offer",
          gigId: null,
          offerId,
          brief: "",
        });
        const res = await runRealPiPayment({
          session,
          intentId: intent.intentId,
          amountPi: intent.amountPi,
          memo: intent.memo,
          onStep: setPayStep,
          cancelledMessage: t.payCancelled,
          errorMessage: t.payErrorGeneric,
        });
        setPayResult(res);
        setPayStep(4);
        invalidate();
      } catch (err) {
        setPayStep(null);
        onErr(err);
      }
      return;
    }
    await sleep(900);
    setPayStep(1);
    await sleep(900);
    setPayStep(2);
    await sleep(1200);
    setPayStep(3);
    try {
      const res = await acceptOffer.mutateAsync(offerId);
      setPayResult(res);
      setPayStep(4);
      invalidate();
    } catch {
      /* onError already handled */
    }
  }

  const statusClass =
    req.status === "open"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : req.status === "awarded"
        ? "bg-[var(--gold-soft)] text-[#8a5d00] dark:text-[var(--gold)]"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-snug">{req.title}</h3>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            {t.clientLabel}: {req.buyerPiUid ? `@${req.buyerName}` : req.buyerName} ·{" "}
            {t.cat[req.category]} · {fmtDate(req.createdAt, lang)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}>
          {t.jobStatus[req.status]}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-line rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm leading-relaxed">
        {req.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
          {t.budgetLine(fmtPi(req.budgetPi))}
        </span>
        <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
          {t.durationLine(req.durationDays)}
        </span>
        <span className="rounded-full border border-[var(--border)] px-3 py-1.5">
          {t.offersCount(req.offerCount)}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowOffers((v) => !v)}
          aria-expanded={showOffers}
          className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
        >
          {showOffers ? t.hideOffers : t.viewOffers}
        </button>
        {isOwner && req.status === "open" && (
          <button
            type="button"
            disabled={cancelReq.isPending}
            onClick={() => {
              setError(null);
              cancelReq.mutate();
            }}
            className="rounded-full border border-[var(--danger)] px-4 py-2 font-display text-sm font-bold text-[var(--danger)] disabled:opacity-60"
          >
            {t.cancelJobBtn}
          </button>
        )}
      </div>
      {isOwner && req.status === "open" && (
        <p className="mt-2 text-sm text-[var(--dim)]">{t.yourRequestNote}</p>
      )}

      {showOffers && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          {offers.isPending && <p className="text-[var(--dim)]">{t.chatLoading}</p>}
          {offers.data && offers.data.offers.length === 0 && (
            <p className="text-[var(--dim)]">{t.noOffersYet}</p>
          )}
          <ul className="space-y-3">
            {offers.data?.offers.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {o.sellerPiUid ? (
                    <button
                      type="button"
                      onClick={() => onOpenProfile(o.sellerPiUid!)}
                      className="font-bold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
                    >
                      @{o.sellerName}
                    </button>
                  ) : (
                    <strong>{o.sellerName}</strong>
                  )}
                  <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold">
                    {t.offerPrice(fmtPi(o.pricePi))}
                  </span>
                  <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold">
                    {t.offerDays(o.deliveryDays)}
                  </span>
                  <span className="text-xs text-[var(--dim)]">{t.offerStatus[o.status]}</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed">{o.message}</p>
                {isOwner && req.status === "open" && o.status === "pending" && (
                  <button
                    type="button"
                    disabled={payStep != null}
                    onClick={() => void runAccept(o.id, o.pricePi)}
                    className="mt-3 rounded-full bg-[var(--gold)] px-5 py-2.5 font-display text-sm font-black text-[#3b1145] disabled:opacity-60"
                  >
                    {t.acceptOfferBtn}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!isOwner && req.status === "open" && (
            <div className="mt-4">
              {!session ? (
                <p className="text-sm text-[var(--dim)]">{t.loginToOffer}</p>
              ) : offerSent ? (
                <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  {t.offerSent}
                </p>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    const p = Number(price);
                    if (!Number.isFinite(p) || p <= 0) return setError(t.sellErrPrice);
                    const d = Number(days);
                    if (!Number.isInteger(d) || d < 1 || d > 180) return setError(t.sellErrDays);
                    if (message.trim().length < 5) return setError(t.briefError);
                    createOffer.mutate();
                  }}
                >
                  <p className="font-display font-bold">{t.offerFormTitle}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`offer-price-${req.id}`} className="mb-1 block text-sm font-semibold">
                        {t.offerPriceLabel}
                      </label>
                      <input
                        id={`offer-price-${req.id}`}
                        {...FIELDS.createOffer.pricePi}
                        type="number"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder={String(req.budgetPi)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                      />
                    </div>
                    <div>
                      <label htmlFor={`offer-days-${req.id}`} className="mb-1 block text-sm font-semibold">
                        {t.offerDaysLabel}
                      </label>
                      <input
                        id={`offer-days-${req.id}`}
                        {...FIELDS.createOffer.deliveryDays}
                        type="number"
                        inputMode="numeric"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`offer-msg-${req.id}`} className="mb-1 block text-sm font-semibold">
                      {t.offerMsgLabel}
                    </label>
                    <textarea
                      id={`offer-msg-${req.id}`}
                      {...FIELDS.createOffer.message}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      placeholder={t.offerMsgPlaceholder}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createOffer.isPending}
                    className="rounded-full bg-[var(--accent)] px-6 py-2.5 font-display font-bold text-white disabled:opacity-60 dark:bg-[var(--gold)] dark:text-[#3b1145]"
                  >
                    {t.sendOfferBtn}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {payStep != null && (
        <PaymentSheet
          amountPi={payAmount}
          step={payStep}
          result={payResult}
          onDone={onOrdered}
          doneLabel={t.goToOrder}
        />
      )}
    </article>
  );
}

type OrderFilter = "all" | "buying" | "selling";

function OrdersPanel({
  session,
  loginGateProps,
  onOpenProfile,
}: {
  session: PiSession | null;
  loginGateProps: LoginGateProps;
  onOpenProfile: (uid: string) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api.listOrders({ limit: 50 }),
  });

  const visibleOrders = (orders.data?.orders ?? []).filter((o) => {
    if (!session || filter === "all") return true;
    if (filter === "buying") return o.buyerPiUid === session.piUid;
    return o.sellerPiUid === session.piUid;
  });

  return (
    <section aria-label={t.nav.orders} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.ordersTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.ordersSubtitle}</p>
      {!session && (
        <div className="mt-4">
          <LoginGate actionLabel={t.actionOrders} {...loginGateProps} />
          <p className="mt-2 text-center text-sm text-[var(--dim)]">{t.ordersGuestNote}</p>
        </div>
      )}
      {session && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t.nav.orders}>
          {(
            [
              { key: "all", label: t.filterAll },
              { key: "buying", label: t.filterBuying(session.username) },
              { key: "selling", label: t.filterSelling(session.username) },
            ] as { key: OrderFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
                filter === f.key
                  ? "bg-[var(--gold)] text-[#3b1145]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {orders.isPending && <p className="py-8 text-center text-[var(--dim)]">{t.loadingOrders}</p>}
      {orders.error && <p className="py-8 text-center text-[var(--danger)]">{t.loadError}</p>}
      {orders.data && visibleOrders.length === 0 && (
        <div className="mt-6 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">
            {orders.data.orders.length === 0 ? t.emptyOrdersTitle : t.emptyOrdersFiltered}
          </p>
          <p className="mt-2 text-[var(--dim)]">
            {orders.data.orders.length === 0
              ? t.emptyOrdersBody
              : filter === "buying"
                ? t.emptyBuyingBody
                : t.emptySellingBody}
          </p>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {visibleOrders.map((order) => (
          <OrderCard key={order.id} order={order} session={session} onOpenProfile={onOpenProfile} />
        ))}
      </div>
    </section>
  );
}

function OrderChat({ order, session }: { order: Order; session: PiSession }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["messages", order.id],
    queryFn: () => api.listMessages({ auth: authOf(session), orderId: order.id }),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data, open]);

  const send = useMutation({
    mutationFn: async () =>
      await api.sendMessage({
        auth: authOf(session),
        orderId: order.id,
        body: draft.trim(),
      }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", order.id] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.actionErrGeneric),
  });

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
      >
        💬 {t.chatToggle(order.messageCount)}
      </button>
      {open && (
        <div className="mt-3">
          <div
            ref={scrollRef}
            className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-[var(--surface-alt)] p-3"
            aria-label={t.chatTitle}
          >
            {messages.isPending && <p className="text-sm text-[var(--dim)]">{t.chatLoading}</p>}
            {messages.error && (
              <p className="text-sm font-semibold text-[var(--danger)]">{t.chatPartyOnly}</p>
            )}
            {messages.data && messages.data.messages.length === 0 && (
              <p className="text-sm text-[var(--dim)]">{t.chatEmpty}</p>
            )}
            {messages.data?.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.mine
                    ? "self-end bg-[var(--accent)] text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
                    : "self-start border border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <p className="text-[11px] font-bold opacity-80">
                  {m.mine ? `@${m.senderName}` : `@${m.senderName}`} · {fmtTime(m.createdAt, lang)}
                </p>
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-2 font-semibold text-[var(--danger)]">
              {error}
            </p>
          )}
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              setError(null);
              send.mutate();
            }}
          >
            <label className="sr-only" htmlFor={`chat-input-${order.id}`}>
              {t.chatTitle}
            </label>
            <input
              id={`chat-input-${order.id}`}
              {...FIELDS.sendMessage.body}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.chatPlaceholder}
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
            />
            <button
              type="submit"
              disabled={send.isPending || !draft.trim()}
              className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-2.5 font-display font-black text-[#3b1145] disabled:opacity-60"
            >
              {t.chatSend}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  session,
  onOpenProfile,
}: {
  order: Order;
  session: PiSession | null;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const uid = session?.piUid ?? null;
  const isBuyer = !!uid && (order.buyerPiUid == null || order.buyerPiUid === uid);
  const isSeller = !!uid && (order.sellerPiUid == null || order.sellerPiUid === uid);
  const isLegacy = order.buyerPiUid == null && order.sellerPiUid == null;
  const canChat =
    !!session &&
    order.status !== "cancelled" &&
    (order.buyerPiUid === uid || order.sellerPiUid === uid || isLegacy);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [showDeliver, setShowDeliver] = useState(false);
  // The seller cannot confirm delivery without a payout wallet on file
  // (the server enforces it too); share the Wallet tab's cached query.
  const wallet = useQuery({
    queryKey: ["wallet", session?.piUid ?? ""],
    queryFn: () => api.getWallet({ auth: authOf(session!) }),
    enabled: !!session && isSeller,
  });
  const walletKnown = !wallet.isPending;
  const hasWallet = !!wallet.data?.walletAddress;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["gigs"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    if (order.gigId != null)
      void queryClient.invalidateQueries({ queryKey: ["reviews", order.gigId] });
  };
  const onErr = (err: unknown) =>
    setError(err instanceof Error && err.message ? err.message : t.actionErrGeneric);
  const needSession = (): PiSession => {
    if (!session) throw new Error(t.needLogin);
    return session;
  };

  const deliver = useMutation({
    mutationFn: async () =>
      await api.deliverOrder({
        auth: authOf(needSession()),
        orderId: order.id,
        deliveryNote: deliveryNote.trim(),
      }),
    onSuccess: invalidate,
    onError: onErr,
  });
  const approve = useMutation({
    mutationFn: async () =>
      await api.approveOrder({ auth: authOf(needSession()), orderId: order.id }),
    onSuccess: invalidate,
    onError: onErr,
  });
  const cancel = useMutation({
    mutationFn: async () =>
      await api.cancelOrder({ auth: authOf(needSession()), orderId: order.id }),
    onSuccess: invalidate,
    onError: onErr,
  });
  const retryPayout = useMutation({
    mutationFn: async () =>
      await api.retryPayout({ auth: authOf(needSession()), orderId: order.id }),
    onSuccess: invalidate,
    onError: onErr,
  });
  const review = useMutation({
    mutationFn: async () =>
      await api.addReview({
        auth: authOf(needSession()),
        orderId: order.id,
        rating,
        comment: comment.trim(),
      }),
    onSuccess: invalidate,
    onError: onErr,
  });

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold leading-snug">{order.gigTitle}</h3>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            {t.clientLabel}: {order.buyerPiUid ? `@${order.buyerName}` : order.buyerName} ·{" "}
            {t.freelancerLabel}:{" "}
            {order.sellerPiUid ? (
              <button
                type="button"
                onClick={() => onOpenProfile(order.sellerPiUid!)}
                className="font-semibold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
              >
                @{order.sellerName}
              </button>
            ) : (
              order.sellerName
            )}{" "}
            · {fmtDate(order.createdAt, lang)}
            {order.source === "job_request" && ` · ${t.fromJobRequest}`}
            {isLegacy && ` · ${t.legacyOrder}`}
          </p>
          {session && !isLegacy && (
            <p className="mt-1 text-xs font-semibold">
              {isBuyer && isSeller
                ? t.roleBoth
                : isBuyer
                  ? t.roleBuyer
                  : isSeller
                    ? t.roleSeller
                    : t.roleOutsider}
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_CLASS[order.status]}`}
        >
          {t.status[order.status]}
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm leading-relaxed">
        <strong>{t.briefShownLabel}</strong> {order.brief}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.paidInEscrow}</span>
          <strong className="font-display text-base">{fmtPi(order.amountPi)}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.commissionLine}</span>
          <strong className="font-display text-base">{fmtPi(order.commissionPi)}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.netFreelancer}</span>
          <strong className="font-display text-base">{fmtPi(order.sellerNetPi)}</strong>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--dim)]">
        {t.paymentRefLabel}{" "}
        <span dir="ltr" className="font-mono">{order.paymentRef}</span>
      </p>

      {order.status === "completed" && order.payoutStatus && (
        <div className="mt-2 text-xs">
          <p>
            <span className="text-[var(--dim)]">{t.payoutLabel} </span>
            <span
              className={`rounded-full px-2.5 py-1 font-bold ${
                order.payoutStatus === "completed"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : order.payoutStatus === "failed"
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    : "bg-[var(--gold-soft)] text-[#8a5d00] dark:text-[var(--gold)]"
              }`}
            >
              {t.payoutStatus[order.payoutStatus]}
            </span>
          </p>
          {order.payoutError && (
            <p className="mt-1.5 leading-relaxed text-[var(--dim)]">{order.payoutError}</p>
          )}
          {session &&
            (isBuyer || isSeller) &&
            (order.payoutStatus === "failed" || order.payoutStatus === "pending") && (
              <button
                type="button"
                disabled={retryPayout.isPending}
                onClick={() => {
                  setError(null);
                  retryPayout.mutate();
                }}
                className="mt-2 rounded-full border border-[var(--gold)] px-4 py-2 font-display text-xs font-black text-[#8a5d00] disabled:opacity-60 dark:text-[var(--gold)]"
              >
                {t.retryPayoutBtn}
              </button>
            )}
        </div>
      )}

      {order.deliveryNote && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed dark:bg-emerald-950">
          <strong>{t.deliveryNoteShown}</strong> {order.deliveryNote}
          {order.deliveredAt && (
            <span className="text-[var(--dim)]"> · {fmtDate(order.deliveredAt, lang)}</span>
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {order.status === "awaiting_delivery" && (
        <div className="mt-4">
          {!session ? (
            <p className="text-sm text-[var(--dim)]">{t.loginToAct}</p>
          ) : isSeller && !isBuyer && walletKnown && !hasWallet ? (
            <p className="text-sm font-bold text-red-600">{t.deliverNeedsWallet}</p>
          ) : showDeliver && isSeller ? (
            <div className="space-y-2">
              <label htmlFor={`deliver-note-${order.id}`} className="block font-semibold">
                {t.deliverNoteLabel}
              </label>
              <textarea
                id={`deliver-note-${order.id}`}
                {...FIELDS.deliverOrder.deliveryNote}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={2}
                placeholder={t.deliverNotePlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deliver.isPending || !deliveryNote.trim()}
                  onClick={() => {
                    setError(null);
                    deliver.mutate();
                  }}
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white disabled:opacity-60 dark:bg-[var(--gold)] dark:text-[#3b1145]"
                >
                  {t.confirmDelivery}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeliver(false)}
                  className="rounded-full border border-[var(--border)] px-5 py-2.5 font-display font-bold"
                >
                  {t.back}
                </button>
              </div>
            </div>
          ) : !isSeller && !isBuyer ? (
            <p className="text-sm text-[var(--dim)]">{t.waitingSeller}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {isSeller && (
                <button
                  type="button"
                  onClick={() => setShowDeliver(true)}
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
                >
                  {t.deliverBtn}
                </button>
              )}
              {isBuyer && (
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={() => {
                    setError(null);
                    cancel.mutate();
                  }}
                  className="rounded-full border border-[var(--danger)] px-5 py-2.5 font-display font-bold text-[var(--danger)] disabled:opacity-60"
                >
                  {t.cancelBtn}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {order.status === "delivered" && (
        <div className="mt-4">
          {isBuyer ? (
            <button
              type="button"
              disabled={approve.isPending}
              onClick={() => {
                setError(null);
                approve.mutate();
              }}
              className="rounded-full bg-[var(--success)] px-6 py-3 font-display text-base font-bold text-white disabled:opacity-60"
            >
              {t.approveBtn(fmtPi(order.sellerNetPi))}
            </button>
          ) : (
            <p className="text-sm text-[var(--dim)]">
              {session ? t.deliveredWaiting : t.deliveredWaitingGuest}
            </p>
          )}
        </div>
      )}

      {order.status === "completed" &&
        (order.hasReview ? (
          <p className="mt-4 font-semibold text-[var(--success)]">{t.reviewedDone}</p>
        ) : !isBuyer ? (
          <p className="mt-4 text-sm text-[var(--dim)]">{t.reviewByBuyerOnly}</p>
        ) : (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) {
                setError(t.reviewCommentError);
                return;
              }
              setError(null);
              review.mutate();
            }}
          >
            <p className="font-semibold">{t.reviewTitle}</p>
            <div className="flex gap-1" role="radiogroup" aria-label={t.starsLabel}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={t.starLabel(n)}
                  onClick={() => setRating(n)}
                  className={`px-1 text-3xl leading-none ${
                    n <= rating ? "text-[var(--gold)]" : "text-[var(--border)]"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor={`review-comment-${order.id}`}>
              {t.reviewCommentLabel}
            </label>
            <textarea
              id={`review-comment-${order.id}`}
              {...FIELDS.addReview.comment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder={t.reviewPlaceholder}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
            />
            <button
              type="submit"
              disabled={review.isPending}
              className="rounded-full bg-[var(--gold)] px-6 py-2.5 font-display font-bold text-[#3b1145] disabled:opacity-60"
            >
              {t.publishReview}
            </button>
          </form>
        ))}

      {canChat && session && <OrderChat order={order} session={session} />}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Wallet & earnings dashboard                                         */
/* ------------------------------------------------------------------ */

function WalletPanel({
  session,
  loginGateProps,
}: {
  session: PiSession | null;
  loginGateProps: LoginGateProps;
}) {
  const { t } = useI18n();
  const wallet = useQuery({
    queryKey: ["wallet", session?.piUid ?? ""],
    queryFn: () => api.getWallet({ auth: authOf(session!) }),
    enabled: !!session,
  });
  const w = wallet.data;
  const queryClient = useQueryClient();
  const [addr, setAddr] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const saveAddress = useMutation({
    mutationFn: async () =>
      await api.setWalletAddress({ auth: authOf(session!), walletAddress: addr.trim() }),
    onSuccess: () => {
      setSaveMsg(t.payoutWalletSaved);
      setAddr("");
      void queryClient.invalidateQueries({ queryKey: ["wallet", session?.piUid ?? ""] });
    },
    onError: (err: unknown) =>
      setSaveMsg(err instanceof Error && err.message ? err.message : t.actionErrGeneric),
  });

  return (
    <section aria-label={t.nav.wallet} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.walletTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.walletSubtitle}</p>

      {!session ? (
        <div className="mt-4">
          <LoginGate actionLabel={t.actionWallet} {...loginGateProps} />
        </div>
      ) : wallet.isPending ? (
        <p className="py-8 text-center text-[var(--dim)]">{t.loadingWallet}</p>
      ) : wallet.error || !w ? (
        <p className="py-8 text-center text-[var(--danger)]">{t.loadError}</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-lg font-black">{t.asFreelancer}</h3>
            <p className="mt-4">
              <span className="block text-sm text-[var(--dim)]">{t.earnedReleased}</span>
              <span className="font-display text-4xl font-black text-[var(--success)]">
                {fmtPi(w.earnedPi)}
              </span>
            </p>
            <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.commissionDeducted}</dt>
                <dd className="font-bold">{fmtPi(w.commissionPaidPi)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.pendingEscrowNet}</dt>
                <dd className="font-bold">{fmtPi(w.pendingNetPi)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.payoutPendingWallet}</dt>
                <dd className="font-bold">{fmtPi(w.payoutPendingPi)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.pendingCountLabel}</dt>
                <dd className="font-bold">{w.soldPending}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.completedCountLabel}</dt>
                <dd className="font-bold">{w.soldCompleted}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-[var(--dim)]">
              {t.pendingEscrowGross(fmtPi(w.pendingGrossPi))}
            </p>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="font-display text-lg font-black">{t.asClient}</h3>
            <p className="mt-4">
              <span className="block text-sm text-[var(--dim)]">{t.spentTotal}</span>
              <span className="font-display text-4xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
                {fmtPi(w.spentPi)}
              </span>
            </p>
            <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.inEscrowNow}</dt>
                <dd className="font-bold">{fmtPi(w.escrowPi)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.boughtPendingLabel}</dt>
                <dd className="font-bold">{w.boughtPending}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--dim)]">{t.boughtCompletedLabel}</dt>
                <dd className="font-bold">{w.boughtCompleted}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:col-span-2">
            <h3 className="font-display text-lg font-black">{t.payoutWalletTitle}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">{t.payoutWalletHint}</p>
            {w.walletAddress ? (
              <p
                className="mt-3 break-all rounded-xl bg-white/5 px-3 py-2 font-mono text-xs"
                dir="ltr"
              >
                {w.walletAddress}
              </p>
            ) : (
              <p className="mt-3 text-sm font-bold text-red-600">{t.payoutWalletMissing}</p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={addr}
                onChange={(e) => {
                  setAddr(e.target.value);
                  setSaveMsg(null);
                }}
                placeholder={t.payoutWalletPlaceholder}
                dir="ltr"
                className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-4 py-2 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => saveAddress.mutate()}
                disabled={saveAddress.isPending || !addr.trim()}
                className="rounded-full bg-[var(--gold)] px-4 py-2 font-display text-sm font-black text-[#3b1145] disabled:opacity-60"
              >
                {t.payoutWalletSave}
              </button>
            </div>
            {saveMsg && (
              <p
                className={`mt-2 text-sm font-bold ${
                  saveAddress.isError ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {saveMsg}
              </p>
            )}
          </div>

          <p className="text-sm leading-relaxed text-[var(--dim)] sm:col-span-2">{t.walletNote}</p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Freelancer profile + portfolio                                      */
/* ------------------------------------------------------------------ */

type CityKey = NonNullable<Profile["city"]>;

const CITIES: { key: CityKey; ar: string; en: string; lat: number; lng: number }[] = [
  { key: "cairo", ar: "القاهرة", en: "Cairo", lat: 30.0444, lng: 31.2357 },
  { key: "giza", ar: "الجيزة", en: "Giza", lat: 30.0131, lng: 31.2089 },
  { key: "alexandria", ar: "الإسكندرية", en: "Alexandria", lat: 31.2001, lng: 29.9187 },
  { key: "mansoura", ar: "المنصورة", en: "Mansoura", lat: 31.0409, lng: 31.3785 },
  { key: "tanta", ar: "طنطا", en: "Tanta", lat: 30.7865, lng: 31.0004 },
  { key: "zagazig", ar: "الزقازيق", en: "Zagazig", lat: 30.5877, lng: 31.502 },
  { key: "ismailia", ar: "الإسماعيلية", en: "Ismailia", lat: 30.5965, lng: 32.2715 },
  { key: "portsaid", ar: "بورسعيد", en: "Port Said", lat: 31.2653, lng: 32.3019 },
  { key: "suez", ar: "السويس", en: "Suez", lat: 29.9668, lng: 32.5498 },
  { key: "faiyum", ar: "الفيوم", en: "Faiyum", lat: 29.3084, lng: 30.8428 },
  { key: "benisuef", ar: "بني سويف", en: "Beni Suef", lat: 29.0661, lng: 31.0994 },
  { key: "minya", ar: "المنيا", en: "Minya", lat: 28.1099, lng: 30.7503 },
  { key: "asyut", ar: "أسيوط", en: "Asyut", lat: 27.1809, lng: 31.1837 },
  { key: "sohag", ar: "سوهاج", en: "Sohag", lat: 26.557, lng: 31.6948 },
  { key: "qena", ar: "قنا", en: "Qena", lat: 26.1551, lng: 32.716 },
  { key: "luxor", ar: "الأقصر", en: "Luxor", lat: 25.6872, lng: 32.6396 },
  { key: "aswan", ar: "أسوان", en: "Aswan", lat: 24.0889, lng: 32.8998 },
  { key: "hurghada", ar: "الغردقة", en: "Hurghada", lat: 27.2579, lng: 33.8116 },
  { key: "sharm", ar: "شرم الشيخ", en: "Sharm El Sheikh", lat: 27.9158, lng: 34.331 },
  { key: "damietta", ar: "دمياط", en: "Damietta", lat: 31.4175, lng: 31.8144 },
  { key: "riyadh", ar: "الرياض", en: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { key: "jeddah", ar: "جدة", en: "Jeddah", lat: 21.4858, lng: 39.1925 },
  { key: "mecca", ar: "مكة المكرمة", en: "Mecca", lat: 21.3891, lng: 39.8579 },
  { key: "medina", ar: "المدينة المنورة", en: "Medina", lat: 24.5247, lng: 39.5692 },
  { key: "dammam", ar: "الدمام", en: "Dammam", lat: 26.4207, lng: 50.0888 },
  { key: "dubai", ar: "دبي", en: "Dubai", lat: 25.2048, lng: 55.2708 },
  { key: "abudhabi", ar: "أبوظبي", en: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
  { key: "sharjah", ar: "الشارقة", en: "Sharjah", lat: 25.3463, lng: 55.4209 },
  { key: "doha", ar: "الدوحة", en: "Doha", lat: 25.2854, lng: 51.531 },
  { key: "kuwait", ar: "مدينة الكويت", en: "Kuwait City", lat: 29.3759, lng: 47.9774 },
  { key: "manama", ar: "المنامة", en: "Manama", lat: 26.2285, lng: 50.586 },
  { key: "muscat", ar: "مسقط", en: "Muscat", lat: 23.588, lng: 58.3829 },
  { key: "amman", ar: "عمّان", en: "Amman", lat: 31.9454, lng: 35.9284 },
  { key: "irbid", ar: "إربد", en: "Irbid", lat: 32.5568, lng: 35.8469 },
  { key: "beirut", ar: "بيروت", en: "Beirut", lat: 33.8938, lng: 35.5018 },
  { key: "damascus", ar: "دمشق", en: "Damascus", lat: 33.5138, lng: 36.2765 },
  { key: "aleppo", ar: "حلب", en: "Aleppo", lat: 36.2021, lng: 37.1343 },
  { key: "baghdad", ar: "بغداد", en: "Baghdad", lat: 33.3152, lng: 44.3661 },
  { key: "basra", ar: "البصرة", en: "Basra", lat: 30.5085, lng: 47.7804 },
  { key: "erbil", ar: "أربيل", en: "Erbil", lat: 36.1901, lng: 44.0094 },
  { key: "ramallah", ar: "رام الله", en: "Ramallah", lat: 31.9038, lng: 35.2034 },
  { key: "gaza", ar: "غزة", en: "Gaza City", lat: 31.5017, lng: 34.4668 },
  { key: "tunis", ar: "تونس", en: "Tunis", lat: 36.8065, lng: 10.1815 },
  { key: "algiers", ar: "الجزائر", en: "Algiers", lat: 36.7538, lng: 3.0588 },
  { key: "oran", ar: "وهران", en: "Oran", lat: 35.6969, lng: -0.6331 },
  { key: "casablanca", ar: "الدار البيضاء", en: "Casablanca", lat: 33.5731, lng: -7.5898 },
  { key: "rabat", ar: "الرباط", en: "Rabat", lat: 34.0209, lng: -6.8416 },
  { key: "marrakech", ar: "مراكش", en: "Marrakech", lat: 31.6295, lng: -7.9811 },
  { key: "tripoli", ar: "طرابلس", en: "Tripoli", lat: 32.8966, lng: 13.13 },
  { key: "khartoum", ar: "الخرطوم", en: "Khartoum", lat: 15.5007, lng: 32.5599 },
  { key: "sanaa", ar: "صنعاء", en: "Sana'a", lat: 15.3694, lng: 44.191 },
  { key: "aden", ar: "عدن", en: "Aden", lat: 12.7855, lng: 45.0187 },
  { key: "nouakchott", ar: "نواكشوط", en: "Nouakchott", lat: 18.0858, lng: -15.9785 },
];

const CITY_BY_KEY = new Map(CITIES.map((c) => [c.key, c]));

function cityName(key: CityKey, lang: Lang): string {
  const c = CITY_BY_KEY.get(key);
  return c ? (lang === "ar" ? c.ar : c.en) : key;
}

function FreelancerProfile({
  piUid,
  session,
  loginGateProps,
  onBack,
  onOpenGig,
}: {
  piUid: string;
  session: PiSession | null;
  loginGateProps: LoginGateProps;
  onBack: () => void;
  onOpenGig: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["profile", piUid],
    queryFn: () => api.getFreelancerProfile({ piUid }),
  });
  const p = profileQ.data;
  const isOwn = !!session && session.piUid === piUid;

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      if (!session) throw new Error(t.needLogin);
      return await api.deletePortfolioItem({ auth: authOf(session), id });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile", piUid] }),
  });

  return (
    <section aria-label={t.viewProfile} className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="font-display text-base font-bold text-[var(--accent)] dark:text-[var(--gold)]"
      >
        {t.profileBack}
      </button>

      {profileQ.isPending && <p className="py-10 text-center text-[var(--dim)]">{t.loadingGigs}</p>}
      {profileQ.error && <p className="py-10 text-center text-[var(--danger)]">{t.loadError}</p>}
      {p && !p.found && (
        <p className="py-10 text-center text-[var(--dim)]">{t.profileNotFound}</p>
      )}

      {p && p.found && (
        <>
          <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-display text-2xl font-black text-[var(--gold)] dark:bg-[var(--gold)] dark:text-[#3b1145]">
                {(p.username ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-black">@{p.username}</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.verifiedBadge && (
                    <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[11px] font-black text-[#3b1145]">
                      ✓ {t.verifiedBadge}
                    </span>
                  )}
                  {p.piVerified && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {t.piVerifiedBadge}
                    </span>
                  )}
                  {p.city && (
                    <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-bold">
                      {t.cityInProfile(cityName(p.city, lang))}
                    </span>
                  )}
                  {p.joinedAt && (
                    <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-bold">
                      {t.joinedOn(fmtDate(p.joinedAt, lang))}
                    </span>
                  )}
                </div>
                {p.verifiedBadge && (
                  <p className="mt-1 text-xs text-[var(--dim)]">
                    {t.verifiedBadgeHint(p.completedCount)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[var(--surface-alt)] py-3">
                <span className="block font-display text-xl font-black">{p.completedCount}</span>
                <span className="text-xs text-[var(--dim)]">{t.completedOrders}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-alt)] py-3">
                <span className="block font-display text-xl font-black">{p.totalOrderCount}</span>
                <span className="text-xs text-[var(--dim)]">{t.totalOrders}</span>
              </div>
              <div className="rounded-xl bg-[var(--surface-alt)] py-3">
                <span className="block font-display text-xl font-black">
                  {p.avgRating != null ? p.avgRating : "—"}
                </span>
                <span className="text-xs text-[var(--dim)]">
                  {p.avgRating != null ? (
                    <>
                      <Stars value={p.avgRating} size="text-xs" /> ({p.reviewCount})
                    </>
                  ) : (
                    t.reviewsTitle
                  )}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="font-display font-black">{t.bioTitle}</h3>
              <p className="mt-1 whitespace-pre-line leading-relaxed text-[var(--dim)]">
                {p.bio ?? t.noBio}
              </p>
            </div>

            {isOwn && session && (
              <ProfileEditor
                key={`${piUid}-${p.bio ?? ""}-${p.city ?? ""}`}
                session={session}
                initialBio={p.bio ?? ""}
                initialCity={p.city}
                piUid={piUid}
              />
            )}
            {!session && (
              <div className="mt-4">
                <LoginGate actionLabel={t.viewProfile} {...loginGateProps} />
              </div>
            )}
          </div>

          <h3 className="mt-6 font-display text-xl font-black">{t.portfolioTitle}</h3>
          {p.portfolio.length === 0 ? (
            <p className="mt-2 text-[var(--dim)]">{t.portfolioEmpty}</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {p.portfolio.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  {item.category && (
                    <img
                      src={CAT_IMG[item.category]}
                      alt={t.catImgAlt(t.cat[item.category])}
                      className="mb-3 h-28 w-full rounded-xl object-cover"
                    />
                  )}
                  <h4 className="font-display font-bold leading-snug">{item.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                    {item.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {item.category && (
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold">
                        {t.cat[item.category]}
                      </span>
                    )}
                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener"
                        className="rounded-full bg-[var(--gold)] px-3.5 py-1.5 font-display text-sm font-bold text-[#3b1145]"
                      >
                        {t.visitWork}
                      </a>
                    )}
                    {isOwn && (
                      <button
                        type="button"
                        disabled={deleteItem.isPending}
                        onClick={() => deleteItem.mutate(item.id)}
                        className="rounded-full border border-[var(--danger)] px-3.5 py-1.5 font-display text-sm font-bold text-[var(--danger)] disabled:opacity-60"
                      >
                        {t.deleteWork}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {isOwn && session && <PortfolioAddForm session={session} piUid={piUid} />}

          <h3 className="mt-6 font-display text-xl font-black">{t.profileGigsTitle}</h3>
          {p.gigs.length === 0 ? (
            <p className="mt-2 text-[var(--dim)]">{t.profileNoGigs}</p>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {p.gigs.map((g) => (
                <GigCard key={g.id} gig={g} onOpen={onOpenGig} />
              ))}
            </div>
          )}

          <h3 className="mt-6 font-display text-xl font-black">{t.profileReviewsTitle}</h3>
          {p.reviews.length === 0 ? (
            <p className="mt-2 text-[var(--dim)]">{t.noReviews}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {p.reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <strong>{r.buyerPiUid ? `@${r.buyerName}` : r.buyerName}</strong>
                    <Stars value={r.rating} size="text-sm" />
                    <span className="text-xs text-[var(--dim)]">
                      {fmtDate(r.createdAt, lang)}
                    </span>
                  </p>
                  <p className="mt-1 leading-relaxed">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ProfileEditor({
  session,
  initialBio,
  initialCity,
  piUid,
}: {
  session: PiSession;
  initialBio: string;
  initialCity: CityKey | null;
  piUid: string;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(initialBio);
  const [city, setCity] = useState<CityKey | "">(initialCity ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: async () =>
      await api.updateProfile({
        auth: authOf(session),
        bio: bio.trim(),
        city: city === "" ? null : city,
      }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["profile", piUid] });
      void queryClient.invalidateQueries({ queryKey: ["mapGigs"] });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.actionErrGeneric),
  });

  return (
    <form
      className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        setError(null);
        update.mutate();
      }}
    >
      <div>
        <label htmlFor="profile-bio" className="mb-1 block font-semibold">
          {t.bioLabel}
        </label>
        <textarea
          id="profile-bio"
          {...FIELDS.updateProfile.bio}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder={t.bioPlaceholder}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
        />
      </div>
      <div>
        <label htmlFor="profile-city" className="mb-1 block font-semibold">
          {t.cityLabel}
        </label>
        <select
          id="profile-city"
          value={city}
          onChange={(e) => setCity(e.target.value as CityKey | "")}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
        >
          <option value="">{t.cityNone}</option>
          {CITIES.map((c) => (
            <option key={c.key} value={c.key}>
              {lang === "ar" ? c.ar : c.en}
            </option>
          ))}
        </select>
      </div>
      {saved && <p className="font-semibold text-[var(--success)]">{t.profileSaved}</p>}
      {error && (
        <p role="alert" className="font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={update.isPending}
        className="rounded-full bg-[var(--gold)] px-6 py-2.5 font-display font-black text-[#3b1145] disabled:opacity-60"
      >
        {t.saveProfile}
      </button>
    </form>
  );
}

function PortfolioAddForm({ session, piUid }: { session: PiSession; piUid: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () =>
      await api.addPortfolioItem({
        auth: authOf(session),
        title: title.trim(),
        description: description.trim(),
        linkUrl: linkUrl.trim(),
        category: category === "" ? null : category,
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setLinkUrl("");
      setCategory("");
      void queryClient.invalidateQueries({ queryKey: ["profile", piUid] });
    },
    onError: (err) =>
      setError(err instanceof Error && err.message ? err.message : t.actionErrGeneric),
  });

  return (
    <form
      className="mt-4 space-y-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (title.trim().length < 2) return setError(t.sellErrTitle);
        if (description.trim().length < 5) return setError(t.sellErrDesc);
        add.mutate();
      }}
    >
      <h4 className="font-display font-black">{t.addWorkTitle}</h4>
      <div>
        <label htmlFor="work-title" className="mb-1 block font-semibold">
          {t.workTitleLabel}
        </label>
        <input
          id="work-title"
          {...FIELDS.addPortfolioItem.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
        />
      </div>
      <div>
        <label htmlFor="work-desc" className="mb-1 block font-semibold">
          {t.workDescLabel}
        </label>
        <textarea
          id="work-desc"
          {...FIELDS.addPortfolioItem.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="work-link" className="mb-1 block font-semibold">
            {t.workLinkLabel}
          </label>
          <input
            id="work-link"
            {...FIELDS.addPortfolioItem.linkUrl}
            type="url"
            dir="ltr"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="work-cat" className="mb-1 block font-semibold">
            {t.workCategoryLabel}
          </label>
          <select
            id="work-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "")}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
          >
            <option value="">{t.workCategoryNone}</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {t.cat[c.key]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={add.isPending}
        className="rounded-full bg-[var(--accent)] px-6 py-2.5 font-display font-bold text-white disabled:opacity-60 dark:bg-[var(--gold)] dark:text-[#3b1145]"
      >
        {t.addWorkBtn}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Explore: interactive 3D globe (primary) + flat map, gigs pinned at  */
/* the cities freelancers picked                                       */
/* ------------------------------------------------------------------ */

type ExploreView = "globe" | "flat";

function MapPanel({
  onOpenGig,
  onOpenProfile,
}: {
  onOpenGig: (id: number) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category | null>(null);
  const [view, setView] = useState<ExploreView>("globe");
  const [mapFailed, setMapFailed] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  const mapQ = useQuery({
    queryKey: ["mapGigs"],
    queryFn: () => api.listMapGigs({}),
  });

  const all = mapQ.data?.places ?? [];
  const filtered = cat ? all.filter((p) => p.category === cat) : all;

  // Small deterministic spread so gigs sharing one city don't stack exactly.
  const placed = filtered.map((p, i) => {
    const city = CITY_BY_KEY.get(p.city);
    const sameCityIndex = filtered.slice(0, i).filter((x) => x.city === p.city).length;
    const latOff = sameCityIndex === 0 ? 0 : ((sameCityIndex % 3) - 1) * 0.045;
    const lngOff =
      sameCityIndex === 0 ? 0 : (Math.floor(sameCityIndex / 3) % 3 - 1) * 0.045 + 0.02;
    return {
      place: p,
      lat: (city?.lat ?? 0) + latOff,
      lng: (city?.lng ?? 0) + lngOff,
    };
  });
  const signature = placed.map((x) => x.place.gigId).join(",");

  const selectPlace = (index: number, scroll: boolean) => {
    setSelected(index);
    if (scroll) {
      rowRefs.current[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  // Flat (2D) map: only mounted while the flat view is showing.
  useEffect(() => {
    if (view !== "flat" || mapFailed || placed.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        await import("./assets/hatch-maps.js");
        const helpers = await import("./map_helpers.mjs");
        if (cancelled || !containerRef.current) return;
        const rows = rowRefs.current.filter((r): r is HTMLElement => r != null);
        if (rows.length !== placed.length) return;
        helpers.mountPlaceListMap(
          containerRef.current,
          {
            places: placed.map((x) => ({
              label: x.place.title,
              lat: x.lat,
              lng: x.lng,
              locality: cityName(x.place.city, lang),
            })),
            rows,
            baseStyle: "light",
          },
          () => setMapFailed(true),
        );
      } catch {
        if (!cancelled) setMapFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mapFailed, lang, view]);

  return (
    <section aria-label={t.nav.map} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.mapTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.mapSubtitle}</p>

      <div
        className="mt-4 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        role="group"
        aria-label={t.mapViewLabel}
      >
        <button
          type="button"
          aria-pressed={view === "globe"}
          onClick={() => setView("globe")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            view === "globe"
              ? "bg-[var(--gold)] text-[#3b1145]"
              : "text-[var(--dim)]"
          }`}
        >
          {t.mapViewGlobe}
        </button>
        <button
          type="button"
          aria-pressed={view === "flat"}
          onClick={() => setView("flat")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            view === "flat"
              ? "bg-[var(--gold)] text-[#3b1145]"
              : "text-[var(--dim)]"
          }`}
        >
          {t.mapViewFlat}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.gigCategoryLabel}>
        <button
          type="button"
          aria-pressed={cat === null}
          onClick={() => {
            setCat(null);
            setSelected(null);
          }}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            cat === null
              ? "bg-[var(--gold)] text-[#3b1145]"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
          }`}
        >
          {t.mapAllCats}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={cat === c.key}
            onClick={() => {
              setCat(cat === c.key ? null : c.key);
              setSelected(null);
            }}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
              cat === c.key
                ? "bg-[var(--gold)] text-[#3b1145]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
            }`}
          >
            {t.cat[c.key]}
          </button>
        ))}
      </div>

      {mapQ.isPending && <p className="py-8 text-center text-[var(--dim)]">{t.mapLoading}</p>}
      {mapQ.error && <p className="py-8 text-center text-[var(--danger)]">{t.loadError}</p>}

      {mapQ.data && view === "globe" && (
        <div className="mt-4">
          {!globeFailed ? (
            <>
              <GlobeView
                places={placed.map((x) => ({ gigId: x.place.gigId, lat: x.lat, lng: x.lng }))}
                selected={selected}
                onSelect={(i) => selectPlace(i, true)}
                onFail={() => setGlobeFailed(true)}
                ariaLabel={t.globeAria}
              />
              <p className="mt-2 text-center text-sm text-[var(--dim)]">{t.globeHint}</p>
            </>
          ) : (
            <p className="rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm font-semibold">
              {t.globeUnavailable}
            </p>
          )}
        </div>
      )}

      {mapQ.data && all.length === 0 && (
        <div className="mt-6 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">{t.mapEmptyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--dim)]">{t.mapEmptyBody}</p>
        </div>
      )}

      {mapQ.data && all.length > 0 && filtered.length === 0 && (
        <p className="py-8 text-center text-[var(--dim)]">{t.mapFilteredEmpty}</p>
      )}

      {placed.length > 0 && (
        <>
          {view === "flat" &&
            (!mapFailed ? (
              <div
                key={signature}
                ref={containerRef}
                className="mt-4 h-[380px] w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] sm:h-[440px]"
                aria-label={t.mapTitle}
              />
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm font-semibold">
                {t.mapUnavailable}
              </p>
            ))}
          <div className="mt-4 space-y-3">
            {placed.map((x, i) => (
              <article
                key={x.place.gigId}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => selectPlace(i, false)}
                className={`cursor-pointer rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 ${
                  selected === i ? "map-selected" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold leading-snug">
                      <span className="me-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] align-middle font-display text-xs font-black text-white dark:bg-[var(--gold)] dark:text-[#3b1145]">
                        {i + 1}
                      </span>
                      {x.place.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile(x.place.sellerPiUid);
                        }}
                        className="font-semibold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
                      >
                        @{x.place.sellerName}
                      </button>{" "}
                      · {t.cat[x.place.category]} · {t.cityInProfile(cityName(x.place.city, lang))}
                      {x.place.avgRating != null && (
                        <>
                          {" · "}
                          <Stars value={x.place.avgRating} size="text-xs" /> ({x.place.reviewCount})
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-end">
                    <span className="font-display text-xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
                      {fmtPi(x.place.pricePi)}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {t.deliveryIn(x.place.deliveryDays)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGig(x.place.gigId);
                  }}
                  className="mt-3 rounded-full bg-[var(--gold)] px-5 py-2 font-display text-sm font-black text-[#3b1145]"
                >
                  {t.orderNow}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Demo preview mode ("جرّب النسخة التجريبية"): a complete sample      */
/* marketplace that lives ONLY in client state. No demo component      */
/* calls the server, so entering, using or leaving the demo can never  */
/* read or write real gigs, orders or reviews.                         */
/* ------------------------------------------------------------------ */

type DemoText = { ar: string; en: string };

const tx = (v: DemoText, lang: Lang): string => (lang === "ar" ? v.ar : v.en);

/** The visitor's demo persona: they act as both a client and a freelancer. */
const DEMO_ME = { piUid: "demo-you", username: "demo_pioneer" };

type DemoReview = {
  id: number;
  buyerName: string;
  rating: number;
  comment: DemoText;
  createdAt: string;
};

type DemoFreelancer = {
  uid: string;
  username: string;
  bio: DemoText;
  city: CityKey;
  joinedAt: string;
  piVerified: boolean;
  completedCount: number;
  totalOrderCount: number;
  portfolio: {
    id: number;
    title: DemoText;
    description: DemoText;
    category: Category | null;
  }[];
};

type DemoGig = {
  id: number;
  sellerUid: string;
  title: DemoText;
  description: DemoText;
  category: Category;
  pricePi: number;
  deliveryDays: number;
  createdAt: string;
  orderCount: number;
};

const DEMO_FREELANCERS: DemoFreelancer[] = [
  {
    uid: "demo-u-sara",
    username: "sara.designs",
    bio: {
      ar: "مصممة جرافيك من القاهرة، 6 سنين خبرة في الهويات البصرية وشعارات الشركات الناشئة. بشتغل بـ Illustrator وFigma، وبسلّم دايمًا ملفات المصدر مع دليل استخدام بسيط للهوية.",
      en: "Graphic designer from Cairo with 6 years of experience in brand identities and startup logos. I work in Illustrator and Figma and always deliver source files with a simple brand usage guide.",
    },
    city: "cairo",
    joinedAt: "2025-03-14T10:00:00.000Z",
    piVerified: true,
    completedCount: 14,
    totalOrderCount: 17,
    portfolio: [
      {
        id: 1,
        title: { ar: "هوية مقهى «دالّة»", en: "“Dallah” coffee shop identity" },
        description: {
          ar: "لوجو وهوية كاملة لمقهى مختص: أكواب، منيو، ولافتة المحل.",
          en: "Full logo and identity for a specialty coffee shop: cups, menu and storefront sign.",
        },
        category: "design",
      },
      {
        id: 2,
        title: { ar: "منشورات إنستجرام لمتجر ملابس", en: "Instagram posts for a clothing store" },
        description: {
          ar: "30 تصميم منشورات وقصص لحملة إطلاق تشكيلة صيفية.",
          en: "30 post and story designs for a summer collection launch campaign.",
        },
        category: "design",
      },
    ],
  },
  {
    uid: "demo-u-omar",
    username: "omar.dev",
    bio: {
      ar: "مطور ويب من الرياض، ببني مواقع ومتاجر إلكترونية بـ React وNode.js، وبهتم بسرعة التحميل وتجربة الاستخدام على الموبايل قبل أي حاجة.",
      en: "Web developer from Riyadh building websites and online stores with React and Node.js, obsessed with load speed and mobile UX above all.",
    },
    city: "riyadh",
    joinedAt: "2025-06-02T10:00:00.000Z",
    piVerified: true,
    completedCount: 9,
    totalOrderCount: 11,
    portfolio: [
      {
        id: 3,
        title: { ar: "متجر إلكتروني لمنتجات العسل", en: "Online store for honey products" },
        description: {
          ar: "متجر كامل بسلة شراء ودفع، ولوحة تحكم لإدارة الطلبات والمخزون.",
          en: "A complete store with cart and checkout, plus an admin dashboard for orders and inventory.",
        },
        category: "code",
      },
      {
        id: 4,
        title: { ar: "واجهة تطبيق حجوزات عيادات", en: "Clinic booking app UI" },
        description: {
          ar: "واجهة حجز مواعيد مع تقويم تفاعلي وتنبيهات للمرضى.",
          en: "Appointment booking interface with an interactive calendar and patient reminders.",
        },
        category: "code",
      },
    ],
  },
  {
    uid: "demo-u-laila",
    username: "laila.cuts",
    bio: {
      ar: "مونتيرة فيديو من إسكندرية، بشتغل على فيديوهات يوتيوب وريلز وتيك توك، وبسلّم بسرعة مع ترجمة مدمجة وموسيقى مرخّصة لو حابب.",
      en: "Video editor from Alexandria working on YouTube videos, Reels and TikTok, with fast delivery, burned-in subtitles and licensed music on request.",
    },
    city: "alexandria",
    joinedAt: "2024-11-20T10:00:00.000Z",
    piVerified: true,
    completedCount: 21,
    totalOrderCount: 24,
    portfolio: [
      {
        id: 5,
        title: { ar: "سلسلة فيديوهات طبخ (12 حلقة)", en: "Cooking video series (12 episodes)" },
        description: {
          ar: "مونتاج كامل لسلسلة طبخ على يوتيوب: قصّ، ألوان، وترجمة عربي وإنجليزي.",
          en: "Full editing for a YouTube cooking series: cutting, color and Arabic/English subtitles.",
        },
        category: "video",
      },
      {
        id: 6,
        title: { ar: "إعلان منتج 30 ثانية", en: "30-second product ad" },
        description: {
          ar: "إعلان سريع الإيقاع لمنتج عناية بالبشرة، نسختين للريلز والستوري.",
          en: "Fast-paced ad for a skincare product, in Reels and Story versions.",
        },
        category: "video",
      },
    ],
  },
  {
    uid: "demo-u-karim",
    username: "karim.translates",
    bio: {
      ar: "مترجم عربي ⇄ إنجليزي من دبي، متخصص في ترجمة واجهات التطبيقات والمستندات التجارية والعقود، مع مراجعة ثانية لكل نص قبل التسليم.",
      en: "Arabic ⇄ English translator based in Dubai, specialized in app interfaces, business documents and contracts, with a second proofread before every delivery.",
    },
    city: "dubai",
    joinedAt: "2025-01-08T10:00:00.000Z",
    piVerified: true,
    completedCount: 17,
    totalOrderCount: 19,
    portfolio: [
      {
        id: 7,
        title: { ar: "ترجمة واجهة تطبيق بنكي", en: "Banking app UI translation" },
        description: {
          ar: "ترجمة وتعريب واجهة تطبيق بنكي كاملة (أكتر من 400 شاشة ونص).",
          en: "Full translation and localization of a banking app UI (400+ screens and strings).",
        },
        category: "translation",
      },
      {
        id: 8,
        title: { ar: "ترجمة كتالوج منتجات (120 صفحة)", en: "Product catalog translation (120 pages)" },
        description: {
          ar: "ترجمة كتالوج منتجات إلكترونية من الإنجليزي للعربي مع الحفاظ على التنسيق.",
          en: "Electronics product catalog translated from English to Arabic, formatting preserved.",
        },
        category: "translation",
      },
    ],
  },
  {
    uid: "demo-u-nour",
    username: "nour.writes",
    bio: {
      ar: "كاتبة محتوى من جدة، بكتب مقالات متوافقة مع SEO ووصف منتجات ونصوص صفحات هبوط بتحوّل الزائر لعميل. بكتب بالعربي والإنجليزي.",
      en: "Content writer from Jeddah writing SEO articles, product descriptions and landing-page copy that turns visitors into customers, in Arabic and English.",
    },
    city: "jeddah",
    joinedAt: "2025-08-19T10:00:00.000Z",
    piVerified: false,
    completedCount: 6,
    totalOrderCount: 8,
    portfolio: [
      {
        id: 9,
        title: { ar: "20 مقال SEO لمدونة تقنية", en: "20 SEO articles for a tech blog" },
        description: {
          ar: "سلسلة مقالات رفعت زيارات المدونة من البحث بنسبة 60% في 3 شهور.",
          en: "An article series that grew the blog's search traffic by 60% in 3 months.",
        },
        category: "writing",
      },
      {
        id: 10,
        title: { ar: "وصف منتجات متجر عطور", en: "Perfume store product descriptions" },
        description: {
          ar: "وصف تسويقي لـ 45 منتج عطر بالعربي والإنجليزي.",
          en: "Marketing descriptions for 45 perfume products in Arabic and English.",
        },
        category: "writing",
      },
    ],
  },
  {
    uid: "demo-u-youssef",
    username: "youssef.ads",
    bio: {
      ar: "مسوّق رقمي من الجيزة، بدير حملات فيسبوك وإنستجرام وتيك توك، وبنيت حملات وصلت لملايين المشاهدات بميزانيات صغيرة.",
      en: "Digital marketer from Giza running Facebook, Instagram and TikTok campaigns; I've built campaigns reaching millions of views on small budgets.",
    },
    city: "giza",
    joinedAt: "2025-09-27T10:00:00.000Z",
    piVerified: false,
    completedCount: 4,
    totalOrderCount: 5,
    portfolio: [
      {
        id: 11,
        title: { ar: "حملة إطلاق تطبيق توصيل", en: "Delivery app launch campaign" },
        description: {
          ar: "حملة إعلانات إطلاق وصلت لـ 2.3 مليون مشاهدة و18 ألف تثبيت في أول شهر.",
          en: "Launch ad campaign reaching 2.3M views and 18k installs in the first month.",
        },
        category: "marketing",
      },
      {
        id: 12,
        title: { ar: "خطة محتوى شهرية لبراند ملابس", en: "Monthly content plan for a clothing brand" },
        description: {
          ar: "خطة محتوى وتقويم نشر كامل لشهر، مع أفكار ريلز أسبوعية.",
          en: "A full one-month content plan and posting calendar with weekly Reels ideas.",
        },
        category: "marketing",
      },
    ],
  },
  {
    uid: "demo-u-huda",
    username: "huda.brands",
    bio: {
      ar: "مصممة سوشيال ميديا من الشارقة، بعمل تصميمات منشورات وقصص سريعة التسليم وبأسلوب موحّد يعبر عن البراند بتاعك.",
      en: "Social media designer from Sharjah creating fast-delivery post and story designs in one consistent style that matches your brand.",
    },
    city: "sharjah",
    joinedAt: "2026-02-11T10:00:00.000Z",
    piVerified: false,
    completedCount: 2,
    totalOrderCount: 3,
    portfolio: [
      {
        id: 13,
        title: { ar: "تصميمات إطلاق متجر حلويات", en: "Dessert shop launch designs" },
        description: {
          ar: "12 تصميم منشورات وقصص لإطلاق متجر حلويات جديد.",
          en: "12 post and story designs for a new dessert shop launch.",
        },
        category: "design",
      },
    ],
  },
];

const DEMO_GIGS: DemoGig[] = [
  {
    id: 101,
    sellerUid: "demo-u-sara",
    title: {
      ar: "هصمّم لك لوجو احترافي + هوية بصرية كاملة",
      en: "Professional logo + full brand identity for your business",
    },
    description: {
      ar: "هصمّم لوجو يعبر عن مشروعك من أول نظرة: 3 مقترحات مختلفة، تعديلين مجانًا، والتسليم PNG وSVG وPDF + ملفات المصدر ودليل ألوان وخطوط بسيط.",
      en: "I'll design a logo that captures your business at first glance: 3 different concepts, 2 free revisions, delivered as PNG, SVG and PDF plus source files and a simple color & font guide.",
    },
    category: "design",
    pricePi: 25,
    deliveryDays: 3,
    createdAt: "2026-10-12T09:00:00.000Z",
    orderCount: 14,
  },
  {
    id: 102,
    sellerUid: "demo-u-huda",
    title: {
      ar: "10 تصميمات سوشيال ميديا جاهزة للنشر",
      en: "10 ready-to-post social media designs",
    },
    description: {
      ar: "10 تصميمات منشورات إنستجرام وفيسبوك بأسلوب موحّد على هوية براندك، بمقاسات المنشورات والقصص، والتسليم ملفات جاهزة للنشر + قوالب قابلة للتعديل.",
      en: "10 Instagram and Facebook post designs in one consistent style matching your brand identity, in post and story sizes, delivered ready to publish plus editable templates.",
    },
    category: "design",
    pricePi: 12,
    deliveryDays: 2,
    createdAt: "2026-11-02T09:00:00.000Z",
    orderCount: 3,
  },
  {
    id: 103,
    sellerUid: "demo-u-omar",
    title: {
      ar: "هنبنيلك موقع شخصي أو صفحة هبوط بـ React",
      en: "Personal website or landing page built with React",
    },
    description: {
      ar: "موقع سريع ومتجاوب مع كل الشاشات: صفحة رئيسية + أقسام تعريفية + نموذج تواصل، مع أساسيات SEO وسرعة تحميل ممتازة. كود نظيف وموثّق تقدر تطوّره بعد كده.",
      en: "A fast, fully responsive website: home page, about sections and a contact form, with SEO basics and excellent load speed. Clean, documented code you can build on later.",
    },
    category: "code",
    pricePi: 60,
    deliveryDays: 7,
    createdAt: "2026-09-28T09:00:00.000Z",
    orderCount: 9,
  },
  {
    id: 104,
    sellerUid: "demo-u-omar",
    title: {
      ar: "إصلاح أخطاء موقعك وتحسين سرعته",
      en: "Bug fixes and speed optimization for your website",
    },
    description: {
      ar: "هراجع موقعك، أصلّح الأخطاء الظاهرة، وأحسّن سرعة التحميل (صور، كاش، تقليل الطلبات) مع تقرير قبل/بعد بنتائج القياس.",
      en: "I'll audit your website, fix the visible bugs and improve load speed (images, caching, fewer requests), with a before/after measurement report.",
    },
    category: "code",
    pricePi: 35,
    deliveryDays: 4,
    createdAt: "2026-10-20T09:00:00.000Z",
    orderCount: 5,
  },
  {
    id: 105,
    sellerUid: "demo-u-laila",
    title: {
      ar: "مونتاج فيديو يوتيوب احترافي لحد 15 دقيقة",
      en: "Professional YouTube video editing, up to 15 minutes",
    },
    description: {
      ar: "مونتاج كامل: قصّ وتنظيف صوت، تصحيح ألوان، عناوين متحركة، وترجمة مدمجة عربي أو إنجليزي. مناسب للقنوات التعليمية والفلوقات والمراجعات.",
      en: "Full editing: cutting and audio cleanup, color correction, animated titles and burned-in Arabic or English subtitles. Great for educational channels, vlogs and reviews.",
    },
    category: "video",
    pricePi: 30,
    deliveryDays: 4,
    createdAt: "2026-08-15T09:00:00.000Z",
    orderCount: 21,
  },
  {
    id: 106,
    sellerUid: "demo-u-karim",
    title: {
      ar: "ترجمة عربي ⇄ إنجليزي احترافية لحد 3000 كلمة",
      en: "Professional Arabic ⇄ English translation, up to 3,000 words",
    },
    description: {
      ar: "ترجمة بشرية دقيقة بمصطلحات سليمة ومراجعة ثانية قبل التسليم — مستندات، مواقع، أو واجهات تطبيقات. التنسيق الأصلي بيتحافظ عليه زي ما هو.",
      en: "Accurate human translation with correct terminology and a second proofread before delivery — documents, websites or app interfaces, with the original formatting preserved.",
    },
    category: "translation",
    pricePi: 20,
    deliveryDays: 2,
    createdAt: "2026-07-30T09:00:00.000Z",
    orderCount: 17,
  },
  {
    id: 107,
    sellerUid: "demo-u-nour",
    title: {
      ar: "كتابة 5 مقالات SEO لمدونتك أو متجرك",
      en: "5 SEO articles for your blog or store",
    },
    description: {
      ar: "5 مقالات أصلية مبنية على بحث كلمات مفتاحية، بعناوين تجذب الضغط وروابط داخلية مقترحة، وكل مقال من 900 لـ 1200 كلمة.",
      en: "5 original articles built on keyword research, with click-worthy titles and suggested internal links, each 900–1,200 words.",
    },
    category: "writing",
    pricePi: 18,
    deliveryDays: 5,
    createdAt: "2026-10-05T09:00:00.000Z",
    orderCount: 6,
  },
  {
    id: 108,
    sellerUid: "demo-u-youssef",
    title: {
      ar: "إدارة حملة إعلانات فيسبوك وإنستجرام لمدة أسبوع",
      en: "One week of Facebook & Instagram ads management",
    },
    description: {
      ar: "إعداد وإدارة حملة إعلانية كاملة لمدة أسبوع: تقسيم جمهور، نسختين إعلانيتين، متابعة يومية، وتقرير نتائج في الآخر. (ميزانية الإعلانات نفسها عليك.)",
      en: "Full setup and management of an ad campaign for one week: audience segmentation, two ad variants, daily monitoring and a final results report. (The ad spend itself is on you.)",
    },
    category: "marketing",
    pricePi: 45,
    deliveryDays: 7,
    createdAt: "2026-11-08T09:00:00.000Z",
    orderCount: 4,
  },
  {
    id: 109,
    sellerUid: "demo-u-nour",
    title: {
      ar: "وصف منتجات يبيع لحد 20 منتج",
      en: "Product descriptions that sell, up to 20 products",
    },
    description: {
      ar: "وصف تسويقي قصير ومقنع لكل منتج، بيبرز الفايدة مش المواصفات بس، ومتظبط على كلمات البحث اللي عميلك بيدوّر بيها.",
      en: "Short, persuasive descriptions for each product that highlight benefits over specs, tuned to the search terms your customers actually use.",
    },
    category: "writing",
    pricePi: 10,
    deliveryDays: 3,
    createdAt: "2026-11-15T09:00:00.000Z",
    orderCount: 2,
  },
];

const DEMO_GIG_REVIEWS: Record<number, DemoReview[]> = {
  101: [
    {
      id: 1,
      buyerName: "ahmed.cafe",
      rating: 5,
      comment: {
        ar: "الشغل فاق توقعاتي، اللوجو بقى هوية المحل كلها. سارة فهمت الفكرة من أول رسالة.",
        en: "The work exceeded my expectations — the logo became the whole shop's identity. Sara got the idea from the first message.",
      },
      createdAt: "2026-10-20T12:00:00.000Z",
    },
    {
      id: 2,
      buyerName: "layla.shop",
      rating: 5,
      comment: {
        ar: "تسليم في المعاد وملفات مرتبة جدًا. أكيد هتعامل معاها تاني.",
        en: "Delivered on time with very organized files. Will definitely work with her again.",
      },
      createdAt: "2026-11-01T12:00:00.000Z",
    },
    {
      id: 3,
      buyerName: "mostafa.g",
      rating: 4,
      comment: {
        ar: "تصميم ممتاز، بس أخدنا جولة تعديلات زيادة عن اللي توقعت. النتيجة النهائية تستاهل.",
        en: "Excellent design, though we needed one more revision round than I expected. The final result was worth it.",
      },
      createdAt: "2026-11-10T12:00:00.000Z",
    },
  ],
  102: [
    {
      id: 4,
      buyerName: "sweet.bites",
      rating: 5,
      comment: {
        ar: "التصميمات نضيفة والألوان بالظبط زي البراند. النشر بقى أسهل بكتير.",
        en: "Clean designs and the colors match the brand exactly. Posting got so much easier.",
      },
      createdAt: "2026-11-06T12:00:00.000Z",
    },
    {
      id: 5,
      buyerName: "dana.store",
      rating: 5,
      comment: {
        ar: "سلّمت قبل المعاد بيوم والقوالب سهلة التعديل.",
        en: "Delivered a day early and the templates are easy to edit.",
      },
      createdAt: "2026-11-12T12:00:00.000Z",
    },
  ],
  103: [
    {
      id: 6,
      buyerName: "khaled.fit",
      rating: 5,
      comment: {
        ar: "الموقع سريع وشكله احترافي على الموبايل، والكود مرتب. تجربة ممتازة.",
        en: "The site is fast and looks professional on mobile, and the code is clean. Great experience.",
      },
      createdAt: "2026-10-10T12:00:00.000Z",
    },
    {
      id: 7,
      buyerName: "reem.travel",
      rating: 5,
      comment: {
        ar: "عمر سمع كل الملاحظات ونفذها بدقة. صفحة الهبوط رفعت الحجوزات فعلًا.",
        en: "Omar listened to every note and implemented it precisely. The landing page really lifted bookings.",
      },
      createdAt: "2026-10-25T12:00:00.000Z",
    },
    {
      id: 8,
      buyerName: "ziad.m",
      rating: 4,
      comment: {
        ar: "شغل قوي، التأخير يوم واحد بس كان فيه تواصل واضح طول الوقت.",
        en: "Strong work; there was a one-day delay but communication was clear the whole time.",
      },
      createdAt: "2026-11-05T12:00:00.000Z",
    },
  ],
  104: [
    {
      id: 9,
      buyerName: "honey.house",
      rating: 5,
      comment: {
        ar: "سرعة الموقع اتحسنت من 6 ثواني لثانية ونص، والتقرير كان واضح جدًا.",
        en: "Site speed improved from 6 seconds to 1.5, and the report was very clear.",
      },
      createdAt: "2026-11-03T12:00:00.000Z",
    },
  ],
  105: [
    {
      id: 10,
      buyerName: "chef.mona",
      rating: 5,
      comment: {
        ar: "ليلى بقت المونتيرة الأساسية لقناتي. إيقاع الفيديوهات اتغير تمامًا.",
        en: "Laila became my channel's main editor. The pacing of my videos completely changed.",
      },
      createdAt: "2026-09-18T12:00:00.000Z",
    },
    {
      id: 11,
      buyerName: "tech.arabia",
      rating: 5,
      comment: {
        ar: "ترجمة مدمجة دقيقة ومونتاج نضيف، والتسليم قبل المعاد.",
        en: "Accurate burned-in subtitles and clean editing, delivered early.",
      },
      createdAt: "2026-10-22T12:00:00.000Z",
    },
    {
      id: 12,
      buyerName: "omar.vlogs",
      rating: 5,
      comment: {
        ar: "أحسن استثمار لقناتي الصغيرة. المشاهدات زادت من أول فيديو.",
        en: "Best investment for my small channel. Views grew from the very first video.",
      },
      createdAt: "2026-11-09T12:00:00.000Z",
    },
  ],
  106: [
    {
      id: 13,
      buyerName: "fintech.eg",
      rating: 5,
      comment: {
        ar: "ترجمة مصطلحات مالية دقيقة جدًا، والمراجعة باينة في الشغل.",
        en: "Very accurate financial terminology, and the proofreading shows in the work.",
      },
      createdAt: "2026-09-14T12:00:00.000Z",
    },
    {
      id: 14,
      buyerName: "dr.hany",
      rating: 4,
      comment: {
        ar: "ترجمة ممتازة لملفات طبية حساسة، مع التزام كامل بالسرية.",
        en: "Excellent translation of sensitive medical files, with full confidentiality.",
      },
      createdAt: "2026-10-16T12:00:00.000Z",
    },
    {
      id: 15,
      buyerName: "atlas.import",
      rating: 5,
      comment: {
        ar: "سلّم 3000 كلمة في يومين من غير ما الجودة تقل خالص.",
        en: "Delivered 3,000 words in two days without any drop in quality.",
      },
      createdAt: "2026-11-11T12:00:00.000Z",
    },
  ],
  107: [
    {
      id: 16,
      buyerName: "blog.nour",
      rating: 5,
      comment: {
        ar: "المقالات بدأت تظهر في جوجل بعد أسبوعين. أسلوب الكتابة سهل وممتع.",
        en: "The articles started ranking on Google after two weeks. The writing style is easy and enjoyable.",
      },
      createdAt: "2026-10-28T12:00:00.000Z",
    },
    {
      id: 17,
      buyerName: "saas.arabia",
      rating: 5,
      comment: {
        ar: "بحث كلمات مفتاحية مظبوط وعناوين بتجيب ضغطات فعلًا.",
        en: "Solid keyword research and titles that actually get clicks.",
      },
      createdAt: "2026-11-07T12:00:00.000Z",
    },
  ],
  108: [
    {
      id: 18,
      buyerName: "food.app",
      rating: 4,
      comment: {
        ar: "الحملة جابت تثبيتات بسعر كويس، والتقرير النهائي كان مفصّل.",
        en: "The campaign brought installs at a good price, and the final report was detailed.",
      },
      createdAt: "2026-11-14T12:00:00.000Z",
    },
    {
      id: 19,
      buyerName: "gym.pro",
      rating: 5,
      comment: {
        ar: "أول مرة إعلاناتي تجيب عملاء فعليين مش مجرد لايكات.",
        en: "First time my ads brought real customers, not just likes.",
      },
      createdAt: "2026-11-18T12:00:00.000Z",
    },
  ],
  109: [
    {
      id: 20,
      buyerName: "oud.house",
      rating: 5,
      comment: {
        ar: "الأوصاف بقت تبيع فعلًا، معدل التحويل زاد عندي بشكل واضح.",
        en: "The descriptions actually sell now; my conversion rate clearly went up.",
      },
      createdAt: "2026-11-19T12:00:00.000Z",
    },
  ],
};

type DemoMsg = {
  id: number;
  senderPiUid: string;
  senderName: string;
  body: DemoText;
  createdAt: string;
};

type DemoOrder = {
  id: number;
  gigId: number | null;
  gigTitle: DemoText;
  source: "gig" | "job_request";
  jobRequestId: number | null;
  sellerName: string;
  sellerPiUid: string | null;
  buyerName: string;
  buyerPiUid: string | null;
  brief: DemoText;
  amountPi: number;
  commissionPi: number;
  sellerNetPi: number;
  status: Order["status"];
  paymentRef: string;
  deliveryNote: DemoText | null;
  createdAt: string;
  deliveredAt: string | null;
  completedAt: string | null;
  hasReview: boolean;
  messages: DemoMsg[];
};

type DemoOffer = {
  id: number;
  sellerName: string;
  sellerPiUid: string | null;
  pricePi: number;
  deliveryDays: number;
  message: DemoText;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

type DemoJob = {
  id: number;
  buyerName: string;
  buyerPiUid: string | null;
  title: DemoText;
  description: DemoText;
  category: Category;
  budgetPi: number;
  durationDays: number;
  status: "open" | "awarded" | "cancelled";
  createdAt: string;
  offers: DemoOffer[];
};

const DEMO_CHAT_REPLIES: DemoText[] = [
  {
    ar: "تمام، استلمت رسالتك وبشتغل عليها دلوقتي. هبعتلك تحديث أول ما أخلص الجزء الأول.",
    en: "Got it — I'm on it right away. I'll send you an update as soon as the first part is done.",
  },
  {
    ar: "شكرًا ليك! لو احتجت أي تعديل بسيط قولي وأنا أظبطه على طول.",
    en: "Thanks! If you need any small tweak, just tell me and I'll sort it out right away.",
  },
];

function seedDemoJobs(): DemoJob[] {
  return [
    {
      id: 201,
      buyerName: "fares.stores",
      buyerPiUid: "demo-u-fares",
      title: {
        ar: "محتاج متجر إلكتروني بسيط لبيع العسل ومنتجات طبيعية",
        en: "Need a simple online store for honey and natural products",
      },
      description: {
        ar: "عندي منتجات عسل طبيعي وعايز متجر بسيط: عرض منتجات، سلة شراء، وطلبات بتوصلي على الإيميل. مش محتاج دفع إلكتروني في الأول.",
        en: "I sell natural honey products and need a simple store: product listings, a cart, and orders sent to my email. No online payment needed at first.",
      },
      category: "code",
      budgetPi: 80,
      durationDays: 14,
      status: "open",
      createdAt: "2026-11-18T10:00:00.000Z",
      offers: [
        {
          id: 1,
          sellerName: "omar.dev",
          sellerPiUid: "demo-u-omar",
          pricePi: 75,
          deliveryDays: 10,
          message: {
            ar: "أبني لك المتجر بـ React مع سلة شراء ولوحة طلبات، وبسلّم نسخة تجريبية بعد 5 أيام للمراجعة.",
            en: "I'll build your store with React, a cart and an orders dashboard, and deliver a preview build after 5 days for review.",
          },
          status: "pending",
          createdAt: "2026-11-19T09:00:00.000Z",
        },
      ],
    },
    {
      id: 202,
      buyerName: "salma.beauty",
      buyerPiUid: "demo-u-salma",
      title: {
        ar: "محتاجة هوية بصرية لبراند عناية بالبشرة",
        en: "Brand identity for a skincare brand",
      },
      description: {
        ar: "براند ناشئ لمنتجات عناية طبيعية بالبشرة. محتاجة لوجو، ألوان، وخطوط، و3 قوالب منشورات إنستجرام.",
        en: "A new brand for natural skincare products. I need a logo, colors, fonts, and 3 Instagram post templates.",
      },
      category: "design",
      budgetPi: 40,
      durationDays: 10,
      status: "open",
      createdAt: "2026-11-16T10:00:00.000Z",
      offers: [
        {
          id: 2,
          sellerName: "sara.designs",
          sellerPiUid: "demo-u-sara",
          pricePi: 38,
          deliveryDays: 5,
          message: {
            ar: "أعملك هوية كاملة: لوجو + لوحة ألوان + قوالب المنشورات، مع جولتين تعديل.",
            en: "I'll make a full identity: logo, color palette and post templates, with two revision rounds.",
          },
          status: "pending",
          createdAt: "2026-11-17T09:00:00.000Z",
        },
        {
          id: 3,
          sellerName: "huda.brands",
          sellerPiUid: "demo-u-huda",
          pricePi: 35,
          deliveryDays: 6,
          message: {
            ar: "متخصصة في هويات براندات الجمال، وأبدأ ببحث سريع عن المنافسين قبل التصميم.",
            en: "I specialize in beauty brand identities and start with quick competitor research before designing.",
          },
          status: "pending",
          createdAt: "2026-11-17T15:00:00.000Z",
        },
      ],
    },
    {
      id: 203,
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      title: {
        ar: "ترجمة واجهة تطبيق من العربي للإنجليزي",
        en: "Translate my app UI from Arabic to English",
      },
      description: {
        ar: "تطبيق صغير لإدارة المصاريف، واجهته بالعربي ومحتاج نسخة إنجليزية كاملة: حوالي 180 نص واجهة + رسائل أخطاء.",
        en: "A small expense-tracking app with an Arabic UI that needs a full English version: about 180 UI strings plus error messages.",
      },
      category: "translation",
      budgetPi: 25,
      durationDays: 5,
      status: "open",
      createdAt: "2026-11-20T10:00:00.000Z",
      offers: [
        {
          id: 4,
          sellerName: "karim.translates",
          sellerPiUid: "demo-u-karim",
          pricePi: 22,
          deliveryDays: 3,
          message: {
            ar: "أترجم الواجهة كاملة مع توحيد المصطلحات ومراجعة ثانية، وبسلّم ملف النصوص جاهز للتركيب.",
            en: "I'll translate the full UI with consistent terminology and a second proofread, delivered as a ready-to-integrate strings file.",
          },
          status: "pending",
          createdAt: "2026-11-20T14:00:00.000Z",
        },
        {
          id: 5,
          sellerName: "nour.writes",
          sellerPiUid: "demo-u-nour",
          pricePi: 24,
          deliveryDays: 4,
          message: {
            ar: "بكتب وأترجم بالعربي والإنجليزي، وهراعي إن النصوص الإنجليزية تبقى طبيعية مش ترجمة حرفية.",
            en: "I write and translate in Arabic and English, and I'll make sure the English reads naturally, not like a literal translation.",
          },
          status: "pending",
          createdAt: "2026-11-21T09:00:00.000Z",
        },
      ],
    },
    {
      id: 204,
      buyerName: "fares.stores",
      buyerPiUid: "demo-u-fares",
      title: { ar: "تصميم شعار لمتجر عسل", en: "Logo design for a honey store" },
      description: {
        ar: "شعار بسيط ودافئ لمتجر عسل طبيعي، يشتغل على العبوات والسوشيال ميديا.",
        en: "A simple, warm logo for a natural honey store that works on packaging and social media.",
      },
      category: "design",
      budgetPi: 20,
      durationDays: 5,
      status: "awarded",
      createdAt: "2026-11-05T10:00:00.000Z",
      offers: [
        {
          id: 6,
          sellerName: "sara.designs",
          sellerPiUid: "demo-u-sara",
          pricePi: 18,
          deliveryDays: 3,
          message: {
            ar: "أصمم لك شعار بلمسة طبيعية مع نسخة أحادية اللون للعبوات.",
            en: "I'll design a logo with a natural touch, plus a one-color version for packaging.",
          },
          status: "accepted",
          createdAt: "2026-11-06T09:00:00.000Z",
        },
      ],
    },
  ];
}

function seedDemoOrders(): DemoOrder[] {
  return [
    {
      id: 301,
      gigId: 105,
      gigTitle: {
        ar: "مونتاج فيديو يوتيوب احترافي لحد 15 دقيقة",
        en: "Professional YouTube video editing, up to 15 minutes",
      },
      source: "gig",
      jobRequestId: null,
      sellerName: "laila.cuts",
      sellerPiUid: "demo-u-laila",
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      brief: {
        ar: "عندي فيديو خام 40 دقيقة عن مراجعة منتج، عايز مونتاج يوتيوب 12 دقيقة مع ترجمة إنجليزي مدمجة.",
        en: "I have 40 minutes of raw footage for a product review; I need a 12-minute YouTube edit with burned-in English subtitles.",
      },
      amountPi: 30,
      commissionPi: 3,
      sellerNetPi: 27,
      status: "delivered",
      paymentRef: "demo-pay-7f3a",
      deliveryNote: {
        ar: "سلّمت النسخة الأولى بترجمة مدمجة، ورابط المعاينة في الشات. أي تعديل بسيط قولي.",
        en: "Delivered the first cut with burned-in subtitles; the preview link is in the chat. Tell me about any small tweaks.",
      },
      createdAt: "2026-11-17T11:00:00.000Z",
      deliveredAt: "2026-11-20T16:30:00.000Z",
      completedAt: null,
      hasReview: false,
      messages: [
        {
          id: 1,
          senderPiUid: "demo-u-laila",
          senderName: "laila.cuts",
          body: {
            ar: "أهلاً! استلمت الملفات وبدأت المونتاج. هركّز على أول 30 ثانية عشان الشدّ.",
            en: "Hi! I received the files and started editing. I'll focus on the first 30 seconds for the hook.",
          },
          createdAt: "2026-11-17T12:00:00.000Z",
        },
        {
          id: 2,
          senderPiUid: DEMO_ME.piUid,
          senderName: DEMO_ME.username,
          body: {
            ar: "تمام، ولو تقدر تخلي الإيقاع أسرع في النص التاني يبقى ممتاز.",
            en: "Great — and if you can make the second half faster-paced, that would be perfect.",
          },
          createdAt: "2026-11-17T13:00:00.000Z",
        },
        {
          id: 3,
          senderPiUid: "demo-u-laila",
          senderName: "laila.cuts",
          body: {
            ar: "خلصت النسخة الأولى وسلّمتها. شوفها على مهلك وقولي ملاحظاتك.",
            en: "The first cut is done and delivered. Take your time watching it and send me your notes.",
          },
          createdAt: "2026-11-20T16:30:00.000Z",
        },
      ],
    },
    {
      id: 302,
      gigId: 101,
      gigTitle: {
        ar: "هصمّم لك لوجو احترافي + هوية بصرية كاملة",
        en: "Professional logo + full brand identity for your business",
      },
      source: "gig",
      jobRequestId: null,
      sellerName: "sara.designs",
      sellerPiUid: "demo-u-sara",
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      brief: {
        ar: "عايز لوجو لمحل قهوة جديد اسمه «روقان»، ألوانه بني ودهبي، والتسليم بملفات المصدر.",
        en: "I need a logo for a new coffee shop called “Rawqan”, brown and gold colors, with source files delivered.",
      },
      amountPi: 25,
      commissionPi: 2.5,
      sellerNetPi: 22.5,
      status: "awaiting_delivery",
      paymentRef: "demo-pay-9c21",
      deliveryNote: null,
      createdAt: "2026-11-21T10:00:00.000Z",
      deliveredAt: null,
      completedAt: null,
      hasReview: false,
      messages: [
        {
          id: 4,
          senderPiUid: DEMO_ME.piUid,
          senderName: DEMO_ME.username,
          body: {
            ar: "أهلاً سارة، بعتلك اسم المحل والألوان اللي في بالي في وصف الطلب.",
            en: "Hi Sara, I sent you the shop name and the colors I have in mind in the order brief.",
          },
          createdAt: "2026-11-21T10:05:00.000Z",
        },
        {
          id: 5,
          senderPiUid: "demo-u-sara",
          senderName: "sara.designs",
          body: {
            ar: "وصلني كل حاجة. هبعت أول 3 مقترحات بكرة الصبح إن شاء الله.",
            en: "Got everything. I'll send the first 3 concepts tomorrow morning.",
          },
          createdAt: "2026-11-21T11:00:00.000Z",
        },
      ],
    },
    {
      id: 303,
      gigId: null,
      gigTitle: {
        ar: "كتابة وصف منتجات لمتجر عناية بالبشرة",
        en: "Product descriptions for a skincare store",
      },
      source: "job_request",
      jobRequestId: null,
      sellerName: DEMO_ME.username,
      sellerPiUid: DEMO_ME.piUid,
      buyerName: "salma.beauty",
      buyerPiUid: "demo-u-salma",
      brief: {
        ar: "محتاجة وصف تسويقي لـ 12 منتج عناية بالبشرة، بالعربي والإنجليزي.",
        en: "I need marketing descriptions for 12 skincare products, in Arabic and English.",
      },
      amountPi: 15,
      commissionPi: 1.5,
      sellerNetPi: 13.5,
      status: "completed",
      paymentRef: "demo-pay-3b8e",
      deliveryNote: {
        ar: "سلّمت أوصاف الـ 12 منتج بالعربي والإنجليزي في ملف واحد منظم.",
        en: "Delivered descriptions for all 12 products in Arabic and English in one organized file.",
      },
      createdAt: "2026-11-10T09:00:00.000Z",
      deliveredAt: "2026-11-12T09:00:00.000Z",
      completedAt: "2026-11-12T18:00:00.000Z",
      hasReview: true,
      messages: [
        {
          id: 6,
          senderPiUid: "demo-u-salma",
          senderName: "salma.beauty",
          body: {
            ar: "الأوصاف رائعة والمبيعات بدأت تتحرك. شكرًا جزيلًا!",
            en: "The descriptions are wonderful and sales are starting to move. Thank you so much!",
          },
          createdAt: "2026-11-12T18:05:00.000Z",
        },
      ],
    },
    {
      id: 304,
      gigId: null,
      gigTitle: {
        ar: "تصميم منشورات إطلاق منتج عسل جديد",
        en: "Launch posts design for a new honey product",
      },
      source: "gig",
      jobRequestId: null,
      sellerName: DEMO_ME.username,
      sellerPiUid: DEMO_ME.piUid,
      buyerName: "fares.stores",
      buyerPiUid: "demo-u-fares",
      brief: {
        ar: "عايز 6 تصميمات منشورات لإطلاق نوع عسل جديد، بالأحجام المناسبة لإنستجرام وفيسبوك.",
        en: "I need 6 post designs to launch a new honey variety, in the right sizes for Instagram and Facebook.",
      },
      amountPi: 12,
      commissionPi: 1.2,
      sellerNetPi: 10.8,
      status: "awaiting_delivery",
      paymentRef: "demo-pay-5d07",
      deliveryNote: null,
      createdAt: "2026-11-21T15:00:00.000Z",
      deliveredAt: null,
      completedAt: null,
      hasReview: false,
      messages: [
        {
          id: 7,
          senderPiUid: "demo-u-fares",
          senderName: "fares.stores",
          body: {
            ar: "بعتلك صور المنتج والشعار. الإطلاق يوم الخميس الجاي، فالمعاد مهم.",
            en: "I sent you the product photos and the logo. Launch is next Thursday, so timing matters.",
          },
          createdAt: "2026-11-21T15:10:00.000Z",
        },
      ],
    },
  ];
}

function demoFreelancer(uid: string): DemoFreelancer | undefined {
  return DEMO_FREELANCERS.find((f) => f.uid === uid);
}

function demoAvg(reviews: DemoReview[]): number | null {
  if (reviews.length === 0) return null;
  return Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
}

/** Converts a demo gig into the exact shape the real GigCard renders. */
function demoGigShape(gig: DemoGig, lang: Lang, reviews: DemoReview[]): Gig {
  const seller = demoFreelancer(gig.sellerUid);
  return {
    id: gig.id,
    sellerName: seller?.username ?? "—",
    sellerPiUid: gig.sellerUid,
    title: tx(gig.title, lang),
    description: tx(gig.description, lang),
    category: gig.category,
    pricePi: gig.pricePi,
    deliveryDays: gig.deliveryDays,
    status: "active",
    createdAt: gig.createdAt,
    avgRating: demoAvg(reviews),
    reviewCount: reviews.length,
    orderCount: gig.orderCount,
  };
}

function DemoMode({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<View>("market");
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [gigId, setGigId] = useState<number | null>(null);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [orders, setOrders] = useState<DemoOrder[]>(seedDemoOrders);
  const [jobs, setJobs] = useState<DemoJob[]>(seedDemoJobs);
  const [reviewsByGig, setReviewsByGig] = useState<Record<number, DemoReview[]>>(() => ({
    ...DEMO_GIG_REVIEWS,
  }));
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const openGig = (id: number) => {
    setProfileUid(null);
    setGigId(id);
    setView("market");
  };
  const openProfile = (uid: string) => {
    setGigId(null);
    setProfileUid(uid);
  };

  function updateOrder(id: number, patch: Partial<DemoOrder>) {
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function addOrder(order: DemoOrder) {
    setOrders((os) => [order, ...os]);
  }

  function sendMessage(orderId: number, body: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const mine: DemoMsg = {
      id: Date.now(),
      senderPiUid: DEMO_ME.piUid,
      senderName: DEMO_ME.username,
      body: { ar: body, en: body },
      createdAt: new Date().toISOString(),
    };
    setOrders((os) =>
      os.map((o) => (o.id === orderId ? { ...o, messages: [...o.messages, mine] } : o)),
    );
    // A canned reply from the other party keeps the demo chat feeling alive.
    if (order.status === "cancelled" || order.status === "completed") return;
    const iAmBuyer = order.buyerPiUid === DEMO_ME.piUid;
    const otherUid = iAmBuyer ? order.sellerPiUid : order.buyerPiUid;
    const otherName = iAmBuyer ? order.sellerName : order.buyerName;
    if (!otherUid) return;
    const reply =
      DEMO_CHAT_REPLIES[order.messages.length % DEMO_CHAT_REPLIES.length] ??
      DEMO_CHAT_REPLIES[0];
    if (!reply) return;
    const timer = window.setTimeout(() => {
      setOrders((os) =>
        os.map((o) =>
          o.id === orderId
            ? {
                ...o,
                messages: [
                  ...o.messages,
                  {
                    id: Date.now() + 1,
                    senderPiUid: otherUid,
                    senderName: otherName,
                    body: reply,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : o,
        ),
      );
    }, 1400);
    timers.current.push(timer);
  }

  function addReview(orderId: number, rating: number, comment: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    updateOrder(orderId, { hasReview: true });
    if (order.gigId != null) {
      const review: DemoReview = {
        id: Date.now(),
        buyerName: DEMO_ME.username,
        rating,
        comment: { ar: comment, en: comment },
        createdAt: new Date().toISOString(),
      };
      setReviewsByGig((m) => ({
        ...m,
        [order.gigId!]: [review, ...(m[order.gigId!] ?? [])],
      }));
    }
  }

  return (
    <div>
      <div className="sticky top-2 z-40 mt-4 rounded-[var(--radius)] border-2 border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 shadow-md dark:bg-[var(--surface-alt)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-black text-[#3b1145] dark:text-[var(--gold)]">
              {t.demoBannerTitle}
            </p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#6b5510] dark:text-[var(--text)]">
              {t.demoBannerText}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="shrink-0 rounded-full bg-[#3b1145] px-4 py-2.5 font-display text-sm font-black text-white"
          >
            {t.demoExit}
          </button>
        </div>
      </div>

      {profileUid != null ? (
        <DemoProfile
          uid={profileUid}
          reviewsByGig={reviewsByGig}
          onBack={() => setProfileUid(null)}
          onOpenGig={openGig}
        />
      ) : view === "market" ? (
        gigId != null ? (
          <DemoGigDetail
            gigId={gigId}
            reviews={reviewsByGig[gigId] ?? []}
            onBack={() => setGigId(null)}
            onOpenProfile={openProfile}
            onOrdered={(order) => {
              addOrder(order);
              setGigId(null);
              setView("orders");
            }}
          />
        ) : (
          <DemoMarket
            category={category}
            setCategory={setCategory}
            query={query}
            setQuery={setQuery}
            reviewsByGig={reviewsByGig}
            onOpen={openGig}
            onOpenProfile={openProfile}
            onPublish={() => setView("sell")}
          />
        )
      ) : view === "sell" ? (
        <DemoSellNote onExit={onExit} />
      ) : view === "jobs" ? (
        <DemoJobs
          jobs={jobs}
          setJobs={setJobs}
          onOrdered={(order) => {
            addOrder(order);
            setView("orders");
          }}
          onOpenProfile={openProfile}
        />
      ) : view === "orders" ? (
        <DemoOrders
          orders={orders}
          updateOrder={updateOrder}
          sendMessage={sendMessage}
          addReview={addReview}
          onOpenProfile={openProfile}
        />
      ) : view === "wallet" ? (
        <DemoWallet orders={orders} />
      ) : (
        <DemoMap reviewsByGig={reviewsByGig} onOpenGig={openGig} onOpenProfile={openProfile} />
      )}

      <nav
        aria-label="Demo"
        className="fixed left-2 top-1/2 z-40 -translate-y-1/2 rounded-2xl border-2 border-[var(--gold)] bg-[var(--surface)] shadow-lg"
      >
        <div className="flex w-16 flex-col py-1">
          {(
            [
              { key: "market", label: t.nav.market },
              { key: "jobs", label: t.nav.jobs },
              { key: "sell", label: t.nav.sell },
              { key: "orders", label: t.nav.orders },
              { key: "wallet", label: t.nav.wallet },
              { key: "map", label: t.nav.map },
            ] as { key: View; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={view === tab.key && profileUid == null ? "page" : undefined}
              onClick={() => {
                setView(tab.key);
                setProfileUid(null);
                if (tab.key === "market") setGigId(null);
              }}
              className={`px-1 py-3 text-center font-display text-[10px] font-bold leading-tight sm:text-[11px] ${
                view === tab.key && profileUid == null
                  ? "text-[var(--accent)] dark:text-[var(--gold)]"
                  : "text-[var(--dim)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function DemoSellNote({ onExit }: { onExit: () => void }) {
  const { t } = useI18n();
  return (
    <section aria-label={t.nav.sell} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.sellTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.sellSubtitle}</p>
      <div className="mt-5 rounded-[var(--radius)] border border-[var(--gold)] bg-[var(--gold-soft)] p-5 dark:bg-[var(--surface-alt)]">
        <p className="font-display text-lg font-black">{t.demoBannerTitle}</p>
        <p className="mt-1 leading-relaxed">{t.demoSellNote}</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 rounded-full bg-[var(--gold)] px-6 py-3 font-display text-base font-black text-[#3b1145]"
        >
          {t.demoExitToReal}
        </button>
      </div>
    </section>
  );
}

function DemoMarket({
  category,
  setCategory,
  query,
  setQuery,
  reviewsByGig,
  onOpen,
  onOpenProfile,
  onPublish,
}: {
  category: Category | null;
  setCategory: (c: Category | null) => void;
  query: string;
  setQuery: (q: string) => void;
  reviewsByGig: Record<number, DemoReview[]>;
  onOpen: (id: number) => void;
  onOpenProfile: (uid: string) => void;
  onPublish: () => void;
}) {
  const { t, lang } = useI18n();
  const q = query.trim().toLowerCase();
  const gigs = DEMO_GIGS.map((g) => demoGigShape(g, lang, reviewsByGig[g.id] ?? []))
    .filter((g) => (category ? g.category === category : true))
    .filter(
      (g) =>
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.sellerName.toLowerCase().includes(q),
    );

  return (
    <section aria-label={t.nav.market}>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.key)}
              className={`overflow-hidden rounded-[var(--radius)] border-2 bg-[var(--surface)] text-center transition ${
                active ? "border-[var(--gold)] shadow-md" : "border-[var(--border)]"
              }`}
            >
              <img src={c.img} alt="" className="h-16 w-full object-cover sm:h-20" />
              <span className="block py-2 font-display text-sm font-bold sm:text-base">
                {t.cat[c.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <label className="sr-only" htmlFor="demo-gig-search">
          {t.searchLabel}
        </label>
        <input
          id="demo-gig-search"
          type="search"
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-base"
        />
        <button
          type="button"
          onClick={onPublish}
          className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2.5 font-display text-base font-bold text-[#3b1145]"
        >
          {t.publishCta}
        </button>
      </div>

      {category && (
        <p className="mt-3 text-sm text-[var(--dim)]">
          {t.categoryFilterNote(t.cat[category])}
          <button
            type="button"
            className="font-bold text-[var(--accent)] underline dark:text-[var(--gold)]"
            onClick={() => setCategory(null)}
          >
            {t.showAll}
          </button>
        </p>
      )}

      {gigs.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">{t.emptyGigsTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-[var(--dim)]">{t.emptyGigsSearch}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((gig) => (
            <GigCard key={gig.id} gig={gig} onOpen={onOpen} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      )}
    </section>
  );
}

function DemoGigDetail({
  gigId,
  reviews,
  onBack,
  onOpenProfile,
  onOrdered,
}: {
  gigId: number;
  reviews: DemoReview[];
  onBack: () => void;
  onOpenProfile: (uid: string) => void;
  onOrdered: (order: DemoOrder) => void;
}) {
  const { t, lang } = useI18n();
  const [brief, setBrief] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [payStep, setPayStep] = useState<number | null>(null);
  const [payResult, setPayResult] = useState<{
    paymentRef: string;
    amountPi: number;
    commissionPi: number;
    sellerNetPi: number;
  } | null>(null);
  const [created, setCreated] = useState<DemoOrder | null>(null);

  const gig = DEMO_GIGS.find((g) => g.id === gigId);
  if (!gig) {
    return (
      <div className="py-10 text-center">
        <p className="text-[var(--dim)]">{t.gigNotFound}</p>
        <button type="button" onClick={onBack} className="mt-3 font-bold underline">
          {t.backToMarket}
        </button>
      </div>
    );
  }
  const seller = demoFreelancer(gig.sellerUid);
  const shape = demoGigShape(gig, lang, reviews);
  const commission = Math.round(gig.pricePi * 0.1 * 10000) / 10000;
  const sellerNet = Math.round((gig.pricePi - commission) * 10000) / 10000;

  async function runPayment(e: FormEvent) {
    e.preventDefault();
    if (!gig) return;
    if (brief.trim().length < 5) {
      setFormError(t.briefError);
      return;
    }
    setFormError(null);
    setPayResult(null);
    setCreated(null);
    setPayStep(0);
    await sleep(900);
    setPayStep(1);
    await sleep(900);
    setPayStep(2);
    await sleep(1200);
    setPayStep(3);
    const paymentRef = `demo-${Date.now().toString(36)}`;
    const order: DemoOrder = {
      id: Date.now(),
      gigId: gig.id,
      gigTitle: gig.title,
      source: "gig",
      jobRequestId: null,
      sellerName: seller?.username ?? "—",
      sellerPiUid: gig.sellerUid,
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      brief: { ar: brief.trim(), en: brief.trim() },
      amountPi: gig.pricePi,
      commissionPi: commission,
      sellerNetPi: sellerNet,
      status: "awaiting_delivery",
      paymentRef,
      deliveryNote: null,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      completedAt: null,
      hasReview: false,
      messages: [],
    };
    setCreated(order);
    setPayResult({
      paymentRef,
      amountPi: gig.pricePi,
      commissionPi: commission,
      sellerNetPi: sellerNet,
    });
    setPayStep(4);
  }

  return (
    <section aria-label={shape.title} className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="font-display text-base font-bold text-[var(--accent)] dark:text-[var(--gold)]"
      >
        {t.backToMarket}
      </button>

      <div className="mt-3 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
        <img
          src={CAT_IMG[gig.category]}
          alt={t.catImgAlt(t.cat[gig.category])}
          className="h-48 w-full object-cover sm:h-64"
        />
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-bold">
              {t.cat[gig.category]}
            </span>
            <span className="rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[#3b1145]">
              {t.demoNote}
            </span>
          </div>
          <h2 className="mt-3 font-display text-2xl font-black leading-snug sm:text-3xl">
            {shape.title}
          </h2>
          <p className="mt-2 text-base">
            {t.offeredBy}{" "}
            <button
              type="button"
              onClick={() => onOpenProfile(gig.sellerUid)}
              className="font-bold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
            >
              @{shape.sellerName}
            </button>
            <span className="ms-1.5 rounded-full bg-[var(--gold-soft)] px-2 py-0.5 text-[11px] font-bold text-[#8a5d00] dark:text-[var(--gold)]">
              {t.piAccountBadge}
            </span>
            {shape.avgRating != null && (
              <>
                {" · "}
                <Stars value={shape.avgRating} size="text-sm" />{" "}
                {t.ratingsFrom(shape.avgRating, shape.reviewCount)}
              </>
            )}
            {" · "}
            {t.deliveryIn(gig.deliveryDays)}
          </p>
          <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-[var(--dim)]">
            {shape.description}
          </p>

          <div className="mt-5 rounded-[var(--radius)] bg-[var(--surface-alt)] p-4">
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">{t.totalPrice}</span>
              <span className="font-display text-3xl font-black">{fmtPi(gig.pricePi)}</span>
            </p>
            <p className="mt-2 flex justify-between text-sm text-[var(--dim)]">
              <span>{t.commissionLine}</span>
              <span>{fmtPi(commission)}</span>
            </p>
            <p className="flex justify-between text-sm text-[var(--dim)]">
              <span>{t.sellerNetLine}</span>
              <span>{fmtPi(sellerNet)}</span>
            </p>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed">
              {t.escrowExplain}
            </p>
          </div>

          <form onSubmit={runPayment} className="mt-5 space-y-3">
            <p className="rounded-xl bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold dark:bg-[var(--surface-alt)]">
              {t.demoOrderNote}
            </p>
            <div>
              <label htmlFor="demo-order-brief" className="mb-1 block font-semibold">
                {t.briefLabel}
              </label>
              <textarea
                id="demo-order-brief"
                {...FIELDS.createOrder.brief}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={4}
                placeholder={t.briefPlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
            </div>
            {formError && (
              <p role="alert" className="font-semibold text-[var(--danger)]">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={payStep != null}
              className="w-full rounded-full bg-[var(--gold)] py-3.5 font-display text-lg font-black text-[#3b1145] disabled:opacity-60"
            >
              {t.payBtn(fmtPi(gig.pricePi))}
            </button>
            <p className="text-center text-xs leading-relaxed text-[var(--dim)]">{t.paySimNote}</p>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-display text-xl font-black">{t.reviewsTitle}</h3>
        {reviews.length === 0 && <p className="mt-2 text-[var(--dim)]">{t.noReviews}</p>}
        <ul className="mt-3 space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="flex flex-wrap items-center gap-2">
                <strong>@{r.buyerName}</strong>
                <Stars value={r.rating} size="text-sm" />
                <span className="text-xs text-[var(--dim)]">{fmtDate(r.createdAt, lang)}</span>
              </p>
              <p className="mt-1 leading-relaxed">{tx(r.comment, lang)}</p>
            </li>
          ))}
        </ul>
      </div>

      {payStep != null && (
        <PaymentSheet
          amountPi={gig.pricePi}
          step={payStep}
          result={payResult}
          onDone={() => {
            if (created) onOrdered(created);
          }}
          doneLabel={t.viewMyOrders}
        />
      )}
    </section>
  );
}

function DemoProfile({
  uid,
  reviewsByGig,
  onBack,
  onOpenGig,
}: {
  uid: string;
  reviewsByGig: Record<number, DemoReview[]>;
  onBack: () => void;
  onOpenGig: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const f = demoFreelancer(uid);
  if (!f) {
    return (
      <section aria-label={t.viewProfile} className="mt-5">
        <button
          type="button"
          onClick={onBack}
          className="font-display text-base font-bold text-[var(--accent)] dark:text-[var(--gold)]"
        >
          {t.profileBack}
        </button>
        <p className="py-10 text-center text-[var(--dim)]">{t.profileNotFound}</p>
      </section>
    );
  }
  const gigs = DEMO_GIGS.filter((g) => g.sellerUid === uid);
  const allReviews = gigs.flatMap((g) =>
    (reviewsByGig[g.id] ?? []).map((r) => ({ gig: g, review: r })),
  );
  const avg = demoAvg(allReviews.map((x) => x.review));
  const verifiedBadge = f.completedCount >= 3;

  return (
    <section aria-label={t.viewProfile} className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="font-display text-base font-bold text-[var(--accent)] dark:text-[var(--gold)]"
      >
        {t.profileBack}
      </button>

      <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-display text-2xl font-black text-[var(--gold)] dark:bg-[var(--gold)] dark:text-[#3b1145]">
            {f.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-black">@{f.username}</h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[11px] font-black text-[#3b1145]">
                {t.demoNote}
              </span>
              {verifiedBadge && (
                <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[11px] font-black text-[#3b1145]">
                  ✓ {t.verifiedBadge}
                </span>
              )}
              {f.piVerified && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {t.piVerifiedBadge}
                </span>
              )}
              <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-bold">
                {t.cityInProfile(cityName(f.city, lang))}
              </span>
              <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] font-bold">
                {t.joinedOn(fmtDate(f.joinedAt, lang))}
              </span>
            </div>
            {verifiedBadge && (
              <p className="mt-1 text-xs text-[var(--dim)]">
                {t.verifiedBadgeHint(f.completedCount)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-[var(--surface-alt)] py-3">
            <span className="block font-display text-xl font-black">{f.completedCount}</span>
            <span className="text-xs text-[var(--dim)]">{t.completedOrders}</span>
          </div>
          <div className="rounded-xl bg-[var(--surface-alt)] py-3">
            <span className="block font-display text-xl font-black">{f.totalOrderCount}</span>
            <span className="text-xs text-[var(--dim)]">{t.totalOrders}</span>
          </div>
          <div className="rounded-xl bg-[var(--surface-alt)] py-3">
            <span className="block font-display text-xl font-black">{avg != null ? avg : "—"}</span>
            <span className="text-xs text-[var(--dim)]">
              {avg != null ? (
                <>
                  <Stars value={avg} size="text-xs" /> ({allReviews.length})
                </>
              ) : (
                t.reviewsTitle
              )}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="font-display font-black">{t.bioTitle}</h3>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-[var(--dim)]">
            {tx(f.bio, lang)}
          </p>
        </div>
      </div>

      <h3 className="mt-6 font-display text-xl font-black">{t.portfolioTitle}</h3>
      {f.portfolio.length === 0 ? (
        <p className="mt-2 text-[var(--dim)]">{t.portfolioEmpty}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {f.portfolio.map((item) => (
            <article
              key={item.id}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              {item.category && (
                <img
                  src={CAT_IMG[item.category]}
                  alt={t.catImgAlt(t.cat[item.category])}
                  className="mb-3 h-28 w-full rounded-xl object-cover"
                />
              )}
              <h4 className="font-display font-bold leading-snug">{tx(item.title, lang)}</h4>
              <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">
                {tx(item.description, lang)}
              </p>
              {item.category && (
                <span className="mt-3 inline-block rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold">
                  {t.cat[item.category]}
                </span>
              )}
            </article>
          ))}
        </div>
      )}

      <h3 className="mt-6 font-display text-xl font-black">{t.profileGigsTitle}</h3>
      {gigs.length === 0 ? (
        <p className="mt-2 text-[var(--dim)]">{t.profileNoGigs}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gigs.map((g) => (
            <GigCard
              key={g.id}
              gig={demoGigShape(g, lang, reviewsByGig[g.id] ?? [])}
              onOpen={onOpenGig}
            />
          ))}
        </div>
      )}

      <h3 className="mt-6 font-display text-xl font-black">{t.profileReviewsTitle}</h3>
      {allReviews.length === 0 ? (
        <p className="mt-2 text-[var(--dim)]">{t.noReviews}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {allReviews.map(({ gig, review: r }) => (
            <li
              key={`${gig.id}-${r.id}`}
              className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="flex flex-wrap items-center gap-2">
                <strong>@{r.buyerName}</strong>
                <Stars value={r.rating} size="text-sm" />
                <span className="text-xs text-[var(--dim)]">{fmtDate(r.createdAt, lang)}</span>
                <span className="text-xs text-[var(--dim)]">· {tx(gig.title, lang)}</span>
              </p>
              <p className="mt-1 leading-relaxed">{tx(r.comment, lang)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DemoJobs({
  jobs,
  setJobs,
  onOrdered,
  onOpenProfile,
}: {
  jobs: DemoJob[];
  setJobs: (fn: (js: DemoJob[]) => DemoJob[]) => void;
  onOrdered: (order: DemoOrder) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("design");
  const [budget, setBudget] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) return setError(t.sellErrTitle);
    if (description.trim().length < 10) return setError(t.sellErrDesc);
    const b = Number(budget);
    if (!Number.isFinite(b) || b <= 0) return setError(t.sellErrPrice);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 180) return setError(t.sellErrDays);
    const job: DemoJob = {
      id: Date.now(),
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      title: { ar: title.trim(), en: title.trim() },
      description: { ar: description.trim(), en: description.trim() },
      category,
      budgetPi: b,
      durationDays: d,
      status: "open",
      createdAt: new Date().toISOString(),
      offers: [],
    };
    setJobs((js) => [job, ...js]);
    setPosted(true);
    setTitle("");
    setDescription("");
    setBudget("");
  }

  const updateJob = (updated: DemoJob) =>
    setJobs((js) => js.map((j) => (j.id === updated.id ? updated : j)));

  return (
    <section aria-label={t.nav.jobs} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.jobsTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.jobsSubtitle}</p>

      <div className="mt-4">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full rounded-full bg-[var(--gold)] py-3 font-display text-base font-black text-[#3b1145]"
          >
            + {t.postJobTitle}
          </button>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <h3 className="font-display text-lg font-black">{t.postJobTitle}</h3>
            <p className="rounded-xl bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold dark:bg-[var(--surface-alt)]">
              {t.demoPostJobNote}
            </p>
            {posted && (
              <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {t.jobPosted}
              </p>
            )}
            <div>
              <label htmlFor="demo-job-title" className="mb-1 block font-semibold">
                {t.jobTitleLabel}
              </label>
              <input
                id="demo-job-title"
                {...FIELDS.createJobRequest.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.jobTitlePlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
            </div>
            <div>
              <span className="mb-2 block font-semibold" id="demo-job-category-label">
                {t.gigCategoryLabel}
              </span>
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-labelledby="demo-job-category-label"
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={category === c.key}
                    onClick={() => setCategory(c.key)}
                    className={`overflow-hidden rounded-xl border-2 ${
                      category === c.key ? "border-[var(--gold)]" : "border-[var(--border)]"
                    }`}
                  >
                    <img src={c.img} alt="" className="h-12 w-full object-cover" />
                    <span className="block py-1.5 font-display text-sm font-bold">
                      {t.cat[c.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="demo-job-desc" className="mb-1 block font-semibold">
                {t.jobDescLabel}
              </label>
              <textarea
                id="demo-job-desc"
                {...FIELDS.createJobRequest.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={t.jobDescPlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="demo-job-budget" className="mb-1 block font-semibold">
                  {t.budgetLabel}
                </label>
                <input
                  id="demo-job-budget"
                  {...FIELDS.createJobRequest.budgetPi}
                  type="number"
                  inputMode="decimal"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="30"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
              <div>
                <label htmlFor="demo-job-days" className="mb-1 block font-semibold">
                  {t.durationLabel}
                </label>
                <input
                  id="demo-job-days"
                  {...FIELDS.createJobRequest.durationDays}
                  type="number"
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="font-semibold text-[var(--danger)]">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--gold)] py-3 font-display text-base font-black text-[#3b1145]"
            >
              {t.postJobBtn}
            </button>
          </form>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {jobs.map((job) => (
          <DemoJobCard
            key={job.id}
            job={job}
            onChange={updateJob}
            onOrdered={onOrdered}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </section>
  );
}

function DemoJobCard({
  job,
  onChange,
  onOrdered,
  onOpenProfile,
}: {
  job: DemoJob;
  onChange: (job: DemoJob) => void;
  onOrdered: (order: DemoOrder) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const [showOffers, setShowOffers] = useState(false);
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("3");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offerSent, setOfferSent] = useState(false);
  const [payStep, setPayStep] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payResult, setPayResult] = useState<{
    paymentRef: string;
    amountPi: number;
    commissionPi: number;
    sellerNetPi: number;
  } | null>(null);
  const [created, setCreated] = useState<DemoOrder | null>(null);

  const isOwner = job.buyerPiUid === DEMO_ME.piUid;

  const statusClass =
    job.status === "open"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : job.status === "awarded"
        ? "bg-[var(--gold-soft)] text-[#8a5d00] dark:text-[var(--gold)]"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

  function submitOffer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return setError(t.sellErrPrice);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 180) return setError(t.sellErrDays);
    if (message.trim().length < 5) return setError(t.sellErrDesc);
    const offer: DemoOffer = {
      id: Date.now(),
      sellerName: DEMO_ME.username,
      sellerPiUid: DEMO_ME.piUid,
      pricePi: p,
      deliveryDays: d,
      message: { ar: message.trim(), en: message.trim() },
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    onChange({ ...job, offers: [offer, ...job.offers] });
    setOfferSent(true);
    setPrice("");
    setMessage("");
    setShowOffers(true);
  }

  async function runAccept(offer: DemoOffer) {
    setError(null);
    setPayResult(null);
    setCreated(null);
    setPayAmount(offer.pricePi);
    setPayStep(0);
    await sleep(900);
    setPayStep(1);
    await sleep(900);
    setPayStep(2);
    await sleep(1200);
    setPayStep(3);
    const amountPi = offer.pricePi;
    const commissionPi = Math.round(amountPi * 0.1 * 10000) / 10000;
    const sellerNetPi = Math.round((amountPi - commissionPi) * 10000) / 10000;
    const paymentRef = `demo-${Date.now().toString(36)}`;
    const order: DemoOrder = {
      id: Date.now(),
      gigId: null,
      gigTitle: job.title,
      source: "job_request",
      jobRequestId: job.id,
      sellerName: offer.sellerName,
      sellerPiUid: offer.sellerPiUid,
      buyerName: DEMO_ME.username,
      buyerPiUid: DEMO_ME.piUid,
      brief: job.description,
      amountPi,
      commissionPi,
      sellerNetPi,
      status: "awaiting_delivery",
      paymentRef,
      deliveryNote: null,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      completedAt: null,
      hasReview: false,
      messages: [],
    };
    onChange({
      ...job,
      status: "awarded",
      offers: job.offers.map((o) =>
        o.id === offer.id
          ? { ...o, status: "accepted" as const }
          : o.status === "pending"
            ? { ...o, status: "rejected" as const }
            : o,
      ),
    });
    setCreated(order);
    setPayResult({ paymentRef, amountPi, commissionPi, sellerNetPi });
    setPayStep(4);
  }

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold leading-snug">{tx(job.title, lang)}</h3>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            {t.clientLabel}: {job.buyerPiUid ? `@${job.buyerName}` : job.buyerName} ·{" "}
            {t.cat[job.category]} · {fmtDate(job.createdAt, lang)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}>
          {t.jobStatus[job.status]}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line leading-relaxed text-[var(--dim)]">
        {tx(job.description, lang)}
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-display font-bold">
        <span>{t.budgetLine(fmtPi(job.budgetPi))}</span>
        <span>{t.durationLine(job.durationDays)}</span>
        <span className="text-[var(--dim)]">{t.offersCount(job.offers.length)}</span>
      </p>

      {isOwner && job.status === "open" && (
        <p className="mt-3 rounded-xl bg-[var(--gold-soft)] px-4 py-3 text-sm font-semibold dark:bg-[var(--surface-alt)]">
          {t.yourRequestNote}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-expanded={showOffers}
          onClick={() => setShowOffers((v) => !v)}
          className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
        >
          {showOffers ? t.hideOffers : t.viewOffers} ({job.offers.length})
        </button>
        {isOwner && job.status === "open" && (
          <button
            type="button"
            onClick={() => onChange({ ...job, status: "cancelled" })}
            className="rounded-full border border-[var(--danger)] px-4 py-2 font-display text-sm font-bold text-[var(--danger)]"
          >
            {t.cancelJobBtn}
          </button>
        )}
      </div>

      {showOffers && (
        <div className="mt-4 space-y-3">
          {job.offers.length === 0 && (
            <p className="text-sm text-[var(--dim)]">{t.noOffersYet}</p>
          )}
          {job.offers.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {o.sellerPiUid ? (
                  <button
                    type="button"
                    onClick={() => onOpenProfile(o.sellerPiUid!)}
                    className="font-bold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
                  >
                    @{o.sellerName}
                  </button>
                ) : (
                  <strong>@{o.sellerName}</strong>
                )}
                <span className="font-display font-black">{t.offerPrice(fmtPi(o.pricePi))}</span>
                <span className="text-sm text-[var(--dim)]">{t.offerDays(o.deliveryDays)}</span>
                <span className="text-xs text-[var(--dim)]">{t.offerStatus[o.status]}</span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{tx(o.message, lang)}</p>
              {isOwner && job.status === "open" && o.status === "pending" && (
                <button
                  type="button"
                  disabled={payStep != null}
                  onClick={() => void runAccept(o)}
                  className="mt-3 rounded-full bg-[var(--gold)] px-5 py-2.5 font-display text-sm font-black text-[#3b1145] disabled:opacity-60"
                >
                  {t.acceptOfferBtn}
                </button>
              )}
            </div>
          ))}

          {!isOwner && job.status === "open" &&
            (offerSent ? (
              <p className="rounded-xl bg-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {t.offerSent}
              </p>
            ) : (
              <form
                onSubmit={submitOffer}
                className="space-y-3 rounded-xl bg-[var(--surface-alt)] p-4"
              >
                <p className="font-display font-black">{t.offerFormTitle}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`demo-offer-price-${job.id}`} className="mb-1 block text-sm font-semibold">
                      {t.offerPriceLabel}
                    </label>
                    <input
                      id={`demo-offer-price-${job.id}`}
                      {...FIELDS.createOffer.pricePi}
                      type="number"
                      inputMode="decimal"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor={`demo-offer-days-${job.id}`} className="mb-1 block text-sm font-semibold">
                      {t.offerDaysLabel}
                    </label>
                    <input
                      id={`demo-offer-days-${job.id}`}
                      {...FIELDS.createOffer.deliveryDays}
                      type="number"
                      inputMode="numeric"
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor={`demo-offer-msg-${job.id}`} className="mb-1 block text-sm font-semibold">
                    {t.offerMsgLabel}
                  </label>
                  <textarea
                    id={`demo-offer-msg-${job.id}`}
                    {...FIELDS.createOffer.message}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                    placeholder={t.offerMsgPlaceholder}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-[var(--accent)] px-6 py-2.5 font-display font-bold text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
                >
                  {t.sendOfferBtn}
                </button>
              </form>
            ))}
        </div>
      )}

      {payStep != null && (
        <PaymentSheet
          amountPi={payAmount}
          step={payStep}
          result={payResult}
          onDone={() => {
            if (created) onOrdered(created);
          }}
          doneLabel={t.goToOrder}
        />
      )}
    </article>
  );
}

type DemoOrderFilter = "all" | "buying" | "selling";

function DemoOrders({
  orders,
  updateOrder,
  sendMessage,
  addReview,
  onOpenProfile,
}: {
  orders: DemoOrder[];
  updateOrder: (id: number, patch: Partial<DemoOrder>) => void;
  sendMessage: (orderId: number, body: string) => void;
  addReview: (orderId: number, rating: number, comment: string) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<DemoOrderFilter>("all");
  const visibleOrders = orders.filter((o) => {
    if (filter === "buying") return o.buyerPiUid === DEMO_ME.piUid;
    if (filter === "selling") return o.sellerPiUid === DEMO_ME.piUid;
    return true;
  });

  return (
    <section aria-label={t.nav.orders} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.ordersTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.ordersSubtitle}</p>
      <p className="mt-3 inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[#3b1145]">
        {t.demoNote} · @{DEMO_ME.username}
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t.nav.orders}>
        {(
          [
            { key: "all", label: t.filterAll },
            { key: "buying", label: t.filterBuying(DEMO_ME.username) },
            { key: "selling", label: t.filterSelling(DEMO_ME.username) },
          ] as { key: DemoOrderFilter; label: string }[]
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
              filter === f.key
                ? "bg-[var(--gold)] text-[#3b1145]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visibleOrders.length === 0 && (
        <div className="mt-6 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
          <p className="font-display text-2xl font-black">
            {orders.length === 0 ? t.emptyOrdersTitle : t.emptyOrdersFiltered}
          </p>
          <p className="mt-2 text-[var(--dim)]">
            {orders.length === 0
              ? t.emptyOrdersBody
              : filter === "buying"
                ? t.emptyBuyingBody
                : t.emptySellingBody}
          </p>
        </div>
      )}
      <div className="mt-4 space-y-4">
        {visibleOrders.map((order) => (
          <DemoOrderCard
            key={order.id}
            order={order}
            updateOrder={updateOrder}
            sendMessage={sendMessage}
            addReview={addReview}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
    </section>
  );
}

function DemoChat({
  order,
  sendMessage,
}: {
  order: DemoOrder;
  sendMessage: (orderId: number, body: string) => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [order.messages, open]);

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-[var(--border)] px-4 py-2 font-display text-sm font-bold"
      >
        💬 {t.chatToggle(order.messages.length)}
      </button>
      {open && (
        <div className="mt-3">
          <div
            ref={scrollRef}
            className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-[var(--surface-alt)] p-3"
            aria-label={t.chatTitle}
          >
            {order.messages.length === 0 && (
              <p className="text-sm text-[var(--dim)]">{t.chatEmpty}</p>
            )}
            {order.messages.map((m) => {
              const mine = m.senderPiUid === DEMO_ME.piUid;
              return (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    mine
                      ? "self-end bg-[var(--accent)] text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
                      : "self-start border border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <p className="text-[11px] font-bold opacity-80">
                    @{m.senderName} · {fmtTime(m.createdAt, lang)}
                  </p>
                  <p className="whitespace-pre-line">{tx(m.body, lang)}</p>
                </div>
              );
            })}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              sendMessage(order.id, draft.trim());
              setDraft("");
            }}
          >
            <label className="sr-only" htmlFor={`demo-chat-input-${order.id}`}>
              {t.chatTitle}
            </label>
            <input
              id={`demo-chat-input-${order.id}`}
              {...FIELDS.sendMessage.body}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.chatPlaceholder}
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-2.5 font-display font-black text-[#3b1145] disabled:opacity-60"
            >
              {t.chatSend}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function DemoOrderCard({
  order,
  updateOrder,
  sendMessage,
  addReview,
  onOpenProfile,
}: {
  order: DemoOrder;
  updateOrder: (id: number, patch: Partial<DemoOrder>) => void;
  sendMessage: (orderId: number, body: string) => void;
  addReview: (orderId: number, rating: number, comment: string) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const isBuyer = order.buyerPiUid === DEMO_ME.piUid;
  const isSeller = order.sellerPiUid === DEMO_ME.piUid;
  const [deliveryNote, setDeliveryNote] = useState("");
  const [showDeliver, setShowDeliver] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const now = () => new Date().toISOString();

  return (
    <article className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold leading-snug">{tx(order.gigTitle, lang)}</h3>
          <p className="mt-0.5 text-sm text-[var(--dim)]">
            {t.clientLabel}: {order.buyerPiUid ? `@${order.buyerName}` : order.buyerName} ·{" "}
            {t.freelancerLabel}:{" "}
            {order.sellerPiUid ? (
              <button
                type="button"
                onClick={() => onOpenProfile(order.sellerPiUid!)}
                className="font-semibold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
              >
                @{order.sellerName}
              </button>
            ) : (
              order.sellerName
            )}{" "}
            · {fmtDate(order.createdAt, lang)}
            {order.source === "job_request" && ` · ${t.fromJobRequest}`}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {isBuyer && isSeller ? t.roleBoth : isBuyer ? t.roleBuyer : isSeller ? t.roleSeller : t.roleOutsider}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_CLASS[order.status]}`}
        >
          {t.status[order.status]}
        </span>
      </div>

      <p className="mt-3 rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm leading-relaxed">
        <strong>{t.briefShownLabel}</strong> {tx(order.brief, lang)}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.paidInEscrow}</span>
          <strong className="font-display text-base">{fmtPi(order.amountPi)}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.commissionLine}</span>
          <strong className="font-display text-base">{fmtPi(order.commissionPi)}</strong>
        </div>
        <div className="rounded-xl border border-[var(--border)] py-2.5">
          <span className="block text-xs text-[var(--dim)]">{t.netFreelancer}</span>
          <strong className="font-display text-base">{fmtPi(order.sellerNetPi)}</strong>
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--dim)]">
        {t.paymentRefLabel}{" "}
        <span dir="ltr" className="font-mono">{order.paymentRef}</span>
      </p>

      {order.deliveryNote && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed dark:bg-emerald-950">
          <strong>{t.deliveryNoteShown}</strong> {tx(order.deliveryNote, lang)}
          {order.deliveredAt && (
            <span className="text-[var(--dim)]"> · {fmtDate(order.deliveredAt, lang)}</span>
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {order.status === "awaiting_delivery" && (
        <div className="mt-4">
          {showDeliver && isSeller ? (
            <div className="space-y-2">
              <label htmlFor={`demo-deliver-note-${order.id}`} className="block font-semibold">
                {t.deliverNoteLabel}
              </label>
              <textarea
                id={`demo-deliver-note-${order.id}`}
                {...FIELDS.deliverOrder.deliveryNote}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={2}
                placeholder={t.deliverNotePlaceholder}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!deliveryNote.trim()}
                  onClick={() =>
                    updateOrder(order.id, {
                      status: "delivered",
                      deliveryNote: { ar: deliveryNote.trim(), en: deliveryNote.trim() },
                      deliveredAt: now(),
                    })
                  }
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white disabled:opacity-60 dark:bg-[var(--gold)] dark:text-[#3b1145]"
                >
                  {t.confirmDelivery}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeliver(false)}
                  className="rounded-full border border-[var(--border)] px-5 py-2.5 font-display font-bold"
                >
                  {t.back}
                </button>
              </div>
            </div>
          ) : !isSeller && !isBuyer ? (
            <p className="text-sm text-[var(--dim)]">{t.waitingSeller}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {isSeller && (
                <button
                  type="button"
                  onClick={() => setShowDeliver(true)}
                  className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-display font-bold text-white dark:bg-[var(--gold)] dark:text-[#3b1145]"
                >
                  {t.deliverBtn}
                </button>
              )}
              {isBuyer && (
                <button
                  type="button"
                  onClick={() => updateOrder(order.id, { status: "cancelled" })}
                  className="rounded-full border border-[var(--danger)] px-5 py-2.5 font-display font-bold text-[var(--danger)]"
                >
                  {t.cancelBtn}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {order.status === "delivered" && (
        <div className="mt-4">
          {isBuyer ? (
            <button
              type="button"
              onClick={() =>
                updateOrder(order.id, { status: "completed", completedAt: now() })
              }
              className="rounded-full bg-[var(--success)] px-6 py-3 font-display text-base font-bold text-white"
            >
              {t.approveBtn(fmtPi(order.sellerNetPi))}
            </button>
          ) : (
            <p className="text-sm text-[var(--dim)]">{t.deliveredWaiting}</p>
          )}
        </div>
      )}

      {order.status === "completed" &&
        (order.hasReview ? (
          <p className="mt-4 font-semibold text-[var(--success)]">{t.reviewedDone}</p>
        ) : !isBuyer ? (
          <p className="mt-4 text-sm text-[var(--dim)]">{t.reviewByBuyerOnly}</p>
        ) : (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) {
                setError(t.reviewCommentError);
                return;
              }
              setError(null);
              addReview(order.id, rating, comment.trim());
            }}
          >
            <p className="font-semibold">{t.reviewTitle}</p>
            <div className="flex gap-1" role="radiogroup" aria-label={t.starsLabel}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={t.starLabel(n)}
                  onClick={() => setRating(n)}
                  className={`px-1 text-3xl leading-none ${
                    n <= rating ? "text-[var(--gold)]" : "text-[var(--border)]"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor={`demo-review-comment-${order.id}`}>
              {t.reviewCommentLabel}
            </label>
            <textarea
              id={`demo-review-comment-${order.id}`}
              {...FIELDS.addReview.comment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder={t.reviewPlaceholder}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--gold)] px-6 py-2.5 font-display font-bold text-[#3b1145]"
            >
              {t.publishReview}
            </button>
          </form>
        ))}

      {order.status !== "cancelled" && <DemoChat order={order} sendMessage={sendMessage} />}
    </article>
  );
}

function DemoWallet({ orders }: { orders: DemoOrder[] }) {
  const { t } = useI18n();
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const sold = orders.filter((o) => o.sellerPiUid === DEMO_ME.piUid);
  const bought = orders.filter((o) => o.buyerPiUid === DEMO_ME.piUid);
  const soldDone = sold.filter((o) => o.status === "completed");
  const soldPending = sold.filter(
    (o) => o.status === "awaiting_delivery" || o.status === "delivered",
  );
  const boughtDone = bought.filter((o) => o.status === "completed");
  const boughtPending = bought.filter(
    (o) => o.status === "awaiting_delivery" || o.status === "delivered",
  );
  const w = {
    earnedPi: round(soldDone.reduce((s, o) => s + o.sellerNetPi, 0)),
    commissionPaidPi: round(soldDone.reduce((s, o) => s + o.commissionPi, 0)),
    pendingNetPi: round(soldPending.reduce((s, o) => s + o.sellerNetPi, 0)),
    pendingGrossPi: round(soldPending.reduce((s, o) => s + o.amountPi, 0)),
    soldCompleted: soldDone.length,
    soldPending: soldPending.length,
    spentPi: round(boughtDone.reduce((s, o) => s + o.amountPi, 0)),
    escrowPi: round(boughtPending.reduce((s, o) => s + o.amountPi, 0)),
    boughtCompleted: boughtDone.length,
    boughtPending: boughtPending.length,
  };

  return (
    <section aria-label={t.nav.wallet} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.walletTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.walletSubtitle}</p>
      <p className="mt-3 inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[#3b1145]">
        {t.demoNote} · @{DEMO_ME.username}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg font-black">{t.asFreelancer}</h3>
          <p className="mt-4">
            <span className="block text-sm text-[var(--dim)]">{t.earnedReleased}</span>
            <span className="font-display text-4xl font-black text-[var(--success)]">
              {fmtPi(w.earnedPi)}
            </span>
          </p>
          <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.commissionDeducted}</dt>
              <dd className="font-bold">{fmtPi(w.commissionPaidPi)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.pendingEscrowNet}</dt>
              <dd className="font-bold">{fmtPi(w.pendingNetPi)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.pendingCountLabel}</dt>
              <dd className="font-bold">{w.soldPending}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.completedCountLabel}</dt>
              <dd className="font-bold">{w.soldCompleted}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--dim)]">
            {t.pendingEscrowGross(fmtPi(w.pendingGrossPi))}
          </p>
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg font-black">{t.asClient}</h3>
          <p className="mt-4">
            <span className="block text-sm text-[var(--dim)]">{t.spentTotal}</span>
            <span className="font-display text-4xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
              {fmtPi(w.spentPi)}
            </span>
          </p>
          <dl className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.inEscrowNow}</dt>
              <dd className="font-bold">{fmtPi(w.escrowPi)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.boughtPendingLabel}</dt>
              <dd className="font-bold">{w.boughtPending}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--dim)]">{t.boughtCompletedLabel}</dt>
              <dd className="font-bold">{w.boughtCompleted}</dd>
            </div>
          </dl>
        </div>

        <p className="text-sm leading-relaxed text-[var(--dim)] sm:col-span-2">{t.walletNote}</p>
      </div>
    </section>
  );
}

type DemoPlace = {
  gigId: number;
  title: string;
  category: Category;
  pricePi: number;
  deliveryDays: number;
  sellerName: string;
  sellerPiUid: string;
  city: CityKey;
  avgRating: number | null;
  reviewCount: number;
};

function DemoMap({
  reviewsByGig,
  onOpenGig,
  onOpenProfile,
}: {
  reviewsByGig: Record<number, DemoReview[]>;
  onOpenGig: (id: number) => void;
  onOpenProfile: (uid: string) => void;
}) {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category | null>(null);
  const [view, setView] = useState<ExploreView>("globe");
  const [mapFailed, setMapFailed] = useState(false);
  const [globeFailed, setGlobeFailed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  const all: DemoPlace[] = DEMO_GIGS.flatMap((g) => {
    const f = demoFreelancer(g.sellerUid);
    if (!f) return [];
    const rs = reviewsByGig[g.id] ?? [];
    return [
      {
        gigId: g.id,
        title: tx(g.title, lang),
        category: g.category,
        pricePi: g.pricePi,
        deliveryDays: g.deliveryDays,
        sellerName: f.username,
        sellerPiUid: f.uid,
        city: f.city,
        avgRating: demoAvg(rs),
        reviewCount: rs.length,
      },
    ];
  });
  const filtered = cat ? all.filter((p) => p.category === cat) : all;

  const placed = filtered.map((p, i) => {
    const city = CITY_BY_KEY.get(p.city);
    const sameCityIndex = filtered.slice(0, i).filter((x) => x.city === p.city).length;
    const latOff = sameCityIndex === 0 ? 0 : ((sameCityIndex % 3) - 1) * 0.045;
    const lngOff =
      sameCityIndex === 0 ? 0 : (Math.floor(sameCityIndex / 3) % 3 - 1) * 0.045 + 0.02;
    return {
      place: p,
      lat: (city?.lat ?? 0) + latOff,
      lng: (city?.lng ?? 0) + lngOff,
    };
  });
  const signature = placed.map((x) => x.place.gigId).join(",");

  const selectPlace = (index: number, scroll: boolean) => {
    setSelected(index);
    if (scroll) {
      rowRefs.current[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (view !== "flat" || mapFailed || placed.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        await import("./assets/hatch-maps.js");
        const helpers = await import("./map_helpers.mjs");
        if (cancelled || !containerRef.current) return;
        const rows = rowRefs.current.filter((r): r is HTMLElement => r != null);
        if (rows.length !== placed.length) return;
        helpers.mountPlaceListMap(
          containerRef.current,
          {
            places: placed.map((x) => ({
              label: x.place.title,
              lat: x.lat,
              lng: x.lng,
              locality: cityName(x.place.city, lang),
            })),
            rows,
            baseStyle: "light",
          },
          () => setMapFailed(true),
        );
      } catch {
        if (!cancelled) setMapFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, mapFailed, lang, view]);

  return (
    <section aria-label={t.nav.map} className="mt-5">
      <h2 className="font-display text-2xl font-black">{t.mapTitle}</h2>
      <p className="mt-1 leading-relaxed text-[var(--dim)]">{t.mapSubtitle}</p>
      <p className="mt-3 inline-block rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-black text-[#3b1145]">
        {t.demoNote}
      </p>

      <div
        className="mt-4 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"
        role="group"
        aria-label={t.mapViewLabel}
      >
        <button
          type="button"
          aria-pressed={view === "globe"}
          onClick={() => setView("globe")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            view === "globe" ? "bg-[var(--gold)] text-[#3b1145]" : "text-[var(--dim)]"
          }`}
        >
          {t.mapViewGlobe}
        </button>
        <button
          type="button"
          aria-pressed={view === "flat"}
          onClick={() => setView("flat")}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            view === "flat" ? "bg-[var(--gold)] text-[#3b1145]" : "text-[var(--dim)]"
          }`}
        >
          {t.mapViewFlat}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.gigCategoryLabel}>
        <button
          type="button"
          aria-pressed={cat === null}
          onClick={() => {
            setCat(null);
            setSelected(null);
          }}
          className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
            cat === null
              ? "bg-[var(--gold)] text-[#3b1145]"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
          }`}
        >
          {t.mapAllCats}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={cat === c.key}
            onClick={() => {
              setCat(cat === c.key ? null : c.key);
              setSelected(null);
            }}
            className={`rounded-full px-4 py-2 font-display text-sm font-bold ${
              cat === c.key
                ? "bg-[var(--gold)] text-[#3b1145]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]"
            }`}
          >
            {t.cat[c.key]}
          </button>
        ))}
      </div>

      {view === "globe" && (
        <div className="mt-4">
          {!globeFailed ? (
            <>
              <GlobeView
                places={placed.map((x) => ({ gigId: x.place.gigId, lat: x.lat, lng: x.lng }))}
                selected={selected}
                onSelect={(i) => selectPlace(i, true)}
                onFail={() => setGlobeFailed(true)}
                ariaLabel={t.globeAria}
              />
              <p className="mt-2 text-center text-sm text-[var(--dim)]">{t.globeHint}</p>
            </>
          ) : (
            <p className="rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm font-semibold">
              {t.globeUnavailable}
            </p>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-8 text-center text-[var(--dim)]">{t.mapFilteredEmpty}</p>
      )}

      {placed.length > 0 && (
        <>
          {view === "flat" &&
            (!mapFailed ? (
              <div
                key={signature}
                ref={containerRef}
                className="mt-4 h-[380px] w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] sm:h-[440px]"
                aria-label={t.mapTitle}
              />
            ) : (
              <p className="mt-4 rounded-xl bg-[var(--surface-alt)] px-4 py-3 text-sm font-semibold">
                {t.mapUnavailable}
              </p>
            ))}
          <div className="mt-4 space-y-3">
            {placed.map((x, i) => (
              <article
                key={x.place.gigId}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onClick={() => selectPlace(i, false)}
                className={`cursor-pointer rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 ${
                  selected === i ? "map-selected" : ""
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold leading-snug">
                      <span className="me-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] align-middle font-display text-xs font-black text-white dark:bg-[var(--gold)] dark:text-[#3b1145]">
                        {i + 1}
                      </span>
                      {x.place.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--dim)]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProfile(x.place.sellerPiUid);
                        }}
                        className="font-semibold text-[var(--accent)] underline decoration-dotted dark:text-[var(--gold)]"
                      >
                        @{x.place.sellerName}
                      </button>{" "}
                      · {t.cat[x.place.category]} · {t.cityInProfile(cityName(x.place.city, lang))}
                      {x.place.avgRating != null && (
                        <>
                          {" · "}
                          <Stars value={x.place.avgRating} size="text-xs" /> ({x.place.reviewCount})
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-end">
                    <span className="font-display text-xl font-black text-[var(--accent)] dark:text-[var(--gold)]">
                      {fmtPi(x.place.pricePi)}
                    </span>
                    <span className="block text-xs text-[var(--dim)]">
                      {t.deliveryIn(x.place.deliveryDays)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenGig(x.place.gigId);
                  }}
                  className="mt-3 rounded-full bg-[var(--gold)] px-5 py-2 font-display text-sm font-black text-[#3b1145]"
                >
                  {t.orderNow}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
