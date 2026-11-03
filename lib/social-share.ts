interface SharePayload {
  title: string;
  url: string;
  excerpt?: string | null;
  coverUrl?: string | null;
}

// ১. টেলিগ্রাম চ্যানেলে অটোমেটিক পোস্ট
async function postToTelegram({
  token,
  channelId,
  title,
  url,
  excerpt,
  coverUrl,
}: {
  token: string;
  channelId: string;
  title: string;
  url: string;
  excerpt?: string | null;
  coverUrl?: string | null;
}) {
  try {
    const caption = `📢 <b>${title}</b>\n\n${excerpt ? `${excerpt}\n\n` : ""}👉 বিস্তারিত পড়তে ক্লিক করুন:\n${url}\n\n#SaifulSir #Education #Update`;

    if (coverUrl && coverUrl.startsWith("http")) {
      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelId,
          photo: coverUrl,
          caption: caption,
          parse_mode: "HTML",
        }),
      });
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: channelId,
          text: caption,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });
    }
  } catch (err) {
    console.error("Telegram Auto-Post Error:", err);
  }
}

// ২. ফেসবুক পেজে অটোমেটিক পোস্ট
async function postToFacebook({
  pageId,
  accessToken,
  title,
  url,
  excerpt,
}: {
  pageId: string;
  accessToken: string;
  title: string;
  url: string;
  excerpt?: string | null;
}) {
  try {
    const message = `📢 ${title}\n\n${excerpt ? `${excerpt}\n\n` : ""}সম্পূর্ণ পড়তে লিংকে ক্লিক করুন 👇`;

    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        link: url,
        access_token: accessToken,
      }),
    });

    // 🎯 নতুন যুক্ত করা হয়েছে: ফেসবুক থেকে এরর আসলে তা Vercel লগে দেখাবে
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      console.error("Facebook Auto-Post Failed:", errorData || res.statusText);
    }
    
  } catch (err) {
    console.error("Facebook Auto-Post Network Error:", err);
  }
}

// 🟢 ৩. হোয়াটসঅ্যাপ গ্রুপে অটোমেটিক পোস্ট (Green-API Gateway)
async function postToWhatsAppGroup({
  instanceId,
  apiToken,
  groupId,
  title,
  url,
  excerpt,
  coverUrl,
}: {
  instanceId: string;
  apiToken: string;
  groupId: string;
  title: string;
  url: string;
  excerpt?: string | null;
  coverUrl?: string | null;
}) {
  try {
    const messageText = `📢 *${title}*\n\n${excerpt ? `${excerpt}\n\n` : ""}👉 সম্পূর্ণ পড়তে লিংকে ক্লিক করুন:\n${url}\n\n_SaifulSir.com - শিক্ষার সবকিছু একসাথে_`;

    // ছবি থাকলে ছবিসহ হোয়াটসঅ্যাপ গ্রুপে পাঠাবে
    if (coverUrl && coverUrl.startsWith("http")) {
      await fetch(`https://api.green-api.com/waInstance${instanceId}/sendFileByUrl/${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: groupId,
          urlFile: coverUrl,
          fileName: "post-cover.jpg",
          caption: messageText,
        }),
      });
    } else {
      // শুধু মেসেজ পাঠাবে
      await fetch(`https://api.green-api.com/waInstance${instanceId}/sendMessage/${apiToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: groupId,
          message: messageText,
        }),
      });
    }
  } catch (err) {
    console.error("WhatsApp Auto-Post Error:", err);
  }
}

// 🎯 মূল ব্রডকাস্ট ফাংশন (সব প্ল্যাটফর্মে একসাথে পাঠাবে)
export async function broadcastToSocial({ title, url, excerpt, coverUrl }: SharePayload) {
  const tasks: Promise<any>[] = [];

  // ১. টেলিগ্রাম
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChannel = process.env.TELEGRAM_CHANNEL_ID;
  if (tgToken && tgChannel) {
    tasks.push(postToTelegram({ token: tgToken, channelId: tgChannel, title, url, excerpt, coverUrl }));
  }

  // ২. ফেসবুক
  const fbPageId = process.env.FB_PAGE_ID;
  const fbToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (fbPageId && fbToken) {
    tasks.push(postToFacebook({ pageId: fbPageId, accessToken: fbToken, title, url, excerpt }));
  }

  // ৩. হোয়াটসঅ্যাপ গ্রুপ
  const waInstance = process.env.WHATSAPP_INSTANCE_ID;
  const waToken = process.env.WHATSAPP_API_TOKEN;
  const waGroup = process.env.WHATSAPP_GROUP_ID;
  if (waInstance && waToken && waGroup) {
    tasks.push(postToWhatsAppGroup({
      instanceId: waInstance,
      apiToken: waToken,
      groupId: waGroup,
      title,
      url,
      excerpt,
      coverUrl,
    }));
  }

  await Promise.allSettled(tasks);
}
