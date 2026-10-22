import type {
  ContentSummary,
  ValidationSnapshot,
  ValidationReport,
} from "./content-types";
export function publicationEligible(
  version: ContentSummary,
  snapshot: ValidationSnapshot | null,
  report: ValidationReport | null,
) {
  return (
    version.publication_status === "DRAFT" &&
    !!snapshot &&
    snapshot.content_revision === version.content_revision &&
    !!report &&
    report.snapshot_id === snapshot.snapshot_id &&
    report.configuration_fingerprint === snapshot.fingerprint &&
    report.status === "PASSED" &&
    !report.physical_pending
  );
}
export const reviewAttestation = (notes: string) =>
  `Statement, test coverage, cross-language fairness and all three hints reviewed.\n${notes}`;
