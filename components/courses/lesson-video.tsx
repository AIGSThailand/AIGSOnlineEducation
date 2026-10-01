"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { classifyVideoUrl, toEmbedSrc } from "@/lib/utils/video-embed";
import { cn } from "@/lib/utils";

export interface LessonVideoProps {
  url: string;
  title: string;
  className?: string;
  captionsUrl?: string;
  posterUrl?: string;
}

function looksLikeDirectFile(url: string): boolean {
  return (
    /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(url) ||
    (/wp-content\/uploads/i.test(url) && /\.(mp4|webm|m4v|mov)/i.test(url))
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * Primary lesson video.
 * Direct files use an accessible custom control bar over <video>;
 * YouTube/Vimeo/other embeds use provider iframes (native provider chrome).
 */
export function LessonVideo({ url, title, className, captionsUrl, posterUrl }: LessonVideoProps) {
  const kind = classifyVideoUrl(url);
  const embedSrc = toEmbedSrc(url);
  const useNativeVideo = kind === "file" || (kind === "unknown" && looksLikeDirectFile(url));

  if (!useNativeVideo) {
    const iframeSrc = embedSrc || url;
    return (
      <div
        className={cn(
          "aspect-video w-full overflow-hidden rounded-sm bg-[var(--brand-dark)]",
          className
        )}
      >
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

  return (
    <NativeLessonVideo
      url={url}
      title={title}
      className={className}
      captionsUrl={captionsUrl}
      posterUrl={posterUrl}
    />
  );
}

function NativeLessonVideo({
  url,
  title,
  className,
  captionsUrl,
  posterUrl,
}: LessonVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelsId = useId();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [showNativeFallback, setShowNativeFallback] = useState(false);

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
        "pictureInPictureEnabled" in document &&
        !!(document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled
    );
  }, []);

  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
  }, []);

  const seekBy = (delta: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + delta), el.duration || 0);
  };

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch {
      setError("Playback failed. Try again or open the video in a new tab.");
    }
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  const onSeek = (value: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const onSpeed = (rate: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = rate;
    setSpeed(rate);
  };

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  };

  const togglePip = async () => {
    const el = videoRef.current;
    if (!el || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* ignore */
    }
  };

  if (showNativeFallback) {
    return (
      <div className={cn("overflow-hidden rounded-sm bg-black", className)}>
        <video
          className="aspect-video h-auto w-full"
          src={url}
          controls
          playsInline
          preload="metadata"
          poster={posterUrl || undefined}
          controlsList="nodownload"
          title={title}
        >
          {captionsUrl ? (
            <track kind="captions" src={captionsUrl} srcLang="en" label="Captions" default />
          ) : null}
          Your browser does not support embedded video.{" "}
          <a href={url} className="underline">
            Open video
          </a>
        </video>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "group relative overflow-hidden rounded-sm bg-[var(--brand-dark)] text-white",
        className
      )}
    >
      <video
        ref={videoRef}
        className="aspect-video h-auto w-full"
        src={url}
        playsInline
        preload="metadata"
        poster={posterUrl || undefined}
        title={title}
        aria-describedby={`${labelsId}-status`}
        onClick={() => void togglePlay()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => {
          setLoading(false);
          setError(null);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setLoading(false);
        }}
        onTimeUpdate={onTimeUpdate}
        onError={() => {
          setLoading(false);
          setError("This video could not be loaded.");
        }}
      >
        {captionsUrl ? (
          <track kind="captions" src={captionsUrl} srcLang="en" label="Captions" default />
        ) : null}
      </video>

      <div id={`${labelsId}-status`} className="sr-only" aria-live="polite">
        {loading ? "Loading video" : error ? error : playing ? "Playing" : "Paused"}
      </div>

      {loading && !error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium">
          Loading video…
        </div>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center text-sm">
          <p>{error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={url}
              className="rounded-sm bg-white px-3 py-2 text-sm font-bold text-[var(--brand-chrome)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open video
            </a>
            <button
              type="button"
              className="rounded-sm border border-white/40 px-3 py-2 text-sm font-bold"
              onClick={() => setShowNativeFallback(true)}
            >
              Use browser controls
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-3 pt-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <label className="sr-only" htmlFor={`${labelsId}-seek`}>
          Seek
        </label>
        <input
          id={`${labelsId}-seek`}
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="mb-2 h-1.5 w-full cursor-pointer accent-[var(--brand-primary)]"
        />
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <ControlBtn label={playing ? "Pause" : "Play"} onClick={() => void togglePlay()}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </ControlBtn>
          <ControlBtn label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </ControlBtn>
          <ControlBtn label="Back 10 seconds" onClick={() => seekBy(-10)}>
            <RotateCcw className="h-4 w-4" />
          </ControlBtn>
          <span className="px-1 text-xs tabular-nums text-white/90">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <ControlBtn label="Forward 10 seconds" onClick={() => seekBy(10)}>
            <RotateCw className="h-4 w-4" />
          </ControlBtn>
          <div className="ml-auto flex items-center gap-1.5">
            <label className="sr-only" htmlFor={`${labelsId}-speed`}>
              Playback speed
            </label>
            <select
              id={`${labelsId}-speed`}
              value={speed}
              onChange={(e) => onSpeed(Number(e.target.value))}
              className="h-8 rounded-sm border border-white/20 bg-black/40 px-1.5 text-xs text-white"
            >
              {SPEEDS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
            {pipSupported ? (
              <ControlBtn label="Picture in picture" onClick={() => void togglePip()}>
                <PictureInPicture2 className="h-4 w-4" />
              </ControlBtn>
            ) : null}
            <ControlBtn
              label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </ControlBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}
