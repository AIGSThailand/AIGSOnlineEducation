import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="flex items-center justify-between p-6">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{title}</p>
        <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{value}</p>
        {description && <p className="text-xs text-[var(--text-secondary)]">{description}</p>}
        {trend && (
          <p
            className={cn(
              "text-xs font-semibold",
              trend.isPositive ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value} from last month
          </p>
        )}
      </div>
      <div className="flex h-11 w-11 items-center justify-center border border-[var(--border)] text-[var(--text-secondary)]">
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}
