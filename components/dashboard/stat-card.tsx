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
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {value}
        </p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
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
      <div className="dark:bg-brand-950/80 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:text-brand-400">
        <Icon className="h-6 w-6" />
      </div>
    </Card>
  );
}
