import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogPage } from "@/components/landing/blog-page";
import { getAllCategories, getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | Proppi",
  description:
    "Tips, guides, and industry insights to help you create stunning property listings. Learn from experts and elevate your real estate photography.",
};

export default function Blog() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  return (
    <Suspense>
      <BlogPage categories={categories} posts={posts} />
    </Suspense>
  );
}
