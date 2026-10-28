import { memo, useId, useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import type { Standing } from "./types";
import StandingName from "./StandingName";

export default memo(function ArenaStandings({
  standings,
  own,
  teamName,
  ready,
  final,
  cancelled,
  openFull,
}: {
  standings: Standing[];
  own: Standing | null;
  teamName: string;
  ready: boolean;
  final: boolean;
  cancelled: boolean;
  openFull: () => void;
}) {
  const [collapsed, setCollapsed] = useState(
      () => matchMedia("(max-width: 720px)").matches,
    ),
    id = useId();
  const leaders = cancelled
    ? []
    : standings
        .filter((s) => s.rank !== null)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, 5);
  return (
    <aside
      className="arena-standings"
      aria-label="Arena leaderboard"
      data-collapsed={collapsed}
    >
      <button
        className="arena-standings-heading"
        aria-expanded={!collapsed}
        aria-controls={id}
        aria-label={collapsed ? "Expand leaderboard" : "Collapse leaderboard"}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>
          <Trophy size={13} /> TOP 5
          {collapsed
            ? ` · ${own?.rank != null && !cancelled ? `#${own.rank}` : "—"}`
            : ""}
        </span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      <div id={id} hidden={collapsed}>
        <span className="arena-standings-state">
          {cancelled
            ? "Round cancelled"
            : !ready
              ? "Reconnecting · last verified"
              : final
                ? "Final standings"
                : "Live standings"}
        </span>
        <ol aria-label="Top five teams">
          {leaders.map((s) => (
            <li
              key={s.team_round_id}
              data-own={s.team_round_id === own?.team_round_id || undefined}
            >
              <span className="arena-standing-rank">#{s.rank}</span>
              <span className="arena-standing-name" title={s.team_name}>
                <StandingName name={s.team_name} overdrive={s.overdrive} />
              </span>
            </li>
          ))}
        </ol>
        {!leaders.length && (
          <p className="arena-standings-empty">
            {cancelled
              ? "No competitive ranking."
              : "Rankings not available yet."}
          </p>
        )}
        <div className="arena-standing-self" aria-label="Your team ranking">
          <span className="arena-standing-rank">
            {own?.rank != null && !cancelled ? `#${own.rank}` : "—"}
          </span>
          <span
            className="arena-standing-name"
            title={own?.team_name ?? teamName}
          >
            <small>YOUR TEAM</small>
            <StandingName
              name={own?.team_name ?? teamName}
              overdrive={own?.overdrive}
            />
          </span>
        </div>
        <button className="arena-standings-full" onClick={openFull}>
          Full leaderboard
        </button>
      </div>
    </aside>
  );
});
