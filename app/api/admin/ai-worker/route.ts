import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NCTB_CLASSES } from "@/lib/nctb-data";

export const maxDuration = 60; 
export const dynamic = "force-dynamic";

// CQ-তে সময় বাঁচাতে প্রতি অংশে ৩টি (ai-agent ফাইলেও একই সংখ্যা থাকবে)
const CQ_PER_PART = 3;
const SQ_PER_PART = 10;

function cleanOptionText(text: string) {
  if (!text) return "";
  return text.replace(/[✓✔☑]/g, "").replace(/\[?(উত্তর|Ans|সঠিক|Correct).*?\]?/gi, "").replace(/\s+/g, " ").trim();
}

function normDifficulty(d: unknown): "EASY" | "MEDIUM" | "HARD" {
  const v = String(d ?? "").toUpperCase();
  return v === "EASY" || v === "HARD" ? v : "MEDIUM";
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// NCTB ডাটা থেকে বিষয়ের অধ্যায়/টপিকের তালিকা বের করা
function chapterListFor(category?: string | null, subject?: string | null): string[] {
  if (!category || !subject) return [];
  const classes = NCTB_CLASSES as any[];
  const cls =
    classes.find((c) => c.class === category) ||
    classes.find((c) => c.class === `Class ${category}`);
  const sub = cls?.subjects?.find((x: any) => x.name === subject);
  if (!sub) return [];
  const direct: string[] = Array.isArray(sub.chapters) ? sub.chapters : [];
  if (direct.length) return direct;
  const groups: any[] = Array.isArray(sub.subCategories) ? sub.subCategories : [];
  return groups.flatMap((g) => (Array.isArray(g.topics) ? g.topics : []));
}

// AI-র দেওয়া অধ্যায়ের নাম তালিকার সাথে মেলানো
function pickChapter(raw: unknown, list: string[], fallback: string): string {
  const r = s(raw);
  if (!r) return fallback;
  if (!list.length) return r;
  if (list.includes(r)) return r;
  const near = list.find((c) => c.includes(r) || r.includes(c));
  return near || fallback;
}

export async function GET() {
  let currentTaskId = null;

  try {
    // ১. আটকে থাকা টাস্ক রিসেট
    const oneMinAgo = new Date(Date.now() - 1 * 60 * 1000);
    await db.aiTask.updateMany({
      where: { status: "PROCESSING", updatedAt: { lt: oneMinAgo } },
      data: { status: "PENDING" }
    });

    // ২. নতুন টাস্ক খোঁজা
    const task = await db.aiTask.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }
    });

    if (!task) return new NextResponse("No Task", { status: 200 });

    currentTaskId = task.id;
    await db.aiTask.update({ where: { id: task.id }, data: { status: "PROCESSING" } });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY সেট করা নেই!");

    // টাস্কের ধরন: BLOG / CQ / SQ / (বাকি সব = MCQ)
    const kind: "BLOG" | "CQ" | "SQ" | "MCQ" =
      task.type === "BLOG" ? "BLOG" : task.type === "CQ" ? "CQ" : task.type === "SQ" ? "SQ" : "MCQ";

    // 🎯 গণিত/উচ্চতর গণিতের সৃজনশীলে ৩ অংশ (ক, খ, গ); বাকি বিষয়ে ৪ অংশ
    const isMath = /গণিত|math/i.test(task.subject || "");
    const cqThree = kind === "CQ" && isMath;

    // অধ্যায় বাছা না থাকলে AI নিজে প্রতিটি প্রশ্নের অধ্যায় বলবে
    const isAll = !task.topic || task.topic.trim() === "সকল অধ্যায়";
    const chapters = isAll ? chapterListFor(task.category, task.subject) : [];

    let systemPrompt = "";
    let existingQs: any[] = []; 
    const contextText = `Class: ${task.category || "Not specified"}, Subject: ${task.subject || "Not specified"}, Topic: ${task.topic || task.prompt}`;

    // 🎯 বাড়তি নির্দেশনা (অধ্যায় বাছা থাকলেও এখন কাজ করবে)
    const topicLabel = (task.topic || task.prompt || "").trim();
    const extra = (task.prompt || "").trim();
    const extraText =
      extra && extra !== topicLabel
        ? `ADDITIONAL INSTRUCTIONS FROM THE ADMIN (follow these carefully): ${extra}`
        : "";

    // 🎯 অধ্যায়ের নাম বলার নির্দেশ (শুধু অধ্যায় না বাছলে)
    const chapterRule = isAll
      ? chapters.length > 0
        ? `Each question MUST include a "chapter" field. Copy the chapter name EXACTLY (character by character) from this list, choosing the chapter the question truly belongs to. Spread the questions across different chapters:\n${chapters.map((c) => "- " + c).join("\n")}`
        : `Each question MUST include a "chapter" field with the Bengali name of the chapter it belongs to.`
      : "";
    const chapterJson = isAll ? `, "chapter": "অধ্যায়ের নাম"` : "";

    if (kind === "BLOG") {
      // ব্লগের জন্য প্রম্পট
      let partInstruction = "";
      if (task.part === 1) partInstruction = `Write Part 1 (approx 700 words): Introduction, basic concepts.`;
      else if (task.part === 2) partInstruction = `Write Part 2 (approx 700 words): Techniques and examples.`;
      else partInstruction = `Write Part 3 (approx 600 words): Practice problems and conclusion.`;

      systemPrompt = `You are an expert Bengali blogger. Write a detailed blog post for: "${contextText}". ${partInstruction} Return ONLY a valid JSON object: { "title": "...", "slug": "...", "body": "<h2>...</h2><p>...</p>", "tags": "tag1, tag2", "focusKeyword": "...", "keywords": "kw1, kw2", "metaTitle": "...", "metaDescription": "..." }`;
    } else {
      // 🎯 আগের প্রশ্নগুলো ফেচ করা (একই ধরনের প্রশ্ন)
      existingQs = await db.question.findMany({
        where: { 
          topic: isAll ? undefined : task.topic || undefined, 
          subject: task.subject || undefined, 
          category: task.category || undefined,
          ...(kind === "MCQ" ? { correct: { not: "" } } : { correct: "" })
        },
        select: { text: true }, take: kind === "MCQ" ? 150 : 80, orderBy: { createdAt: "desc" }
      });

      if (kind === "MCQ") {
        const avoidText = existingQs.length > 0 
          ? `CRITICAL WARNING: The following questions ALREADY EXIST in our database. You MUST NOT generate any of them again. Generate completely new and different questions:\n${existingQs.map(q => q.text).join("\n")}` 
          : "";

        // 🎯 ৩ ধরনের প্রশ্ন তৈরির কড়াকড়ি নির্দেশনা
        systemPrompt = `You are an expert Bangladeshi teacher. Generate exactly 10 high-quality MCQs for: "${contextText}". 
      This is part ${task.part} of ${task.totalParts}. 
      
      ${avoidText}

      ${extraText}

      ${chapterRule}
      
      YOU MUST FOLLOW THIS EXACT DISTRIBUTION:
      - 6 Direct Questions (সাধারণ প্রশ্ন): Just a question and 4 options.
      - 2 Stimulus-based Questions (উদ্দীপকভিত্তিক): Provide a short stimulus text (উদ্দীপক), followed by a question. Format the "text" field strictly as: "উদ্দীপক: [stimulus text]\\n\\nপ্রশ্ন: [question]"
      - 2 Information-based Questions (অভিন্ন তথ্যভিত্তিক): Give statements i, ii, iii and ask "নিচের কোনটি সঠিক?". Format the "text" field strictly as: "i. [statement 1]\\nii. [statement 2]\\niii. [statement 3]\\n\\nনিচের কোনটি সঠিক?"

      CRITICAL RULES:
      1. DO NOT put any checkmarks (✓, ✔), asterisks, or text like "উত্তর", "সঠিক", "Ans" inside the option texts (A, B, C, D).
      2. Ensure the options A, B, C, D are completely different from previous questions.
      3. Cover DIFFERENT parts of the syllabus.
      4. DO NOT break the JSON format.
      
      Return ONLY a valid JSON object: { "questions": [ { "text": "প্রশ্ন", "options": { "A": "ক", "B": "খ", "C": "গ", "D": "ঘ" }, "correct": "A", "explanation": "ব্যাখ্যা", "difficulty": "EASY" | "MEDIUM" | "HARD"${chapterJson} } ] }`;
      } else if (kind === "CQ") {
        const avoidText = existingQs.length > 0
          ? `The following questions ALREADY EXIST. Do NOT repeat them or use the same stimulus. Create completely new ones:\n${existingQs.map(q => q.text.slice(0, 120)).join("\n")}`
          : "";

        if (cqThree) {
          // 🎯 গণিত: ৩ অংশ (ক-২, খ-৪, গ-৪)
          systemPrompt = `You are an expert Bangladeshi mathematics teacher who writes NCTB-style creative questions (সৃজনশীল প্রশ্ন) for Mathematics. Generate exactly ${CQ_PER_PART} creative math questions for: "${contextText}".
      This is part ${task.part} of ${task.totalParts}.

      ${avoidText}

      ${extraText}

      ${chapterRule}

      In Mathematics, EACH creative question has ONLY THREE sub-questions (NO fourth part). Each question MUST have:
      - "stimulus": a short, original mathematical stimulus (উদ্দীপক) in Bengali: an expression, equation, a geometric figure described in words, a real-life numeric situation or a data set related to the topic.
      - "k" (ক): 2 marks. A definition, formula, or a very simple calculation.
      - "kh" (খ): 4 marks. A problem to solve using the stimulus.
      - "g" (গ): 4 marks. A more complex problem or a proof using the stimulus and the previous parts.
      - "answers": a model answer for each of k, kh, g. k: 1-2 lines. kh and g: complete step-by-step solutions, each step on a new line.

      CRITICAL RULES:
      1. Write everything in Bengali (use Bengali digits where natural).
      2. Write math using plain Unicode symbols (for example x², √, ½, π, ∠, △). Do NOT use LaTeX or dollar signs.
      3. The numbers and calculations MUST be correct and solvable.
      4. Cover DIFFERENT parts of the syllabus in each question.
      5. DO NOT include any "gh" or "ঘ" field.
      6. DO NOT break the JSON format.

      Return ONLY a valid JSON object: { "questions": [ { "stimulus": "উদ্দীপক", "k": "ক-এর প্রশ্ন", "kh": "খ-এর প্রশ্ন", "g": "গ-এর প্রশ্ন", "answers": { "k": "...", "kh": "...", "g": "..." }, "difficulty": "EASY" | "MEDIUM" | "HARD"${chapterJson} } ] }`;
        } else {
          systemPrompt = `You are an expert Bangladeshi teacher who writes NCTB-style creative questions (সৃজনশীল প্রশ্ন). Generate exactly ${CQ_PER_PART} creative questions for: "${contextText}".
      This is part ${task.part} of ${task.totalParts}.

      ${avoidText}

      ${extraText}

      ${chapterRule}

      EACH creative question MUST have:
      - "stimulus": a short, original stimulus (উদ্দীপক) of 3-5 lines in Bengali (a real-life scenario, passage, data or situation related to the topic).
      - "k" (ক): a knowledge-based question (জ্ঞানমূলক), 1 mark, directly from the textbook.
      - "kh" (খ): a comprehension-based question (অনুধাবনমূলক), 2 marks.
      - "g" (গ): an application-based question (প্রয়োগমূলক), 3 marks, must use the stimulus.
      - "gh" (ঘ): a higher-order thinking question (উচ্চতর দক্ষতামূলক), 4 marks, analysis/evaluation using the stimulus.
      - "answers": a short model answer for each of k, kh, g, gh. Keep k answer to 1 line, kh to 2-3 lines, g and gh to about 40-60 words each.

      CRITICAL RULES:
      1. Write everything in Bengali.
      2. Cover DIFFERENT parts of the syllabus in each question.
      3. DO NOT break the JSON format.

      Return ONLY a valid JSON object: { "questions": [ { "stimulus": "উদ্দীপক", "k": "ক-এর প্রশ্ন", "kh": "খ-এর প্রশ্ন", "g": "গ-এর প্রশ্ন", "gh": "ঘ-এর প্রশ্ন", "answers": { "k": "...", "kh": "...", "g": "...", "gh": "..." }, "difficulty": "EASY" | "MEDIUM" | "HARD"${chapterJson} } ] }`;
        }
      } else {
        const avoidText = existingQs.length > 0
          ? `The following questions ALREADY EXIST. Do NOT repeat them. Create completely new and different questions:\n${existingQs.map(q => q.text.slice(0, 120)).join("\n")}`
          : "";

        systemPrompt = `You are an expert Bangladeshi teacher. Generate exactly ${SQ_PER_PART} short-answer questions (সংক্ষিপ্ত প্রশ্ন) for: "${contextText}".
      This is part ${task.part} of ${task.totalParts}.

      ${avoidText}

      ${extraText}

      ${chapterRule}

      RULES:
      1. Each question must be clear and answerable in 2-4 lines (e.g. "...কী?", "...কাকে বলে?", "...ব্যাখ্যা করো", "...পার্থক্য লেখো").
      2. Give a short model answer for each question (1-3 sentences, under 40 words).
      3. Write everything in Bengali.
      4. Cover DIFFERENT parts of the syllabus.
      5. DO NOT break the JSON format.

      Return ONLY a valid JSON object: { "questions": [ { "text": "প্রশ্ন", "answer": "নমুনা উত্তর", "difficulty": "EASY" | "MEDIUM" | "HARD"${chapterJson} } ] }`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), kind === "CQ" ? 50000 : 45000); 

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: "Output ONLY valid JSON." }, { role: "user", content: systemPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.8, // ভ্যারাইটি বাড়ানোর জন্য
        max_tokens: kind === "CQ" ? 6500 : 5000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`DeepSeek API Error: ${await res.text()}`);

    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI থেকে কোনো উত্তর পাওয়া যায়নি।");

    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(content);

    let categoryId = null;
    if (task.category) {
      const existingCategory = await db.category.findFirst({ where: { name: task.category } });
      if (existingCategory) categoryId = existingCategory.id;
      else {
        const newCategory = await db.category.create({ data: { name: task.category, slug: task.category.toLowerCase().replace(/\s+/g, '-') + "-" + Date.now() } });
        categoryId = newCategory.id;
      }
    }

    if (kind === "BLOG") {
      // ব্লগ সেভ
      const tagsArray = typeof parsed.tags === 'string' ? parsed.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
      const keywordsArray = typeof parsed.keywords === 'string' ? parsed.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [];

      let savedPostId = task.postId;
      if (task.part === 1) {
        const newPost = await db.post.create({
          data: { title: parsed.title, slug: parsed.slug + "-" + Date.now(), body: parsed.body, tags: tagsArray, keywords: keywordsArray, categoryId: categoryId, focusKeyword: parsed.focusKeyword, metaTitle: parsed.metaTitle, metaDescription: parsed.metaDescription, published: false }
        });
        savedPostId = newPost.id;
        if (task.batchId) {
          await db.aiTask.updateMany({ where: { batchId: task.batchId, status: "PENDING" }, data: { postId: savedPostId } });
        }
      } else if (savedPostId) {
        const existingPost = await db.post.findUnique({ where: { id: savedPostId } });
        if (existingPost) {
          await db.post.update({ where: { id: savedPostId }, data: { body: existingPost.body + "\n" + parsed.body } });
        }
      }
    } else if (kind === "MCQ") {
      // 🎯 MCQ সেভ
      const questionsList = parsed.questions || parsed.mcqs || [];
      if (!Array.isArray(questionsList) || questionsList.length === 0) throw new Error("AI সঠিকভাবে কোনো প্রশ্ন তৈরি করতে পারেনি।");

      const existingTexts = new Set(existingQs.map(q => q.text.trim().toLowerCase()));
      
      const uniqueQuestions = questionsList.filter((q: any) => {
        const qText = (q.text || q.question || "").trim().toLowerCase();
        if (existingTexts.has(qText)) return false;
        existingTexts.add(qText);
        return true;
      });

      if (uniqueQuestions.length === 0) throw new Error("AI শুধু পুরোনো প্রশ্নই দিয়েছে। নতুন প্রশ্ন পেতে আবার চেষ্টা করুন।");

      await (db.question.createMany as any)({
        data: uniqueQuestions.map((q: any) => ({
          text: q.text || q.question || "প্রশ্ন",
          options: { 
            A: cleanOptionText(q.options?.A || ""), 
            B: cleanOptionText(q.options?.B || ""), 
            C: cleanOptionText(q.options?.C || ""), 
            D: cleanOptionText(q.options?.D || "") 
          },
          correct: q.correct || "A",
          explanation: q.explanation || "",
          category: task.category || "সাধারণ", 
          subject: task.subject || "সাধারণ", 
          topic: isAll ? pickChapter(q.chapter, chapters, "সাধারণ") : (task.topic as string),
          difficulty: (q.difficulty && ["EASY", "MEDIUM", "HARD"].includes(String(q.difficulty).toUpperCase())) ? String(q.difficulty).toUpperCase() : "MEDIUM", 
          lang: "Bangla", 
          approved: false, 
          source: "AI_GENERATOR"
        }))
      });
    } else if (kind === "CQ") {
      // 🎯 CQ (সৃজনশীল) সেভ
      const rawList = parsed.questions || parsed.cqs || [];
      if (!Array.isArray(rawList) || rawList.length === 0) throw new Error("AI সঠিকভাবে কোনো সৃজনশীল প্রশ্ন তৈরি করতে পারেনি।");

      const existingTexts = new Set(existingQs.map(q => q.text.trim().toLowerCase()));

      const valid = rawList
        .map((q: any) => {
          const a = q.answers || q.ans || {};
          return {
            stimulus: s(q.stimulus ?? q.text),
            k: s(q.k ?? q["ক"]),
            kh: s(q.kh ?? q["খ"]),
            g: s(q.g ?? q["গ"]),
            gh: s(q.gh ?? q["ঘ"]),
            ak: s(a.k ?? a["ক"]),
            akh: s(a.kh ?? a["খ"]),
            ag: s(a.g ?? a["গ"]),
            agh: s(a.gh ?? a["ঘ"]),
            difficulty: q.difficulty,
            chapter: q.chapter,
          };
        })
        .filter((v: any) => {
          // গণিতে ঘ লাগে না; বাকি বিষয়ে চারটিই লাগবে
          if (!v.stimulus || !v.k || !v.kh || !v.g) return false;
          if (!cqThree && !v.gh) return false;
          const key = v.stimulus.toLowerCase();
          if (existingTexts.has(key)) return false;
          existingTexts.add(key);
          return true;
        });

      if (valid.length === 0) throw new Error("AI সম্পূর্ণ সৃজনশীল প্রশ্ন দিতে পারেনি। আবার চেষ্টা করুন।");

      await (db.question.createMany as any)({
        data: valid.map((v: any) => ({
          text: v.stimulus,
          options: cqThree
            ? {
                stimulus: v.stimulus,
                "ক": v.k,
                "খ": v.kh,
                "গ": v.g,
                ans: { "ক": v.ak, "খ": v.akh, "গ": v.ag },
              }
            : {
                stimulus: v.stimulus,
                "ক": v.k,
                "খ": v.kh,
                "গ": v.g,
                "ঘ": v.gh,
                ans: { "ক": v.ak, "খ": v.akh, "গ": v.ag, "ঘ": v.agh },
              },
          correct: "",
          explanation: "",
          category: task.category || "সাধারণ",
          subject: task.subject || "সাধারণ",
          topic: isAll ? pickChapter(v.chapter, chapters, "সাধারণ") : (task.topic as string),
          difficulty: normDifficulty(v.difficulty),
          lang: "Bangla",
          approved: false,
          source: "AI_GENERATOR",
        })),
      });
    } else {
      // 🎯 SQ (সংক্ষিপ্ত) সেভ
      const rawList = parsed.questions || parsed.sqs || [];
      if (!Array.isArray(rawList) || rawList.length === 0) throw new Error("AI সঠিকভাবে কোনো সংক্ষিপ্ত প্রশ্ন তৈরি করতে পারেনি।");

      const existingTexts = new Set(existingQs.map(q => q.text.trim().toLowerCase()));

      const valid = rawList
        .map((q: any) => ({
          text: s(q.text ?? q.question),
          answer: s(q.answer ?? q.ans),
          difficulty: q.difficulty,
          chapter: q.chapter,
        }))
        .filter((v: any) => {
          if (!v.text) return false;
          const key = v.text.toLowerCase();
          if (existingTexts.has(key)) return false;
          existingTexts.add(key);
          return true;
        });

      if (valid.length === 0) throw new Error("AI শুধু পুরোনো প্রশ্নই দিয়েছে। নতুন প্রশ্ন পেতে আবার চেষ্টা করুন।");

      await (db.question.createMany as any)({
        data: valid.map((v: any) => ({
          text: v.text,
          options: { answer: v.answer },
          correct: "",
          explanation: v.answer,
          category: task.category || "সাধারণ",
          subject: task.subject || "সাধারণ",
          topic: isAll ? pickChapter(v.chapter, chapters, "সাধারণ") : (task.topic as string),
          difficulty: normDifficulty(v.difficulty),
          lang: "Bangla",
          approved: false,
          source: "AI_GENERATOR",
        })),
      });
    }

    await db.aiTask.update({ where: { id: task.id }, data: { status: "COMPLETED" } });
    return new NextResponse("সফলভাবে কাজ সম্পন্ন হয়েছে!", { status: 200 }); 

  } catch (error: any) {
    console.error("Worker Error:", error.message);
    if (currentTaskId) await db.aiTask.update({ where: { id: currentTaskId }, data: { status: "FAILED" } }).catch(() => {});
    return new NextResponse(`Error: ${error.message}`, { status: 500 }); 
  }
}

// ===== ফাইল শেষ =====
