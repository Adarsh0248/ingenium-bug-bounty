export const AUDIT_FAMILIES = {
  ANNOUNCEMENTS: { label: "Announcements", arena: true, superAdmin: false },
  ROUND: { label: "Round controls", arena: true, superAdmin: false },
  ARENA: { label: "Arena setup", arena: true, superAdmin: false },
  DISCIPLINE: { label: "Discipline", arena: true, superAdmin: false },
  REPLACEMENTS: {
    label: "Member replacements",
    arena: true,
    superAdmin: false,
  },
  TEAMS: {
    label: "Team registration and codes",
    arena: false,
    superAdmin: false,
  },
  IMPORTS: { label: "Registration imports", arena: false, superAdmin: false },
  CONTENT: { label: "Content changes", arena: false, superAdmin: false },
  CONTENT_READS: {
    label: "Private content access",
    arena: false,
    superAdmin: false,
  },
  PREPARATION: {
    label: "Validation preparation",
    arena: false,
    superAdmin: false,
  },
  SNAPSHOT_READS: { label: "Snapshot access", arena: false, superAdmin: false },
  VALIDATION: { label: "Validation requests", arena: false, superAdmin: false },
  REPORT_READS: {
    label: "Validation report access",
    arena: false,
    superAdmin: false,
  },
  PUBLICATION: {
    label: "Publication reviews",
    arena: false,
    superAdmin: false,
  },
  SUBMISSION_REVIEWS: {
    label: "Private submission reviews",
    arena: true,
    superAdmin: false,
  },
  DIAGNOSTICS: {
    label: "Private validation diagnostics",
    arena: false,
    superAdmin: false,
  },
  CLOCK: { label: "Timing clearances", arena: false, superAdmin: false },
  STAFF: { label: "Staff management", arena: false, superAdmin: true },
} as const;
export type AuditFamily = keyof typeof AUDIT_FAMILIES;
export interface StaffAuditItem {
  id: string;
  recorded_at: string;
  actor_id: string;
  actor_name: string;
  action: string;
  outcome: string;
  denial_reason: string | null;
  reason: string;
  target_id: string | null;
  arena_id: string | null;
  round_id: string | null;
}
export interface StaffAuditPage {
  family: AuditFamily;
  arena_id: string | null;
  items: StaffAuditItem[];
  next_after: string | null;
}
