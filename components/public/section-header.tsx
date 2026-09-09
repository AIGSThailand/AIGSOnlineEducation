import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
  headingLevel?: "h1" | "h2" | "h3";
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
  headingLevel = "h2",
}: SectionHeaderProps) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "mb-10 flex flex-col gap-6 sm:mb-12",
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className={cn(align === "center" && "max-w-2xl")}>
        {eyebrow ? <p className="public-eyebrow">{eyebrow}</p> : null}
        <Heading
          className={cn(
            "font-semibold tracking-tight text-[var(--text-primary)]",
            eyebrow ? "mt-3" : null,
            headingLevel === "h1" && "font-display text-4xl sm:text-5xl lg:text-6xl",
            headingLevel === "h2" && "text-3xl sm:text-4xl",
            headingLevel === "h3" && "text-2xl sm:text-3xl"
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p
            className={cn(
              "mt-4 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg sm:leading-8",
              align === "center" && "mx-auto"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
