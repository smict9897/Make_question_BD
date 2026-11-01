// পেমেন্টের তথ্য: নম্বর বদলাতে হলে শুধু এই ফাইলে বদলাবেন

export const PAYMENT_NUMBER = "01773729897";

export const PAYMENT_TYPE = "Send Money";

export const PAYMENT_METHODS = [
  { id: "bKash", label: "bKash", color: "#e2136e" },
  { id: "Nagad", label: "Nagad", color: "#f6921e" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

export const PAYMENT_STEPS: string[] = [
  `bKash বা Nagad অ্যাপ খুলে "${PAYMENT_TYPE}" সিলেক্ট করুন`,
  `নম্বর: ${PAYMENT_NUMBER}`,
  "প্যাকেজের টাকার পরিমাণ হুবহু পাঠান",
  "পাঠানোর পর পাওয়া Transaction ID (TrxID) কপি করুন",
  "নিচের ফর্মে TrxID ও আপনার নম্বর দিয়ে সাবমিট করুন",
  "অ্যাডমিন যাচাই করলে আপনার Premium চালু হবে",
];

// ===== ফাইল শেষ =====
