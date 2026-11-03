import { db } from "@/lib/db";
import PostForm from "@/components/post-form";
export const dynamic = "force-dynamic";

export default async function Page() {
  // 👇 শুধু এখানে slug: true যোগ করা হয়েছে
  const cats = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">New post</h1>
      <PostForm cats={cats} />
    </div>
  );
}
