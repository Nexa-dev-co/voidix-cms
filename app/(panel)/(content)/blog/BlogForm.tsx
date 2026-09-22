"use client";

import { useActionState } from "react";

import { createBlogAction, updateBlogAction } from "@/app/(panel)/(content)/blog/actions";
import { ButtonLink } from "@/components/ui/Button";
import { ArticleBodyField, FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface BlogFormValues {
  id?: string;
  slug?: string;
  title: string;
  seoTitle: string;
  excerpt: string;
  category: string;
  publishedOn: string;
  body: string;
}

export function BlogForm({ post }: { post?: BlogFormValues }) {
  const isEditing = Boolean(post?.id);
  const [state, formAction] = useActionState(
    isEditing ? updateBlogAction : createBlogAction,
    IDLE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {post?.id && <input type="hidden" name="id" value={post.id} />}
      <FormMessage status={state.status} message={state.message} />

      {post?.slug && (
        <p className="border-l border-border pl-3 text-xs text-muted">
          Public path: <code className="text-fg">/blog/{post.slug}</code>. It stays stable when the title changes.
        </p>
      )}

      <TextField
        label="Title"
        rendersAs="article headline"
        name="title"
        defaultValue={post?.title ?? ""}
        max={FIELD_LIMITS.blogTitle}
        error={state.fieldErrors.title}
      />
      <TextField
        label="SEO title"
        rendersAs="browser and search title"
        name="seoTitle"
        defaultValue={post?.seoTitle ?? ""}
        max={FIELD_LIMITS.blogSeoTitle}
        error={state.fieldErrors.seoTitle}
      />
      <TextAreaField
        label="Excerpt"
        rendersAs="archive summary and search description"
        name="excerpt"
        defaultValue={post?.excerpt ?? ""}
        max={FIELD_LIMITS.blogExcerpt}
        rows={3}
        error={state.fieldErrors.excerpt}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Category"
          rendersAs="article signal"
          name="category"
          defaultValue={post?.category ?? ""}
          max={FIELD_LIMITS.blogCategory}
          error={state.fieldErrors.category}
        />
        <TextField
          label="Publication date"
          rendersAs="YYYY-MM-DD"
          name="publishedOn"
          defaultValue={post?.publishedOn ?? new Date().toISOString().slice(0, 10)}
          max={10}
          error={state.fieldErrors.publishedOn}
        />
      </div>
      <ArticleBodyField
        name="body"
        defaultValue={post?.body ?? ""}
        maxBlock={FIELD_LIMITS.blogParagraph}
        maxCount={FIELD_LIMITS.blogParagraphCount}
        error={state.fieldErrors.body}
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel={isEditing ? "Saving..." : "Adding..."}>
          {isEditing ? "Save draft" : "Add article"}
        </SubmitButton>
        <ButtonLink href="/blog" variant="ghost">Cancel</ButtonLink>
      </div>
    </form>
  );
}
