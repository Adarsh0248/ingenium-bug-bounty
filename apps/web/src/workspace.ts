import {
  createDraftEditor,
  DraftBuffers,
} from "../../api/src/workbench/draft-client";
import type {
  DraftView,
  SaveReceipt,
  SaveState,
} from "../../api/src/workbench/draft-client";
import type { Api } from "./api";
import { Command } from "./api";
import { bugPath } from "./types";
import type { Metadata, Session, Snapshot } from "./types";
export interface QuestionMemory {
  meta: Metadata;
  statement: string;
  hints: { level: number; content: string }[];
  samples: Record<number, { input: string; output: string }>;
}
export interface BufferState {
  source: string;
  revision: string;
  state: SaveState;
  dirty: boolean;
  reason: string | null;
}
export function allowed(snapshot: Snapshot | null, bounty: string) {
  if (
    !snapshot?.round ||
    !snapshot.round.current ||
    !["RUNNING", "PAUSED"].includes(snapshot.round.state) ||
    snapshot.bounties.find((b) => b.bounty_id === bounty)?.claimed
  )
    return false;
  return !snapshot.pauses.some(
    (p) =>
      p.scope === "GLOBAL" ||
      p.team_round_id === snapshot.actor.team_round_id ||
      p.member_round_id === snapshot.actor.member_round_id,
  );
}
export function createWorkspace(
  api: Api,
  session: Session,
  changed: () => void,
) {
  const buffers = new DraftBuffers(),
    items = new Map<
      string,
      {
        editor: ReturnType<typeof createDraftEditor>;
        view: BufferState;
        gate: string;
      }
    >(),
    commands = new Map<string, Command>(),
    opening = new Map<string, Promise<any>>(),
    questions = new Map<string, { value: QuestionMemory; bytes: number }>();
  let questionBytes = 0;
  let destroyed = false,
    lastSnapshot: Snapshot | null = null,
    lastReady = false,
    lastOpen = false;
  async function open(bounty: string) {
    if (items.has(bounty)) {
      void items.get(bounty)!.editor.refresh();
      return items.get(bounty)!;
    }
    if (opening.has(bounty)) return opening.get(bounty)!;
    const pending = load(bounty);
    opening.set(bounty, pending);
    try {
      return await pending;
    } finally {
      opening.delete(bounty);
    }
  }
  async function load(bounty: string) {
    const path = bugPath(session.round_id, bounty),
      view = await api.request<DraftView>(`${path}/draft`);
    if (destroyed) throw new Error("WORKSPACE_CLOSED");
    let latest: BufferState = {
      source: view.source,
      revision: view.revision,
      state: "UNSAVED",
      dirty: false,
      reason: view.reason,
    };
    const editor = createDraftEditor(
      view,
      {
        now: () => performance.now(),
        key: () => crypto.randomUUID(),
        load: () => api.request(`${path}/draft`),
        save: (intent) => api.request<SaveReceipt>(`${path}/draft`, intent),
        outcome: (key) => api.request(`${path}/draft/outcomes/${key}`),
        change(state) {
          latest = state;
          const item = items.get(bounty);
          if (item) item.view = state;
          if (!destroyed) changed();
        },
      },
      buffers,
    );
    const writable = allowed(lastSnapshot, bounty) && lastOpen,
      item = {
        editor,
        view: latest,
        gate: JSON.stringify([lastReady, writable]),
      };
    items.set(bounty, item);
    editor.availability(
      lastReady,
      writable,
      lastReady ? null : "LIVE_STATE_UNAVAILABLE",
    );
    return item;
  }
  return {
    items,
    open,
    question(bounty: string) {
      const entry = questions.get(bounty);
      if (!entry || destroyed) return null;
      questions.delete(bounty);
      questions.set(bounty, entry);
      return entry.value;
    },
    rememberQuestion(bounty: string, value: QuestionMemory) {
      if (destroyed) return;
      const previous = questions.get(bounty);
      if (previous) questionBytes -= previous.bytes;
      questions.delete(bounty);
      const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
      if (bytes <= 4194304) {
        questions.set(bounty, { value, bytes });
        questionBytes += bytes;
      }
      // Session memory only: bounded briefs never evict dirty source or enter browser storage.
      while (questions.size > 8 || questionBytes > 4194304) {
        const oldest = questions.keys().next().value!;
        questionBytes -= questions.get(oldest)!.bytes;
        questions.delete(oldest);
      }
    },
    command(bounty: string) {
      if (!commands.has(bounty))
        commands.set(
          bounty,
          new Command(api, session.round_id, () => {
            if (!destroyed) changed();
          }),
        );
      return commands.get(bounty)!;
    },
    update(snapshot: Snapshot | null, ready: boolean, roundOpen = true) {
      lastSnapshot = snapshot;
      lastReady = ready;
      lastOpen = roundOpen;
      for (const [bounty, item] of items) {
        const writable = allowed(snapshot, bounty) && roundOpen,
          gate = JSON.stringify([ready, writable]),
          revision = snapshot?.drafts.find(
            (d) => d.bounty_id === bounty,
          )?.revision;
        if (gate !== item.gate) {
          item.gate = gate;
          item.editor.availability(
            ready,
            writable,
            ready ? null : "LIVE_STATE_UNAVAILABLE",
          );
        } else if (revision && revision !== item.editor.revision)
          void item.editor.refresh();
      }
    },
    dirty() {
      return (
        [...items.values()].some(
          (i) => i.view.dirty || i.editor.unresolved !== null,
        ) || [...commands.values()].some((c) => c.unresolved)
      );
    },
    close() {
      destroyed = true;
      for (const [bounty, item] of items) {
        item.editor.close();
        buffers.release(
          JSON.stringify([session.round_id, session.member_round_id, bounty]),
          true,
        );
      }
      items.clear();
      commands.clear();
      questions.clear();
      questionBytes = 0;
    },
  };
}
