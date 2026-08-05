import { useStats } from "@/lib/api/hooks";
import { BarChart3, BookOpen, CheckCircle2, Clock } from "lucide-react";

export function StatsPage() {
  const { data: stats } = useStats();

  if (stats === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-6 text-2xl font-bold">統計</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<CheckCircle2 className="size-5 text-stat-today" />}
          label="今日の復習"
          value={stats.reviewedToday}
        />
        <StatCard
          icon={<Clock className="size-5 text-stat-due" />}
          label="復習待ち"
          value={stats.dueCards}
        />
        <StatCard
          icon={<BookOpen className="size-5 text-stat-total" />}
          label="総カード数"
          value={stats.totalCards}
        />
        <StatCard
          icon={<BarChart3 className="size-5 text-stat-deck" />}
          label="デッキ数"
          value={stats.deckCount}
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">カードの状態</h2>
        <div className="space-y-2">
          <StateBar
            label="新規"
            count={stats.newCards}
            total={stats.totalCards}
            color="bg-state-new"
          />
          <StateBar
            label="学習中"
            count={stats.learningCards}
            total={stats.totalCards}
            color="bg-state-learning"
          />
          <StateBar
            label="復習"
            count={stats.reviewCards}
            total={stats.totalCards}
            color="bg-state-review"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

function StateBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-muted-foreground">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-medium">{count}</span>
    </div>
  );
}
