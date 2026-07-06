import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { sanitizeSchema } from "./sanitize";

interface MarkdownPreviewProps {
  children: string;
  className?: string;
}

/**
 * The single sanctioned way to render Markdown in the app. Always runs input
 * through remark-gfm + rehype-sanitize (CLAUDE.md rule 2). Do not render
 * untrusted Markdown any other way.
 */
export function MarkdownPreview({ children, className }: MarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      >
        {children}
      </Markdown>
    </div>
  );
}
