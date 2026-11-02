// মোবাইল ড্রয়ারের মেনু ডেটা। মেনু বদলাতে শুধু এই ফাইল এডিট করুন।

export type NavLink = {
  type: "link";
  label: string;
  href: string;
};

export type NavGroup = {
  type: "group";
  label: string;
  children: NavNode[]; // লিংক বা আরেকটা গ্রুপ (নেস্টেড অ্যাকর্ডিয়ন)
};

export type NavNode = NavLink | NavGroup;

const link = (label: string, href: string): NavLink => ({ type: "link", label, href });
const group = (label: string, children: NavNode[]): NavGroup => ({ type: "group", label, children });

export const NAV_ITEMS: NavNode[] = [
  link("হোম", "/"),

  group("শিক্ষক টুলস", [
    group("প্রশ্নপত্র তৈরি", [
      link("ডাটাবেজ থেকে প্রশ্নপত্র তৈরি", "/question-builder"),
      link("AI দিয়ে এক ক্লিকে প্রশ্নপত্র", "/quiz"),
    ]),
    link("মার্কশিট জেনারেটর", "/tools"), // ⚠️ আসল রুট থাকলে বসান
    link("শিক্ষক নিউজ", "/news"), // ⚠️ আসল রুট থাকলে বসান
  ]),

  group("শিক্ষার্থী টুলস", [
    link(" অনলাইন এ পরীক্ষা দাও", "/exam"), // ⚠️ আলাদা রুট থাকলে বসান
    link("একাডেমিক নোটস", "/academic"),
    link("বিশ্ববিদ্যালয় ভর্তি", "/admission"),
    link("ভিডিও লেসন", "/videos"),
    link("মডেল টেস্ট ও এক্সাম", "/model-test"),
  ]),

  group("🎯 মডেল টেস্ট", [
    link("📝 সব মডেল টেস্ট", "/model-test"),
    link("🏆 Global Leaderboard", "/model-test/leaderboard"),
    link("👑 Premium প্যাকেজ", "/packages"),
    link("👤 আমার প্রোফাইল", "/profile"),
  ]),

  group("চাকরি", [
    group("NTRCA শিক্ষক নিবন্ধন", [
      link("স্কুল পর্যায়-২", "/ntrca/school-2"),
      link("স্কুল পর্যায়", "/ntrca/school"),
      link("কলেজ পর্যায়", "/ntrca/college"),
      link("প্রিলিমিনারি প্রস্তুতি", "/ntrca/preli"),
      link("লিখিত প্রস্তুতি", "/ntrca/written"),
    ]),
    link("প্রাথমিক বিদ্যালয় শিক্ষক", "/jobs"), // ⚠️ আসল রুট থাকলে বসান
    link("সকল প্রকার সরকারি চাকরি", "/jobs"),
  ]),

  link("ব্লগ", "/blog"),
  link("সংরক্ষিত বিষয়সমূহ", "/saved"),
];

// ===== ফাইল শেষ =====
