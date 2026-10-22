// Advisory display only; participant_retry rechecks authority and safety atomically.
export function recoveryReason(input: {
  role: string;
  roundState: string;
  lane: string;
  parentCompleted: boolean;
  jobStatus: string;
  jobResult: string | null;
  extraAuthorised: boolean;
  attempts: { result: string | null; released_at: unknown }[];
}) {
  if (!["OWNER", "SUPER_ADMIN"].includes(input.role)) return "ROLE_REQUIRED";
  if (input.lane !== "OFFICIAL") return "SAMPLE_RUN";
  if (!["RUNNING", "PAUSED", "CLOSING"].includes(input.roundState))
    return "ROUND_CLOSED";
  if (
    input.parentCompleted ||
    input.jobResult !== null ||
    input.jobStatus === "CANCELLED"
  )
    return "SETTLED";
  if (input.attempts.some((a) => a.released_at === null))
    return "PHYSICAL_HOLD";
  if (input.extraAuthorised || input.attempts.length > 3)
    return "EXTRA_DISPATCH_USED";
  if (input.attempts.length < 3) return "AUTOMATIC_RECOVERY";
  if (input.attempts.some((a) => a.result !== "INFRA_ERROR"))
    return "NOT_INFRASTRUCTURE";
  return "ELIGIBLE";
}
