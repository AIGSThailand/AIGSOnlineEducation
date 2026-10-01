export function CoursePrice({ price, openAccess = false }: { price?: string | null; openAccess?: boolean }) {
  return (
    <div className="mt-4 text-[var(--text-primary)]">
      <p className="text-lg font-bold">{price || (openAccess ? "Free access" : "Enrollment unavailable")}</p>
      {price && <p className="mt-1 text-xs text-[var(--text-secondary)]">One-time payment</p>}
    </div>
  );
}
