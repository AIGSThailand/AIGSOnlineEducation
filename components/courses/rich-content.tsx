import { cn } from "@/lib/utils";
import { wordpressContentToHtml } from "@/lib/utils/wordpress-content";

interface RichContentProps {
  html: string | null | undefined;
  className?: string;
  fallback?: string;
}

/**
 * Renders LearnDash / WordPress HTML content (paragraphs, lists, images).
 */
export function RichContent({ html, className, fallback }: RichContentProps) {
  const clean = wordpressContentToHtml(html);

  if (!clean) {
    return fallback ? (
      <p className={cn("text-sm italic text-slate-400", className)}>{fallback}</p>
    ) : null;
  }

  return (
    <div className={cn("rich-content", className)} dangerouslySetInnerHTML={{ __html: clean }} />
  );
}
