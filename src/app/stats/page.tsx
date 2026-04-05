"use client";

import { useState } from "react";
import { useStats } from "@/lib/api/hooks";
import { getDeviceToken } from "@/lib/device-token";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Check,
} from "lucide-react";

export default function StatsPage() {
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

      <DeviceIdSection />
    </div>
  );
}

function DeviceIdSection() {
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const deviceId = getDeviceToken();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    localStorage.setItem("device-token", trimmed);
    window.location.reload();
  };

  return (
    <div className="mt-8 rounded-lg border p-4">
      <h2 className="mb-2 text-sm font-semibold">デバイス ID</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        他の端末���この ID を��力すると、同じデータにアクセスできます
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
          {deviceId}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-accent"
        >
          {copied ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>

      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="mt-3 text-xs text-muted-foreground underline"
        >
          別の端末の ID を入力する
        </button>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="デバイス ID を貼り付け"
            className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleApply}
            disabled={!inputValue.trim()}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            適用
          </button>
        </div>
      )}
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
