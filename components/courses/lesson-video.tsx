import { classifyVideoUrl, toEmbedSrc } from "@/lib/utils/video-embed";
import { cn } from "@/lib/utils";

interface LessonVideoProps {
  url: string;
  title: string;
  className?: string;
}

function looksLikeDirectFile(url: string): boolean {
  return (
    /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(url) ||
    (/wp-content\/uploads/i.test(url) && /\.(mp4|webm|m4v|mov)/i.test(url))
  );
}

/**
 * Renders the lesson primary video.
 * Direct MP4/WebM (etc.) use <video>; YouTube/Vimeo/other embeds use <iframe>.
 * Putting a file URL in an iframe typically causes a download instead of playback.
 */
export function LessonVideo({ url, title, className }: LessonVideoProps) {
  const kind = classifyVideoUrl(url);
  const embedSrc = toEmbedSrc(url);
  const useNativeVideo = kind === "file" || (kind === "unknown" && looksLikeDirectFile(url));

  if (useNativeVideo) {
    return (
      <div className={cn("overflow-hidden rounded-lg bg-black", className)}>
        <video
          className="aspect-video h-auto w-full"
          src={url}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          title={title}
        >
          Your browser does not support embedded video.{" "}
          <a href={url} className="underline">
            Open video
          </a>
        </video>
      </div>
    );
  }

  const iframeSrc = embedSrc || url;

  return (
    <div className={cn("aspect-video w-full overflow-hidden rounded-lg bg-black", className)}>
      <iframe
        src={iframeSrc}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
