import { BlogForm } from "@/app/(panel)/(content)/blog/BlogForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewBlogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title="Add an article"
        description="The title creates a stable public URL. The archive order, not the date, decides which story leads."
      />
      <BlogForm />
    </>
  );
}
