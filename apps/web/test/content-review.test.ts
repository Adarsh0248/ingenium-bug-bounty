import assert from "node:assert/strict";
import test from "node:test";
import { publicationEligible, reviewAttestation } from "../src/content-review";
import type {
  ContentSummary,
  ValidationReport,
  ValidationSnapshot,
} from "../src/content-types";
test("publication controls require current draft, exact snapshot identity, passed result and positive cleanup", () => {
  const version = {
      publication_status: "DRAFT",
      content_revision: "7",
    } as ContentSummary,
    snapshot = {
      snapshot_id: "snapshot",
      content_revision: "7",
      fingerprint: "digest",
    } as ValidationSnapshot,
    report = {
      snapshot_id: "snapshot",
      configuration_fingerprint: "digest",
      status: "PASSED",
      physical_pending: false,
    } as ValidationReport;
  assert.equal(publicationEligible(version, snapshot, report), true);
  for (const patch of [
    { status: "QUEUED" },
    { status: "RUNNING" },
    { status: "FAILED" },
    { status: "INFRA_ERROR" },
    { physical_pending: true },
    { snapshot_id: "foreign" },
    { configuration_fingerprint: "foreign" },
  ])
    assert.equal(
      publicationEligible(version, snapshot, {
        ...report,
        ...patch,
      } as ValidationReport),
      false,
    );
  assert.equal(
    publicationEligible(
      { ...version, content_revision: "8" },
      snapshot,
      report,
    ),
    false,
  );
  assert.equal(
    publicationEligible(
      { ...version, publication_status: "PUBLISHED" },
      snapshot,
      report,
    ),
    false,
  );
  assert.equal(publicationEligible(version, null, report), false);
  assert.equal(publicationEligible(version, snapshot, null), false);
  assert.match(
    reviewAttestation("Exact review notes"),
    /all three hints reviewed\.\nExact review notes$/,
  );
});
