import { EVENT_LANGUAGES, sha256, uuid } from "../access/credentials.js";
import { AccessError } from "../access/transaction.js";
import { prepareContent } from "./policy.js";

function fields(
  value: unknown,
  names: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  )
    throw new AccessError("INVALID_CONTEXT");
  return value as Record<string, unknown>;
}

export function prepareQuestionImport(value: unknown) {
  const q = fields(value, [
    "id",
    "round_type",
    "title",
    "statement",
    "difficulty",
    "category",
    "checker_mode",
    "variants",
    "cases",
    "hints",
  ]);
  let sourceId: string;
  try {
    sourceId = uuid(q.id);
  } catch {
    throw new AccessError("INVALID_CONTEXT");
  }
  const metadata = {
    round_type: q.round_type,
    title: q.title,
    statement: q.statement,
    difficulty: q.difficulty,
    category: q.category,
    checker_mode: q.checker_mode,
    reward_multiplier: q.round_type === 1 ? 5 : 1,
  };
  prepareContent("CREATE", metadata);
  const variants = fields(q.variants, EVENT_LANGUAGES);
  const languages = EVENT_LANGUAGES.map((language) => {
    const variant = fields(variants[language], [
      "starter_code",
      "reference_solution_code",
      "defect_description",
      "witness_case_position",
    ]);
    const payload = {
      language,
      starter_code: variant.starter_code,
      reference_solution_code: variant.reference_solution_code,
      defect_description: variant.defect_description,
      runtime_key: null,
      cpu_time_limit_ms: null,
      wall_time_limit_ms: null,
      memory_limit_kb: null,
    };
    prepareContent("VARIANT", payload);
    return { payload, witnessPosition: variant.witness_case_position };
  });
  if (
    !Array.isArray(q.cases) ||
    q.cases.length < 2 ||
    q.cases.length > 20 ||
    !Array.isArray(q.hints) ||
    q.hints.length !== 3
  )
    throw new AccessError("INVALID_CONTEXT");
  const cases = q.cases
    .map((value) => {
      const c = fields(value, [
        "position",
        "visibility",
        "input_data",
        "expected_output",
      ]);
      const payload = {
        case_id: null,
        position: c.position,
        visibility: c.visibility,
        input_data: c.input_data,
        expected_output: c.expected_output,
      };
      prepareContent("CASE", payload);
      return payload;
    })
    .sort((a, b) => Number(a.position) - Number(b.position));
  const hints = q.hints
    .map((value) => {
      const hint = fields(value, ["level", "content"]);
      const payload = { level: hint.level, content: hint.content };
      prepareContent("HINT", payload);
      return payload;
    })
    .sort((a, b) => Number(a.level) - Number(b.level));
  if (
    new Set(cases.map((c) => c.position)).size !== cases.length ||
    !cases.some((c) => c.visibility === "SAMPLE") ||
    hints.some((h, i) => h.level !== i + 1) ||
    languages.some(
      (v) =>
        !cases.some(
          (c) => c.position === v.witnessPosition && c.visibility === "HIDDEN",
        ),
    )
  )
    throw new AccessError("INVALID_CONTEXT");
  const data = { sourceId, metadata, languages, cases, hints };
  return {
    ...data,
    reason: `Import event question ${sourceId}; SHA-256 ${sha256(JSON.stringify(data)).toString("hex")}`,
  };
}
