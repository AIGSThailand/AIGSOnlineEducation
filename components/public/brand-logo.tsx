import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGOS = {
  default: { src: "/brand/aigs-logo.png", width: 168, height: 40 },
  white: { src: "/brand/aigs-logo-white.png", width: 168, height: 40 },
  mark: { src: "/brand/aigs-mark.png", width: 36, height: 36 },
} as const;

type BrandLogoProps = {
  variant?: keyof typeof LOGOS;
  className?: string;
  priority?: boolean;
};

/**
 * Place PNGs in `public/brand/`:
 * - aigs-logo.png
 * - aigs-logo-white.png
 * - aigs-mark.png
 */
export function BrandLogo({ variant = "default", className, priority = false }: BrandLogoProps) {
  const logo = LOGOS[variant];
  return (
    <Image
      src={logo.src}
      alt="AIGS Online Education"
      width={logo.width}
      height={logo.height}
      priority={priority}
      className={cn("h-9 w-auto", className)}
    />
  );
}
