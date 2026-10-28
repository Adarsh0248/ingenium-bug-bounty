import { useEffect, useId, useRef, useState } from "react";
import { X, Crosshair, ArrowUpRight, RefreshCw } from "lucide-react";
import type { Api } from "./api";
import { bugAppearance } from "./bug-art";
import type { Bounty } from "./types";
import { bugPath, label } from "./types";
import { IconButton } from "./ui";
import { TecnoesisCoin } from "./BountyReward";
import { kernelAppearance } from "./kernel-art";
import { InlineCode } from "./ProblemText";

export function statementPreview(statement: string) {
  const first = statement
    .trim()
    .split(/\r?\n\s*\r?\n/)[0]
    .replace(/\s+/g, " ")
    .trim();
  if (first.length <= 180) return first;
  return `${first.slice(0, 177).replace(/\s+\S*$/, "")}…`;
}

export default function BugInfoCard({
  api,
  roundId,
  bug,
  canOpen,
  busy,
  open,
  close,
  kernel = false,
}: {
  api: Api;
  roundId: string;
  bug: Bounty;
  canOpen: boolean;
  busy: boolean;
  open: () => void;
  close: () => void;
  kernel?: boolean;
}) {
  const art = bugAppearance(
      bug.bounty_id,
      bug.difficulty,
      bug.category,
      bug.base_bounty,
    ),
    ka = kernel ? kernelAppearance(bug.bounty_id, bug.base_bounty) : null,
    heading = useRef<HTMLHeadingElement>(null),
    titleId = useId(),
    [preview, setPreview] = useState(""),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setPreview("");
    void api
      .request<{ bounty_id: string; statement: string }>(
        `${bugPath(roundId, bug.bounty_id)}/statement`,
      )
      .then((value) => {
        if (
          value.bounty_id !== bug.bounty_id ||
          typeof value.statement !== "string"
        )
          throw new Error("Invalid preview");
        if (active)
          setPreview(
            statementPreview(value.statement) ||
              "Open the question to inspect its brief.",
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [api, roundId, bug.bounty_id, retry]);
  return (
    <section
      className="bug-info-card"
      role="region"
      aria-labelledby={titleId}
      style={
        { "--intel-colour": ka?.color ?? art.color } as React.CSSProperties
      }
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <header>
        <div>
          <span className="intel-caption">
            <Crosshair size={11} /> TARGET LOCATED
          </span>
          <h2 id={titleId} ref={heading} tabIndex={-1}>
            {bug.title}
          </h2>
        </div>
        <IconButton title="Close bug details" onClick={close}>
          <X size={16} />
        </IconButton>
      </header>
      <div className="bug-info-body">
        <p className="intel-region">
          {kernel ? "The Kernel Breach" : art.region.name} ·{" "}
          {label(bug.category ?? art.region.category)}
        </p>
        <div className="intel-stats">
          <div>
            <span>BOUNTY</span>
            <strong className="coin-value">
              <TecnoesisCoin />
              {bug.base_bounty.toLocaleString()} <small>coins</small>
            </strong>
          </div>
          <div>
            <span>DIFFICULTY</span>
            <strong>
              {bug.difficulty}
              <small>/100</small>
            </strong>
          </div>
        </div>
        <p className="intel-creature">
          {ka?.name ?? art.name}{" "}
          <span>
            {ka
              ? `${ka.motion.toLowerCase()} · ${ka.tier ? "Enhanced aura" : "Unshielded"}`
              : `${art.rank.label} · ${art.movement}`}
          </span>
        </p>
        <div className="intel-preview" aria-live="polite">
          {failed ? (
            <>
              <span>Question preview unavailable.</span>
              <button
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw size={11} /> Retry preview
              </button>
            </>
          ) : (
            <InlineCode>{preview || "Reading question preview…"}</InlineCode>
          )}
        </div>
      </div>
      <button
        className="intel-open"
        type="button"
        disabled={!canOpen || busy}
        onClick={open}
      >
        {busy ? "Opening question…" : "Open question"}
        <ArrowUpRight size={15} />
      </button>
      {!canOpen && (
        <small className="intel-unavailable">
          Opening is unavailable while arena actions are paused or closed.
        </small>
      )}
    </section>
  );
}
