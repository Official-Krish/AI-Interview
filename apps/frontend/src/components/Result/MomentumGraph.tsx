import { useMemo } from "react";
import { motion } from "motion/react";
import { Liveline } from "liveline";

interface ScoredTurn {
  orderNumber: number;
  score: number;
}

interface Props {
  turns: ScoredTurn[];
  momentum: string | null;
  momentumSlope: number | null;
}

export function MomentumGraph({ turns, momentum, momentumSlope }: Props) {
  const scored = turns.filter((t) => t.score != null);

  const { data, value, windowSecs } = useMemo(() => {
    if (scored.length < 2)
      return {
        data: [] as { time: number; value: number }[],
        value: 0,
        windowSecs: 30,
      };
    const pts = scored.map((t, i) => ({
      time: i * 5,
      value: t.score,
    }));
    return {
      data: pts,
      value: pts[pts.length - 1]!.value,
      windowSecs: Math.max(scored.length * 5 + 10, 30),
    };
  }, [scored]);

  if (scored.length < 2) return null;

  const trendColor =
    momentum === "improving"
      ? "#22c55e"
      : momentum === "declining"
        ? "#ef4444"
        : "#a3a3a3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[11px] tracking-[0.1em] uppercase font-semibold m-0"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          SCORE TREND
        </p>
        {momentum && (
          <span
            className="text-[11px] font-[500] flex items-center gap-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: trendColor }}
            />
            {momentum === "improving"
              ? "Improving"
              : momentum === "declining"
                ? "Declining"
                : "Stable"}
            {momentumSlope != null && (
              <span className="ml-1 font-mono opacity-60">
                ({momentumSlope > 0 ? "+" : ""}
                {momentumSlope.toFixed(1)})
              </span>
            )}
          </span>
        )}
      </div>
      <div style={{ height: 200 }}>
        <Liveline
          data={data}
          value={value}
          window={windowSecs}
          color={trendColor}
          theme="dark"
          grid
          badge={false}
          pulse={false}
          momentum={false}
          fill={false}
          scrub={false}
          formatValue={(v) => `${Math.round(v)}`}
          formatTime={() => ""}
          padding={{ top: 8, bottom: 4, left: 4, right: 4 }}
        />
      </div>
    </motion.div>
  );
}
