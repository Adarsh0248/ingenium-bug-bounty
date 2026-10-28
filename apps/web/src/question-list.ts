import type { Bounty, Category } from "./types";

export const questionTags: Record<Category, string> = {
  ARRAYS: "Arrays & strings",
  GRAPHS: "Graphs & trees",
  SYSTEMS: "Systems & memory",
  LOGIC: "Logic & state",
};
export type QuestionFilters = {
  search: string;
  tags: Category[];
  status: "all" | "available" | "captured" | "closed";
  sort: "default" | "easiest" | "hardest";
};
export const defaultQuestionFilters: QuestionFilters = {
  search: "",
  tags: [],
  status: "all",
  sort: "default",
};

export function questionList(bounties: Bounty[], filters: QuestionFilters) {
  const search = filters.search.trim().toLowerCase();
  const rows = bounties
    .map((bug, index) => ({ bug, index }))
    .filter(
      ({ bug }) =>
        (!filters.tags.length ||
          (bug.category !== null && filters.tags.includes(bug.category))) &&
        (!search ||
          `${bug.title} ${bug.category ? questionTags[bug.category] : "Other"}`
            .toLowerCase()
            .includes(search)) &&
        (filters.status === "all" ||
          (filters.status === "available" && !bug.claimed) ||
          (filters.status === "captured" && bug.captured && !bug.claimed) ||
          (filters.status === "closed" && bug.claimed)),
    );
  if (filters.sort !== "default")
    rows.sort(
      (a, b) =>
        (filters.sort === "easiest"
          ? a.bug.difficulty - b.bug.difficulty
          : b.bug.difficulty - a.bug.difficulty) || a.index - b.index,
    );
  return rows;
}
