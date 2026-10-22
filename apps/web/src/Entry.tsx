import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Api } from "./api";
import { ApiError, errorText } from "./api";
import type { Audience, Flow, Language } from "./types";
import { languages } from "./types";
import { Brand, IconButton } from "./ui";
type State = {
  step: "CODE" | "TEAM" | "REPLACEMENT" | "STAFF_ENTRY";
  flow?: Flow;
  request?: { state: string; request_id: string; expires_at: string };
  mode?: string;
};
export default function Entry({
  api,
  initial,
  entered,
}: {
  api: Api;
  initial: State;
  entered: (
    value: any,
    audience: "PARTICIPANT" | "STAFF" | "STAFF_RECOVERY",
  ) => void;
}) {
  const [state, setState] = useState(initial),
    [code, setCode] = useState(""),
    [member, setMember] = useState(""),
    [language, setLanguage] = useState<Language>("cpp"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [replacement, setReplacement] = useState(false);
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (e instanceof ApiError && e.outcome === "NOT_PROCESSED")
        setUnknown(false);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    await perform(async () => {
      const result = await api.request<any>(
        "/api/v1/entry/verify",
        { code },
        "ANONYMOUS",
      );
      setCode("");
      setUnknown(false);
      if (result.audience === "TEAM") {
        api.setToken("ENTRY", result.csrf_token);
        setState({ step: "TEAM", flow: result.flow });
        setMember("");
      } else {
        const audience =
          result.flow.mode === "CLOCK_RECOVERY"
            ? "STAFF_RECOVERY_ENTRY"
            : "STAFF_ENTRY";
        api.setToken(audience, result.csrf_token);
        setState({ step: "STAFF_ENTRY", mode: result.flow.mode });
      }
    });
  }
  async function activate() {
    await perform(async () => {
      setUnknown(true);
      const value = await api.request<any>(
        "/api/v1/entry/activate",
        { member_id: member, language, request_key: crypto.randomUUID() },
        "ENTRY",
      );
      setUnknown(false);
      if (value.status === "REJECTED") {
        setReplacement(value.reason === "ALREADY_ENROLLED");
        setError(
          value.reason === "ALREADY_ENROLLED"
            ? "This member is already enrolled. Restore the original browser or request organiser approval."
            : "This round is not available for entry.",
        );
        return;
      }
      api.setToken("PARTICIPANT", value.csrf_token);
      entered(value, "PARTICIPANT");
    });
  }
  async function recover() {
    await perform(async () => {
      const step = await api.bootstrap(
        state.step === "REPLACEMENT" ? "REPLACEMENT" : "ENTRY",
      );
      if (state.step !== "REPLACEMENT" && step.flow.state !== "ACTIVATED") {
        setError(
          "The previous entry is not confirmed yet. No new entry was sent. Check again or contact an organiser.",
        );
        return;
      }
      const result = await api.request<any>(
        state.step === "REPLACEMENT"
          ? "/api/v1/entry/replacement/recover"
          : "/api/v1/entry/recover",
        {},
        state.step === "REPLACEMENT" ? "REPLACEMENT" : "ENTRY",
      );
      api.setToken("PARTICIPANT", result.csrf_token);
      entered(result, "PARTICIPANT");
    });
  }
  useEffect(() => {
    if (state.step !== "REPLACEMENT" || state.request?.state !== "PENDING")
      return;
    let gone = false;
    const timer = setInterval(
      () =>
        void api
          .bootstrap("REPLACEMENT")
          .then((value) => {
            if (!gone)
              setState({ step: "REPLACEMENT", request: value.request });
          })
          .catch((e) => {
            if (!gone) setError(errorText(e));
          }),
      5000,
    );
    return () => {
      gone = true;
      clearInterval(timer);
    };
  }, [state.step, state.request?.state]);
  const back = () =>
    void perform(async () => {
      await api.bootstrap("ANONYMOUS");
      setState({ step: "CODE" });
      setUnknown(false);
      setReplacement(false);
      setCode("");
    });
  return (
    <main className="entry">
      <header>
        <Brand />
        <span className="edition">NIT SILCHAR / 2026</span>
      </header>
      <section className="entry-body">
        <div className="entry-rule">
          <span className="status-dot" /> FIELD ACCESS
        </div>
        <h1>
          Ingenium<span>Bug bounty arena.</span>
        </h1>
        <div className="entry-form">
          {state.step === "CODE" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <label htmlFor="access-code">
                <KeyRound size={16} /> Team or staff code
              </label>
              <input
                id="access-code"
                type="password"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={96}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="Enter your private code"
              />
              <button
                className="primary"
                disabled={busy || !code.trim()}
                type="submit"
              >
                {busy ? "Verifying" : "Enter arena"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {state.step === "TEAM" && (
            <>
              <div className="entry-team">
                <UserRound size={20} />
                <strong>{state.flow?.team_name}</strong>
                <IconButton
                  title="Refresh entry availability"
                  onClick={() =>
                    void perform(async () => {
                      const value = await api.bootstrap("ENTRY");
                      setState({ step: "TEAM", flow: value.flow });
                    })
                  }
                >
                  <RefreshCw size={16} />
                </IconButton>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void activate();
                }}
              >
                <fieldset disabled={busy || unknown}>
                  <legend>Team member</legend>
                  {state.flow?.members.map((person) => (
                    <label className="choice" key={person.id}>
                      <input
                        type="radio"
                        name="member"
                        value={person.id}
                        checked={member === person.id}
                        onChange={() => {
                          setMember(person.id);
                          setReplacement(false);
                        }}
                      />
                      {person.name}
                    </label>
                  ))}
                  <label htmlFor="language">Language</label>
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Language)}
                  >
                    {Object.entries(languages).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <span className="field-note">
                    <LockKeyhole size={13} /> Locked for this round
                  </span>
                </fieldset>
                {!state.flow?.round_id && (
                  <p className="notice">
                    Waiting for the organiser to open round entry.
                  </p>
                )}
                {unknown ? (
                  <button
                    type="button"
                    onClick={() => void recover()}
                    disabled={busy}
                  >
                    Check previous entry <RefreshCw size={16} />
                  </button>
                ) : (
                  <button
                    className="primary"
                    type="submit"
                    disabled={busy || !member || !state.flow?.round_id}
                  >
                    Confirm and enter <ArrowRight size={18} />
                  </button>
                )}
              </form>
              {replacement && (
                <button
                  onClick={() =>
                    void perform(async () => {
                      const result = await api.request<any>(
                        "/api/v1/entry/replacement",
                        { member_id: member, request_key: crypto.randomUUID() },
                        "ENTRY",
                      );
                      if (result.status === "RESUME") {
                        api.setToken("PARTICIPANT", result.csrf_token);
                        entered(result, "PARTICIPANT");
                      } else {
                        api.setToken("REPLACEMENT", result.csrf_token);
                        setState({
                          step: "REPLACEMENT",
                          request: result.request,
                        });
                        setUnknown(false);
                      }
                    })
                  }
                  disabled={busy}
                >
                  Request browser replacement <ShieldCheck size={16} />
                </button>
              )}
            </>
          )}
          {state.step === "REPLACEMENT" && (
            <>
              <h2>
                {state.request?.state === "APPROVED"
                  ? "Replacement approved"
                  : "Awaiting organiser approval"}
              </h2>
              <p className="notice">
                {state.request?.state === "APPROVED"
                  ? "Your member identity and locked language will be restored."
                  : "Your original session is unchanged until an organiser approves this request."}
              </p>
              <dl className="replacement-reference">
                <dt>Request reference</dt>
                <dd>{state.request?.request_id}</dd>
                <dt>Expires</dt>
                <dd>
                  {state.request &&
                    new Date(state.request.expires_at).toLocaleTimeString()}
                </dd>
              </dl>
              {unknown ? (
                <button onClick={() => void recover()} disabled={busy}>
                  Check previous restoration <RefreshCw size={16} />
                </button>
              ) : (
                state.request?.state === "APPROVED" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        setUnknown(true);
                        const value = await api.request<any>(
                          "/api/v1/entry/replacement/activate",
                          { request_key: crypto.randomUUID() },
                          "REPLACEMENT",
                        );
                        api.setToken("PARTICIPANT", value.csrf_token);
                        entered(value, "PARTICIPANT");
                      })
                    }
                  >
                    Restore arena <ArrowRight size={18} />
                  </button>
                )
              )}
            </>
          )}
          {state.step === "STAFF_ENTRY" && (
            <>
              <h2>Staff access verified</h2>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    const recovery = state.mode === "CLOCK_RECOVERY",
                      audience: Audience = recovery
                        ? "STAFF_RECOVERY_ENTRY"
                        : "STAFF_ENTRY";
                    const recovering = unknown;
                    setUnknown(true);
                    const value = await api.request<any>(
                      recovery
                        ? `/api/v1/staff/recovery/entry/${recovering ? "recover" : "activate"}`
                        : `/api/v1/staff/entry/${recovering ? "recover" : "activate"}`,
                      recovering ? {} : { request_key: crypto.randomUUID() },
                      audience,
                    );
                    api.setToken(
                      recovery ? "STAFF_RECOVERY" : "STAFF",
                      value.csrf_token,
                    );
                    entered(value, recovery ? "STAFF_RECOVERY" : "STAFF");
                  })
                }
              >
                {unknown ? "Check previous staff entry" : "Open control room"}{" "}
                <ArrowRight size={18} />
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {state.step !== "CODE" && (
            <button className="text-button back" onClick={back} disabled={busy}>
              <ArrowLeft size={15} /> Different code
            </button>
          )}
        </div>
      </section>
      <footer>
        <span>TECNOESIS</span>
        <span>ENGINEER. DEBUG. OUTPLAY.</span>
        <span>01 / ACCESS</span>
      </footer>
    </main>
  );
}
export type EntryState = State;
