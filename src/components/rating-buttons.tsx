"use client";

import { Rating, type Grade } from "@/lib/fsrs";

interface RatingButtonsProps {
  intervals: Record<Grade, string>;
  onRate: (grade: Grade) => void;
  disabled?: boolean;
}

const BUTTONS: { grade: Grade; label: string; colorClass: string }[] = [
  { grade: Rating.Again, label: "Again", colorClass: "bg-grade-again" },
  { grade: Rating.Hard, label: "Hard", colorClass: "bg-grade-hard" },
  { grade: Rating.Good, label: "Good", colorClass: "bg-grade-good" },
  { grade: Rating.Easy, label: "Easy", colorClass: "bg-grade-easy" },
];

export function RatingButtons({
  intervals,
  onRate,
  disabled,
}: RatingButtonsProps) {
  return (
    <div className="mt-6 grid grid-cols-4 gap-2">
      {BUTTONS.map(({ grade, label, colorClass }) => (
        <button
          key={grade}
          onClick={() => onRate(grade)}
          disabled={disabled}
          className={`flex flex-col items-center rounded-lg px-2 py-3 text-white transition-all hover:brightness-[0.88] disabled:opacity-50 ${colorClass}`}
        >
          <span className="text-xs font-medium">{label}</span>
          <span className="mt-1 text-[10px] opacity-80">
            {intervals[grade]}
          </span>
        </button>
      ))}
    </div>
  );
}
