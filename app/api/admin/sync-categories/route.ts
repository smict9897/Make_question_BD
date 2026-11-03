import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { NCTB_CLASSES } from "@/lib/nctb-data";
import { auth } from "@/auth";

function createSlug(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const role = (await auth())?.user?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  try {
    let count = 0;
    for (const classData of NCTB_CLASSES) {
      const classSlug = createSlug(classData.class);
      const parentCategory = await db.category.upsert({
        where: { slug: classSlug },
        update: {},
        create: {
          name: classData.class,
          slug: classSlug,
          parentId: null,
        },
      });

      for (const subject of classData.subjects) {
        const subjectSlug = `${classSlug}-${createSlug(subject.name)}`; 
        await db.category.upsert({
          where: { slug: subjectSlug },
          update: {},
          create: {
            name: subject.name,
            slug: subjectSlug,
            parentId: parentCategory.id,
          },
        });
        count++;
      }
    }
    return NextResponse.json({ ok: true, message: `${count} টি ক্যাটাগরি সফলভাবে যুক্ত হয়েছে।` });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
