import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { ApiError, createApi, errorText } from "./api";
import type { Audience, Session, StaffSession } from "./types";
import { Brand } from "./ui";
import Entry from "./Entry";
import type { EntryState } from "./Entry";
const Participant = lazy(() => import("./Participant")),
  StaffConsole = lazy(() => import("./StaffConsole")),
  ClockRecovery = lazy(() => import("./ClockRecovery")),
  Arena = lazy(() => import("./Arena"));
const api = createApi();
const decorative = [
  {
    bounty_id: "entry",
    title: "",
    difficulty: 28,
    base_bounty: 0,
    claimed: false,
    hint_tier: 0,
  },
];
declare const __PREVIEW__: boolean;
export default function App() {
  const [screen, setScreen] = useState("BOOT"),
    [session, setSession] = useState<Session | null>(null),
    [staff, setStaff] = useState<StaffSession | null>(null),
    [staffAudience, setStaffAudience] = useState<"STAFF" | "STAFF_RECOVERY">(
      "STAFF",
    ),
    [entry, setEntry] = useState<EntryState>({ step: "CODE" }),
    [error, setError] = useState("");
  async function boot(entryOnly = false) {
    setScreen("BOOT");
    setError("");
    try {
      if (entryOnly) { setStaff(null); setSession(null); api.clear(); }
      await api.bootstrap("ANONYMOUS");
      if (entryOnly) { setEntry({step:"CODE"}); setScreen("ENTRY"); return; }
      for (const audience of [
        "PARTICIPANT",
        "STAFF",
        "STAFF_RECOVERY",
        "REPLACEMENT",
        "ENTRY",
        "STAFF_ENTRY",
        "STAFF_RECOVERY_ENTRY",
      ] as Audience[]) {
        try {
          const value = await api.bootstrap(audience);
          if (audience === "PARTICIPANT") {
            setSession(value.session);
            setScreen("PARTICIPANT");
            return;
          }
          if (audience === "STAFF" || audience === "STAFF_RECOVERY") {
            setStaff(value.session);
            setStaffAudience(audience);
            setScreen("STAFF");
            return;
          }
          if (audience === "REPLACEMENT") {
            setEntry({ step: "REPLACEMENT", request: value.request });
            setScreen("ENTRY");
            return;
          }
          if (audience === "ENTRY") {
            if (value.flow.state === "ACTIVATED") {
              const recovered = await api.request<any>(
                "/api/v1/entry/recover",
                {},
                "ENTRY",
              );
              api.setToken("PARTICIPANT", recovered.csrf_token);
              setSession(recovered.session);
              setScreen("PARTICIPANT");
              return;
            }
            setEntry({ step: "TEAM", flow: value.flow });
            setScreen("ENTRY");
            return;
          }
          setEntry({ step: "STAFF_ENTRY", mode: value.flow.mode });
          setScreen("ENTRY");
          return;
        } catch (e) {
          if (e instanceof ApiError && e.code === "CLOCK_UNTRUSTED" && !audience.startsWith("STAFF_RECOVERY")) continue;
          if (
            !(e instanceof ApiError) ||
            (e.status !== 401 && e.status !== 400)
          )
            throw e;
        }
      }
      setEntry({ step: "CODE" });
      setScreen("ENTRY");
    } catch (e) {
      setError(errorText(e));
      setScreen("UNAVAILABLE");
    }
  }
  useEffect(() => {
    void boot();
  }, []);
  useEffect(() => {
    api.onInvalid((audience) => {
      if (
        (screen === "PARTICIPANT" && audience === "PARTICIPANT") ||
        (screen === "STAFF" && audience.startsWith("STAFF"))
      ) {
        setSession(null);
        setStaff(null);
        api.clear();
        setScreen("EXPIRED");
      }
    });
  }, [screen]);
  const expire = () => {
    setSession(null);
    api.clear();
    setScreen("EXPIRED");
  };
  const entered = (
    value: any,
    audience: "PARTICIPANT" | "STAFF" | "STAFF_RECOVERY",
  ) => {
    if (audience === "PARTICIPANT") {
      setSession(value.session);
      setScreen("PARTICIPANT");
    } else {
      setStaff(value.session);
      setStaffAudience(audience);
      setScreen("STAFF");
    }
  };
  return (
    <>
      {__PREVIEW__ && (
        <div className="preview-label">
          LOCAL PREVIEW · SYNTHETIC TEAMS · NO CODE EXECUTION
        </div>
      )}
      {screen === "PARTICIPANT" && session ? (
        <Suspense fallback={<div className="boot-status">Opening arena…</div>}>
          <Participant
            api={api}
            session={session}
            leave={() => void boot()}
            expired={expire}
          />
        </Suspense>
      ) : screen === "ENTRY" ? (
        <>
          <div className="entry-visual">
            <Suspense fallback={null}>
              <Arena
                bugs={decorative}
                onOpen={() => {}}
                still={matchMedia("(prefers-reduced-motion: reduce)").matches}
              />
            </Suspense>
          </div>
          <Entry api={api} initial={entry} entered={entered} />
        </>
      ) : screen === "STAFF" && staff && staffAudience === "STAFF" ? (
        <Suspense
          fallback={<div className="boot-status">Opening control room...</div>}
        >
          <StaffConsole
            api={api}
            session={staff}
            leave={() => void boot()}
            expired={expire}
          />
        </Suspense>
      ) : screen === "STAFF" && staff ? (
        <Suspense fallback={<div className="boot-status">Opening timing recovery...</div>}>
          <ClockRecovery key={staff.session_id} api={api} session={staff} leave={() => void boot(true)} />
        </Suspense>
      ) : (
        <main className="service-screen">
          <Brand />
          <section>
            <span className="eyebrow">FIELD STATUS</span>
            <h1>
              {screen === "BOOT"
                ? "Establishing connection"
                : screen === "EXPIRED"
                  ? "Session unavailable"
                  : "Arena offline"}
            </h1>
            {screen === "BOOT" ? (
              <span className="loader" />
            ) : (
              <>
                <p>
                  {screen === "EXPIRED"
                    ? "Protected data has been cleared. Contact an organiser to restore your enrolled member."
                    : error}
                </p>
                <button className="primary" onClick={() => void boot()}>
                  {screen === "EXPIRED"
                    ? "Return to entry"
                    : "Check connection"}
                  {screen === "EXPIRED" ? (
                    <ArrowRight size={17} />
                  ) : (
                    <RefreshCw size={17} />
                  )}
                </button>
              </>
            )}
          </section>
        </main>
      )}
    </>
  );
}
