import { createShopService } from "../competition/shop.js";
import * as shopSchema from "../competition/shop-schemas.js";
import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import csrf from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { browserId, browserPolicy, boundedCookies, csrfContext, requestOrigin } from "./browser-policy.js";
import { clientAddress } from "./client-address.js";
import type { Audience, BrowserSettings } from "./browser-policy.js";
import type { SessionDelivery } from "./credentials.js";
import { createEntryService } from "./entry-service.js";
import { browserHttpQuota, memberReadQuota, staffQuota } from "./quotas.js";
import { createStaffService } from "./staff-service.js";
import { createStaffManagement } from "./staff-management.js";
import { createTeamManagement } from "./team-management.js";
import { createRegistrationImport } from "./registration-import.js";
import { createDisciplineService } from "./discipline.js";
import { createReplacementService } from "./replacement-service.js";
import { createArenaService } from "./arena-service.js";
import { createCompetitionService } from "../competition/service.js";
import type { CompetitionDependencies, CompetitionCommand } from "../competition/service.js";
import * as competitionSchema from "../competition/http-schemas.js";
import { installLive } from "../live/server.js";
import {createWorkbenchService} from "../workbench/service.js";
import * as workbenchSchema from "../workbench/http-schemas.js";
import {createHistoryService} from "../workbench/history.js";
import * as historySchema from "../workbench/history-schemas.js";
import type { JudgingFilters } from "../competition/staff-judging.js";
import { createSubmissionReviewService } from "../competition/submission-review.js";
import { createRetentionStatus } from "../maintenance/status.js";
import { retentionStatus } from "../maintenance/status-schema.js";
import { createOperationsStatus } from "../maintenance/operations.js";
import { operationsSchema } from "../maintenance/operations-schema.js";
import * as reviewSchema from "../competition/submission-review-schemas.js";
import { createReportService } from "../competition/reports.js";
import * as reportSchema from "../competition/report-schemas.js";
import { createContentService } from "../content/service.js";
import { createValidationService } from "../content/validation-service.js";
import { createValidationRunService } from "../content/validation-runs.js";
import { createValidationDiagnosticService } from "../content/validation-diagnostics.js";
import * as diagnosticSchema from "../content/validation-diagnostic-schemas.js";
import { createStaffAuditService } from "./audit-service.js";
import { auditPage, auditQuery } from "./audit-schemas.js";
import { createAnnouncementService } from "./announcements.js";
import * as announcementSchema from "./announcement-schemas.js";
import { createPublicationService } from "../content/publication-service.js";
import type { ContentAction } from "../content/policy.js";
import type { StaffAction } from "./staff-management.js";
import { AccessError } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";
import * as schema from "./http-schemas.js";

declare module "fastify" {
  interface FastifyRequest { entryCsrfContext: string; }
  interface FastifyContextConfig { clockRecovery?: boolean; largeContent?: boolean; participantSource?: boolean; }
}
export interface EntryHttpOptions { pool: Pool; clock: ClockGuard; recoveryClock?: ClockGuard; delivery: SessionDelivery; browser: BrowserSettings; competition?: CompetitionDependencies; proxy?: "loopback"; }

function sessionView(session: Awaited<ReturnType<ReturnType<typeof createEntryService>["inspect"]>>) {
  return { session_id: session.sessionId, member_id: session.memberId, member_round_id: session.memberRoundId,
    team_id: session.teamId, round_id: session.roundId, language: session.language, member_name: session.memberName,
    team_name: session.teamName, round_state: session.roundState, expires_at: session.expiresAt, absolute_expires_at: session.absoluteExpiresAt, warning_at: session.warningAt };
}

function sessionReceipt(receipt: Awaited<ReturnType<ReturnType<typeof createEntryService>["logout"]>>["receipt"]) {
  return { session_id: receipt.sessionId, request_key: receipt.requestKey, action: receipt.action, recorded_at: receipt.recordedAt, expires_at: receipt.expiresAt };
}

export const entryHttp: FastifyPluginAsync<EntryHttpOptions> = async (app, options) => {
  const policy = browserPolicy(options.browser);
  const service = createEntryService(options.pool, options.clock, options.delivery);
  const staff = createStaffService(options.pool, options.clock, options.delivery, options.recoveryClock);
  const management=createStaffManagement(options.pool,options.clock,options.delivery);
  const teamManagement=createTeamManagement(options.pool,options.clock,options.delivery);
  const registrations=createRegistrationImport(options.pool,options.clock,options.delivery);
  const discipline=createDisciplineService(options.pool,options.clock,options.delivery);
  const replacements = createReplacementService(options.pool, options.clock, options.delivery);
  const arenas = createArenaService(options.pool, options.clock, options.delivery);
  const shop = createShopService(options.pool, options.clock);
  const competition = createCompetitionService(options.pool, options.clock, options.delivery, options.competition);
  const submissionReviews = createSubmissionReviewService(options.pool, options.clock, options.delivery);
  const reports = createReportService(options.pool, options.clock, options.delivery);
  const retention = createRetentionStatus(options.pool, options.clock, options.delivery);
  const operations = createOperationsStatus(options.pool, options.clock, options.delivery);
  const workbench=createWorkbenchService(options.pool,options.clock);
  const history=createHistoryService(options.pool,options.clock);
  const content = createContentService(options.pool, options.clock, options.delivery);
  const validation = createValidationService(options.pool, options.clock, options.delivery);
  const validationRuns = createValidationRunService(options.pool, options.clock, options.delivery);
  const diagnostics = createValidationDiagnosticService(options.pool, options.clock, options.delivery);
  const audit = createStaffAuditService(options.pool, options.clock, options.delivery);
  const announcements = createAnnouncementService(options.pool, options.clock, options.delivery);
  const publications = createPublicationService(options.pool, options.clock, options.delivery);
  function recoveryClock() { if (!options.recoveryClock) throw new AccessError("CLOCK_RECOVERY_UNAVAILABLE"); return options.recoveryClock; }
  function entryClock() {
    try { options.clock.assertHealthy(); return options.clock; }
    catch (error) { if (!(error instanceof AccessError) || error.code!=="CLOCK_UNTRUSTED") throw error; return recoveryClock(); }
  }
  const wrap = (request: FastifyRequest, data: unknown) => ({ schema_version: 1, trace_id: request.id, data });
  const flowView = (flow: Awaited<ReturnType<typeof service.describe>>) => ({ flow_id: flow.flowId, state: flow.state,
    expires_at: flow.expiresAt, team_name: flow.teamName, members: flow.members, round_id: flow.roundId });

  await app.register(cookie, { secret: policy.cookieKey });
  await app.register(helmet, { contentSecurityPolicy: { useDefaults: false, directives: {
    defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"],
  } }, strictTransportSecurity: policy.cookie.secure ? { maxAge: 31536000 } : false });
  await app.register(csrf, { cookieKey: policy.names.csrf,
    cookieOpts: { ...policy.cookie, signed: true, maxAge: 28800 },
    csrfOpts: { hmacKey: policy.csrfKey, userInfo: true },
    getToken: (request) => typeof request.headers["x-csrf-token"] === "string" && request.headers["x-csrf-token"].length <= 512 ? request.headers["x-csrf-token"] : undefined,
    getUserInfo: (request) => request.entryCsrfContext });
  app.decorateRequest("entryCsrfContext", "");

  const pending = new Set<FastifyRequest>();
  const largeContent = new Set<FastifyRequest>();
  const waitingBody = new WeakSet<FastifyRequest>();
  const release = (request: FastifyRequest) => { pending.delete(request); largeContent.delete(request); waitingBody.delete(request); };
  app.addHook("onResponse", async (request) => { release(request); });
  app.addHook("onSend", async (request, reply, payload) => {
    pending.delete(request); waitingBody.delete(request);
    if (reply.raw.destroyed) largeContent.delete(request);
    return payload;
  });
  app.addHook("preValidation", async (request) => { waitingBody.delete(request); });
  app.addHook("onTimeout", async (request) => { if (waitingBody.has(request)) release(request); });
  app.addHook("onRequestAbort", async (request) => { if (waitingBody.has(request)) release(request); });
  app.addHook("onRequest", async (request, reply) => {
    const ip = clientAddress(request.raw, options.proxy);
    if (pending.size >= 128) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
    pending.add(request);
    boundedCookies(request, policy);
    requestOrigin(request, policy);
    if (request.headers["content-encoding"] !== undefined) throw new AccessError("UNSUPPORTED_ENCODING");
    if (request.method === "POST" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers["content-type"] ?? "")) throw new AccessError("JSON_REQUIRED");
    const bootstrapAudience = request.routeOptions.url === "/api/v1/bootstrap" ? new URL(request.url,"http://local").searchParams.get("audience") : null;
    const quotaClock = request.routeOptions.config.clockRecovery ? recoveryClock() :
      request.routeOptions.url === "/api/v1/entry/verify" || bootstrapAudience === "ANONYMOUS" ? entryClock() :
      bootstrapAudience?.startsWith("STAFF_RECOVERY") ? (options.recoveryClock ?? options.clock) : options.clock;
    try { await browserHttpQuota(options.pool, quotaClock, ip); }
    finally { if (request.raw.aborted) release(request); }
    waitingBody.add(request);
    if (request.routeOptions.config.largeContent) {
      const actor = await staff.inspect(request.cookies[policy.names.staff]);
      if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
      if (largeContent.size >= 2) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
      largeContent.add(request);
      reply.raw.once("close", () => { if (!pending.has(request)) largeContent.delete(request); });
    }
    if (request.routeOptions.config.participantSource) await service.inspect(request.cookies[policy.names.participant]);
  });

  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer", bodyLimit: 4096 }, (_request, body, done) => {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(body as Buffer);
      const parsed: unknown = JSON.parse(text, (key: string, value: unknown) => {
        if (!key.isWellFormed() || key === "__proto__" || key === "constructor" || (typeof value === "string" && !value.isWellFormed())) throw new Error("Invalid JSON string.");
        return value;
      });
      done(null, parsed);
    } catch { done(Object.assign(new Error("Invalid JSON."), { statusCode: 400 })); }
  });

  app.setErrorHandler((error, request, reply) => {
    const failure = error instanceof Error ? error as FastifyError : undefined;
    let status = 503, code = "UNAVAILABLE", outcome = "UNKNOWN";
    if (error instanceof AccessError) {
      if (["INVALID_CODE", "INVALID_FLOW", "INVALID_SESSION", "INVALID_AUTHORITY", "BROWSER_CONTEXT_REQUIRED"].includes(error.code)) { status = 401; code = "AUTHORITY_REQUIRED"; }
      else if (error.code === "PAYLOAD_EXPIRED") { status = 410; code = "PAYLOAD_EXPIRED"; outcome = "NOT_PROCESSED"; }
      else if (error.code === "STAFF_CONFIRMATION_REQUIRED") { status = 403; code = "STAFF_CONFIRMATION_REQUIRED"; }
      else if (error.code === "CLOCK_UNTRUSTED") { code = "CLOCK_UNTRUSTED"; }
      else if (error.code === "RESTORE_QUARANTINED") { code = "RESTORE_QUARANTINED"; }
      else if (["ORIGIN_DENIED", "ACCESS_UNAVAILABLE"].includes(error.code)) { status = 403; code = "ACCESS_DENIED"; }
      else if (["ROUND_OR_MEMBER_UNAVAILABLE","STAFF_TARGET_UNAVAILABLE","REPLACEMENT_UNAVAILABLE","ARENA_UNAVAILABLE","CONTENT_UNAVAILABLE","WORKBENCH_UNAVAILABLE"].includes(error.code)) { status = 404; code = "SCOPE_UNAVAILABLE"; }
      else if (["INVALID_HEADERS", "INVALID_CONTEXT"].includes(error.code)) { status = 400; code = "INVALID_REQUEST"; }
      else if (error.code === "CONTENT_LIMIT_EXCEEDED") { status = 400; code = "CONTENT_LIMIT_EXCEEDED"; }
      else if (["UNSUPPORTED_ENCODING", "JSON_REQUIRED"].includes(error.code)) { status = 415; code = "JSON_REQUIRED"; }
      else if (error.code === "RATE_LIMITED") { status = 429; code = "RATE_LIMITED"; reply.header("Retry-After", String(Math.max(1, Math.min(60, error.retryAfterSeconds ?? 1)))); }
      else if (error.code === "INTENT_CONFLICT") { status = 409; code = "INTENT_KEY_REUSED"; }
      else if (["REPORT_ALREADY_EXISTS","REPORT_ALREADY_DECIDED","ROUND_NOT_FINAL","STALE_VERSION"].includes(error.code)) { status=409;code=error.code; }
      else if (error.code === "HANDOFF_NOT_READY") { status = 409; code = "HANDOFF_NOT_READY"; }
      else if (error.code === "REQUEST_CAPACITY_UNAVAILABLE") { code = "CAPACITY_UNAVAILABLE"; outcome = "NOT_PROCESSED"; }
      if (status !== 503) outcome = "NOT_PROCESSED";
    } else if (failure?.code === "P0002") { status = 409; code = "INTENT_KEY_REUSED"; outcome = "NOT_PROCESSED"; }
    else if (failure?.code === "P0003") { status = 429; code = "JUDGING_COOLDOWN"; outcome = "NOT_PROCESSED"; reply.header("Retry-After", "5"); }
    else if (failure?.code === "54000") { status = 503; code = "JUDGING_CAPACITY"; outcome = "NOT_PROCESSED"; reply.header("Retry-After", "5"); }
    else if (failure?.code === "55000") { status = 503; code = "JUDGE_UNAVAILABLE"; outcome = "NOT_PROCESSED"; reply.header("Retry-After", "5"); }
    else if (failure?.code?.startsWith("FST_CSRF_")) { status = 403; code = "CSRF_DENIED"; outcome = "NOT_PROCESSED"; }
    else if (failure?.validation || failure?.statusCode === 400 || failure?.statusCode === 413 || failure?.statusCode === 415) {
      status = failure.statusCode === 413 ? 413 : failure.statusCode === 415 ? 415 : 400;
      code = status === 413 ? "BODY_TOO_LARGE" : "INVALID_REQUEST"; outcome = "NOT_PROCESSED";
    }
    if (status === 503) request.log.warn({ event: "entry_request_unavailable", trace_id: request.id,
      code: error instanceof AccessError ? error.code : /^[0-9A-Z]{5}$/.test(failure?.code ?? "") ? failure!.code : "UNAVAILABLE" }, "Entry request could not be completed.");
    return reply.code(status).send({ schema_version: 1, trace_id: request.id, error: { code, outcome } });
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send({ schema_version: 1, trace_id: request.id, error: { code: "NOT_FOUND", outcome: "NOT_PROCESSED" } }));

  function context(request: FastifyRequest, audience: Audience): string {
    const id = browserId(request, policy);
    if (!id) throw new AccessError("BROWSER_CONTEXT_REQUIRED");
    const credential = request.cookies[credentialName(audience)];
    return csrfContext(policy, audience, id, credential);
  }
  function credentialName(audience: Audience) {
    return audience === "REPLACEMENT" ? policy.names.replacement : audience === "ENTRY" ? policy.names.entry : audience === "STAFF_ENTRY" ? policy.names.staffEntry : audience === "STAFF" ? policy.names.staff :
      audience === "STAFF_RECOVERY_ENTRY" ? policy.names.staffRecoveryEntry : audience === "STAFF_RECOVERY" ? policy.names.staffRecovery : policy.names.participant;
  }
  const protect = (audience: Audience) => async (request: FastifyRequest) => { request.entryCsrfContext = context(request, audience); };
  const writeHooks = (audience: Audience) => [protect(audience), app.csrfProtection];

  const workbenchPath="/competition/rounds/:round_id/bounties/:bounty_id";
  const boundedResponse=(limit:number)=>async(_request:FastifyRequest,_reply:FastifyReply,payload:unknown)=>{
    if(Buffer.byteLength(JSON.stringify(payload))>limit)throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");return payload;
  };
  app.get("/staff/maintenance/retention", { exposeHeadRoute: false, preSerialization: boundedResponse(16384),
    schema: { querystring: schema.empty, response: schema.responses(retentionStatus) } }, async request => wrap(request, await retention(request.cookies[policy.names.staff])));
  app.get("/staff/maintenance/operations", { exposeHeadRoute: false, preSerialization: boundedResponse(16384),
    schema: { querystring: schema.empty, response: schema.responses(operationsSchema) } }, async request => wrap(request, await operations(request.cookies[policy.names.staff])));
  const announcementPath="/staff/arenas/:arena_id/announcements";
  app.post<{Params:{arena_id:string};Body:{scope:"EVENT"|"ROUND"|"TEAM";round_id:string|null;team_id:string|null;request_key:string;message:string;reason:string}}>(announcementPath,{
    bodyLimit:32768,onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,params:announcementSchema.arenaParams,body:announcementSchema.sendBody,response:schema.responses(announcementSchema.receipt)},
  },async request=>wrap(request,await announcements.send(request.cookies[policy.names.staff],{arenaId:request.params.arena_id,scope:request.body.scope,roundId:request.body.round_id,teamId:request.body.team_id,requestKey:request.body.request_key,message:request.body.message,reason:request.body.reason})));
  app.get<{Params:{arena_id:string;request_key:string}}>(`${announcementPath}/outcomes/:request_key`,{exposeHeadRoute:false,schema:{querystring:schema.empty,params:announcementSchema.outcomeParams,response:schema.responses(announcementSchema.outcome)}},
    async request=>wrap(request,await announcements.outcome(request.cookies[policy.names.staff],request.params.arena_id,request.params.request_key)));
  app.get<{Params:{arena_id:string};Querystring:{after?:string}}>(announcementPath,{exposeHeadRoute:false,schema:{params:announcementSchema.arenaParams,querystring:announcementSchema.pageQuery,response:schema.responses(announcementSchema.page(true))}},
    async request=>wrap(request,await announcements.staffList(request.cookies[policy.names.staff],request.params.arena_id,request.query.after)));
  app.get<{Params:{arena_id:string;announcement_id:string}}>(`${announcementPath}/:announcement_id`,{exposeHeadRoute:false,schema:{params:announcementSchema.detailParams,querystring:schema.empty,response:schema.responses(announcementSchema.detail(true))}},
    async request=>wrap(request,await announcements.staffDetail(request.cookies[policy.names.staff],request.params.arena_id,request.params.announcement_id)));
  app.get<{Querystring:{after?:string}}>("/participant/announcements",{exposeHeadRoute:false,schema:{querystring:announcementSchema.pageQuery,response:schema.responses(announcementSchema.page(false))}},
    async request=>wrap(request,await announcements.participantList(request.cookies[policy.names.participant],request.query.after)));
  app.get<{Params:{announcement_id:string}}>("/participant/announcements/:announcement_id",{exposeHeadRoute:false,schema:{querystring:schema.empty,params:announcementSchema.participantParams,response:schema.responses(announcementSchema.detail(false))}},
    async request=>wrap(request,await announcements.participantDetail(request.cookies[policy.names.participant],request.params.announcement_id)));
  app.get("/competition/history/rounds",{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,response:schema.responses(historySchema.rounds)}},
    async request=>wrap(request,await history.rounds(request.cookies[policy.names.participant])));
  app.get<{Params:{round_id:string}}>("/competition/rounds/:round_id/history",{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:competitionSchema.roundParams,response:schema.responses(historySchema.overview)}},
    async request=>wrap(request,await history.overview(request.cookies[policy.names.participant],request.params.round_id)));
  for(const [suffix,view,response] of [["attempts",history.attempts,historySchema.attempts],["wallet",history.wallet,historySchema.wallet]] as const){
    app.get<{Params:{round_id:string};Querystring:{after?:string}}>(`/competition/rounds/:round_id/history/${suffix}`,{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:historySchema.query,params:competitionSchema.roundParams,response:schema.responses(response)}},
      async request=>wrap(request,await view(request.cookies[policy.names.participant],request.params.round_id,request.query.after)));
  }
  app.get<{Params:{round_id:string;parent_id:string}}>("/competition/rounds/:round_id/history/judging/:parent_id",{exposeHeadRoute:false,preSerialization:boundedResponse(8388608),schema:{querystring:schema.empty,params:competitionSchema.judgingParams,response:schema.responses(competitionSchema.judging)}},
    async request=>wrap(request,await history.execution(request.cookies[policy.names.participant],request.params.round_id,request.params.parent_id)));
  app.get<{Params:BugParams}>("/competition/rounds/:round_id/history/hints/:bounty_id",{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:competitionSchema.bountyParams,response:schema.responses(competitionSchema.hints)}},
    async request=>wrap(request,await history.hints(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id)));
  type BugParams={round_id:string;bounty_id:string};
  app.get<{Params:BugParams}>(`${workbenchPath}/report`,{exposeHeadRoute:false,schema:{querystring:schema.empty,params:workbenchSchema.params,response:schema.responses(reportSchema.teamReport)}},
    async r=>wrap(r,await reports.participant(r.cookies[policy.names.participant],r.params.round_id,r.params.bounty_id)));
  app.post<{Params:BugParams;Body:{request_key:string;submission_id:string|null;message:string}}>(`${workbenchPath}/report`,{onRequest:writeHooks("PARTICIPANT"),schema:{querystring:schema.empty,params:workbenchSchema.params,body:reportSchema.reportBody,response:schema.responses(reportSchema.report)}},
    async r=>wrap(r,await reports.create(r.cookies[policy.names.participant],r.params.round_id,r.params.bounty_id,{requestKey:r.body.request_key,submissionId:r.body.submission_id,message:r.body.message})));
  app.get<{Params:BugParams&{request_key:string}}>(`${workbenchPath}/report/outcomes/:request_key`,{exposeHeadRoute:false,schema:{querystring:schema.empty,params:workbenchSchema.outcomeParams,response:schema.responses(reportSchema.outcome(reportSchema.report))}},
    async r=>wrap(r,await reports.reportOutcome(r.cookies[policy.names.participant],r.params.round_id,r.params.bounty_id,r.params.request_key)));
  app.get<{Params:{round_id:string};Querystring:{after?:string}}>("/staff/competition/rounds/:round_id/reports",{exposeHeadRoute:false,schema:{querystring:reportSchema.pageQuery,params:competitionSchema.roundParams,response:schema.responses(reportSchema.reportPage)}},
    async r=>wrap(r,await reports.list(r.cookies[policy.names.staff],r.params.round_id,r.query.after)));
  app.post<{Params:{round_id:string;report_id:string};Body:{request_key:string;verdict:string;reason:string;own_code:string}}>("/staff/competition/rounds/:round_id/reports/:report_id/decision",{onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,params:reportSchema.reportParams,body:reportSchema.decisionBody,response:schema.responses(reportSchema.decision)}},
    async r=>wrap(r,await reports.decide(r.cookies[policy.names.staff],r.params.round_id,r.params.report_id,{requestKey:r.body.request_key,verdict:r.body.verdict,reason:r.body.reason,ownCode:r.body.own_code})));
  for(const audience of ["STAFF","PARTICIPANT"] as const){
    const route=`/${audience==="STAFF"?"staff/":""}competition/rounds/:round_id/score-adjustments`;
    app.get<{Params:{round_id:string};Querystring:{after?:string}}>(route,{exposeHeadRoute:false,schema:{querystring:reportSchema.pageQuery,params:competitionSchema.roundParams,response:schema.responses(reportSchema.adjustmentPage)}},
      async r=>wrap(r,await reports.adjustments(r.cookies[policy.names[audience==="STAFF"?"staff":"participant"]],r.params.round_id,audience,r.query.after)));
  }
  app.post<{Params:{round_id:string};Body:{request_key:string;team_round_id:string;report_id:string|null;delta:number;reason:string;expected_revision:string;own_code:string}}>("/staff/competition/rounds/:round_id/score-adjustments",{onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,params:competitionSchema.roundParams,body:reportSchema.scoreBody,response:schema.responses(reportSchema.scoreReceipt)}},
    async r=>wrap(r,await reports.adjust(r.cookies[policy.names.staff],r.params.round_id,{requestKey:r.body.request_key,teamRoundId:r.body.team_round_id,reportId:r.body.report_id,delta:r.body.delta,reason:r.body.reason,expectedRevision:r.body.expected_revision,ownCode:r.body.own_code})));
  for(const [name,kind,receipt] of [["report-decisions","decision",reportSchema.decision],["score-adjustments","score",reportSchema.scoreReceipt]] as const)
    app.get<{Params:{round_id:string;request_key:string}}>(`/staff/competition/rounds/:round_id/${name}/outcomes/:request_key`,{exposeHeadRoute:false,schema:{querystring:schema.empty,params:competitionSchema.outcomeParams,response:schema.responses(reportSchema.outcome(receipt))}},
      async r=>wrap(r,await reports.outcome(r.cookies[policy.names.staff],r.params.round_id,kind,r.params.request_key)));
  for(const [suffix,view,response] of [["",workbench.metadata,workbenchSchema.metadata],["/statement",workbench.statement,workbenchSchema.statement],
    ["/starter",workbench.starter,workbenchSchema.starter],["/draft",workbench.draft,workbenchSchema.draft]] as const){
    app.get<{Params:BugParams}>(`${workbenchPath}${suffix}`,{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:workbenchSchema.params,response:schema.responses(response)}},
      async request=>wrap(request,await view(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id)));
  }
  app.get<{Params:BugParams&{sample_number:string;field:"input"|"expected_output"}}>(`${workbenchPath}/samples/:sample_number/:field`,{exposeHeadRoute:false,preSerialization:boundedResponse(8388608),schema:{querystring:schema.empty,params:workbenchSchema.sampleParams,response:schema.responses(workbenchSchema.sample)}},
    async request=>wrap(request,await workbench.sample(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id,Number(request.params.sample_number),request.params.field)));
  app.post<{Params:BugParams;Body:{request_key:string}}>(`${workbenchPath}/open`,{onRequest:writeHooks("PARTICIPANT"),schema:{querystring:schema.empty,params:workbenchSchema.params,body:workbenchSchema.openBody,response:schema.responses(workbenchSchema.opening)}},
    async request=>wrap(request,await workbench.open(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id,request.body.request_key)));
  app.post<{Params:BugParams;Body:{request_key:string;base_revision:string;source:string}}>(`${workbenchPath}/draft`,{bodyLimit:1048576,config:{participantSource:true},onRequest:writeHooks("PARTICIPANT"),preSerialization:boundedResponse(1048576),
    schema:{querystring:schema.empty,params:workbenchSchema.params,body:workbenchSchema.saveBody,response:{...schema.responses(workbenchSchema.receipt),409:schema.envelope(workbenchSchema.receipt)}}},
    async(request,reply)=>{const result=await workbench.save(request.cookies[policy.names.participant],{roundId:request.params.round_id,bountyId:request.params.bounty_id,requestKey:request.body.request_key,baseRevision:request.body.base_revision,source:request.body.source});
      if(result.outcome==="REJECTED"||result.outcome==="CONFLICT")reply.code(409);return wrap(request,result);});
  app.get<{Params:BugParams&{request_key:string}}>(`${workbenchPath}/draft/outcomes/:request_key`,{exposeHeadRoute:false,schema:{querystring:schema.empty,params:workbenchSchema.outcomeParams,response:schema.responses(workbenchSchema.outcome)}},
    async request=>wrap(request,await workbench.outcome(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id,request.params.request_key)));
  app.get<{Params:BugParams&{submission_id:string}}>(`${workbenchPath}/submissions/:submission_id/source`,{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:workbenchSchema.sourceParams,response:schema.responses(workbenchSchema.submittedSource)}},
    async request=>wrap(request,await workbench.officialSource(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id,request.params.submission_id)));
  app.get<{Params:BugParams;Querystring:{after?:string}}>(`${workbenchPath}/submissions`,{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:workbenchSchema.historyQuery,params:workbenchSchema.params,response:schema.responses(workbenchSchema.submissions)}},
    async request=>wrap(request,await workbench.submissions(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id,request.query.after)));

  const live=installLive(app,options,policy);
  for(const audience of ["PARTICIPANT","STAFF"] as const){
    const prefix=audience==="STAFF"?"/staff/live":"/live";
    const id={type:"string",format:"uuid"} as const;
    app.post<{Body:{round_id?:string|null}}>(`${prefix}/tickets`,{onRequest:writeHooks(audience),schema:{querystring:schema.empty,
      body:{type:"object",additionalProperties:false,properties:audience==="STAFF"?{round_id:{anyOf:[id,{type:"null"}]}}:{}}}},
    async request=>wrap(request,await live.ticket(request,audience,request.body.round_id??null)));
    app.post<{Body:{sync_id:string}}>(`${prefix}/snapshot`,{onRequest:writeHooks(audience),schema:{querystring:schema.empty,
      body:{type:"object",additionalProperties:false,required:["sync_id"],properties:{sync_id:id}}}},
    async request=>wrap(request,await live.snapshot(request,audience,request.body.sync_id)));
    app.post<{Body:{sync_id:string}}>(`${prefix}/projection`,{onRequest:writeHooks(audience),schema:{querystring:schema.empty,
      body:{type:"object",additionalProperties:false,required:["sync_id"],properties:{sync_id:id}}}},
    async request=>wrap(request,await live.projection(request,audience,request.body.sync_id)));
    app.post<{Body:{sync_id:string;stream_id:string;after:string}}>(`${prefix}/replay`,{onRequest:writeHooks(audience),schema:{querystring:schema.empty,
      body:{type:"object",additionalProperties:false,required:["sync_id","stream_id","after"],properties:{sync_id:id,stream_id:id,after:{type:"string",pattern:"^(0|[1-9][0-9]{0,18})$"}}}}},
    async request=>wrap(request,await live.replay(request,audience,request.body)));
  }

  app.get<{Querystring:{arena_id?:string}}>("/staff/competition/control-room",{exposeHeadRoute:false,
    schema:{querystring:competitionSchema.controlQuery,response:schema.responses(competitionSchema.controlRoom)}},async request=>
      wrap(request,await competition.controlRoom(request.cookies[policy.names.staff],request.query.arena_id)));
  app.get<{Params:{round_id:string}}>("/staff/competition/rounds/:round_id/cancellation",{exposeHeadRoute:false,
    schema:{params:competitionSchema.roundParams,querystring:schema.empty,response:schema.responses(competitionSchema.cancellation)}},async request=>
    wrap(request,await competition.cancellation(request.cookies[policy.names.staff],request.params.round_id)));
  app.get<{Querystring:{kind:string;after?:string}}>("/staff/competition/published",{exposeHeadRoute:false,
    schema:{querystring:competitionSchema.publishedQuery,response:schema.responses(competitionSchema.publishedPage)}},async request=>
      wrap(request,await competition.published(request.cookies[policy.names.staff],Number(request.query.kind),request.query.after)));
  app.post<{ Params: { round_id: string }; Body: { action: CompetitionCommand["action"]; request_key: string; expected_revision: string; reason: string; payload: Record<string, unknown>; own_code?: string } }>("/staff/competition/rounds/:round_id/commands", {
    bodyLimit: 16384, onRequest: writeHooks("STAFF"), schema: { querystring: schema.empty, params: competitionSchema.roundParams, body: competitionSchema.commandBody, response: schema.responses(competitionSchema.receipt) },
  }, async request => wrap(request, await competition.command(request.cookies[policy.names.staff], { action: request.body.action, roundId: request.params.round_id, requestKey: request.body.request_key,
    expectedRevision: request.body.expected_revision, reason: request.body.reason, payload: request.body.payload, ...(request.body.own_code === undefined ? {} : { ownCode: request.body.own_code }) })));
  app.post<{ Params: { snapshot_id: string }; Body: { run_id: string; review: string;request_key:string;expected_revision:string;own_code:string } }>("/staff/competition/publications/:snapshot_id", {
    bodyLimit:16384,onRequest: writeHooks("STAFF"), schema: { querystring: schema.empty, params: schema.validationSnapshotParams, body: competitionSchema.publishBody,
      response:{...schema.responses(competitionSchema.publication),409:{anyOf:[schema.envelope(competitionSchema.publication),schema.responses(competitionSchema.publication).default]}} },
  }, async (request,reply) => {
    const b=request.body,result=await publications.publish(request.cookies[policy.names.staff],{snapshotId:request.params.snapshot_id,runId:b.run_id,requestKey:b.request_key,expectedRevision:b.expected_revision,review:b.review,ownCode:b.own_code});
    if(result.outcome==="REJECTED")reply.code(409);return wrap(request,result);
  });
  app.get<{Params:{snapshot_id:string;request_key:string}}>("/staff/outcomes/publication/:snapshot_id/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:competitionSchema.publicationOutcomeParams,response:schema.responses(competitionSchema.publicationOutcome)}},async request=>wrap(request,await publications.outcome(request.cookies[policy.names.staff],request.params.snapshot_id,request.params.request_key)));
  for (const audience of ["STAFF", "PARTICIPANT"] as const) {
    const prefix = audience === "STAFF" ? "/staff/competition" : "/competition", cookieName = audience === "STAFF" ? policy.names.staff : policy.names.participant;
    app.get<{ Params: { round_id: string } }>(`${prefix}/rounds/:round_id`, { exposeHeadRoute: false, schema: { querystring: schema.empty, params: competitionSchema.roundParams, response: schema.responses(competitionSchema.state) } },
      async request => wrap(request, await competition.state(request.cookies[cookieName], request.params.round_id, audience)));
    app.get<{ Params: { round_id: string } }>(`${prefix}/rounds/:round_id/standings`, { exposeHeadRoute: false, schema: { querystring: schema.empty, params: competitionSchema.roundParams, response: schema.responses(competitionSchema.standings) } },
      async request => wrap(request, await competition.standings(request.cookies[cookieName], request.params.round_id, audience)));
    app.get<{ Params: { round_id: string; request_key: string } }>(`${prefix}/rounds/:round_id/outcomes/:request_key`, { exposeHeadRoute: false,
      schema: { querystring: schema.empty, params: competitionSchema.outcomeParams, response: schema.responses(competitionSchema.outcome) } },
    async request => wrap(request, await competition.outcome(request.cookies[cookieName], request.params.round_id, request.params.request_key, audience)));
  }
  app.get<{Params:{round_id:string}}>("/staff/competition/rounds/:round_id/results",{exposeHeadRoute:false,preSerialization:boundedResponse(270336),
    schema:{params:competitionSchema.roundParams,querystring:schema.empty,response:schema.responses(competitionSchema.finalResults)}},async request=>
    wrap(request,await competition.results(request.cookies[policy.names.staff],request.params.round_id)));
  app.get<{Params:{round_id:string}}>("/competition/rounds/:round_id/shop",{exposeHeadRoute:false,preSerialization:boundedResponse(262144),
    schema:{params:competitionSchema.roundParams,querystring:schema.empty,response:schema.responses(shopSchema.view)}},
    async request=>wrap(request,await shop.view(request.cookies[policy.names.participant],request.params.round_id)));
  app.post<{Params:{round_id:string};Body:{request_key:string;item_id:string;target_id:string|null}}>("/competition/rounds/:round_id/shop/purchases",{
    onRequest:writeHooks("PARTICIPANT"),schema:{params:competitionSchema.roundParams,querystring:schema.empty,body:shopSchema.purchase,response:schema.responses(shopSchema.receipt)}},
    async request=>wrap(request,await shop.command(request.cookies[policy.names.participant],request.params.round_id,request.body.request_key,"SHOP_PURCHASE",{item_id:request.body.item_id,target_id:request.body.target_id})));
  app.post<{Params:{round_id:string};Body:{request_key:string;purchase_id:string;bounty_id:string}}>("/competition/rounds/:round_id/shop/activations",{
    onRequest:writeHooks("PARTICIPANT"),schema:{params:competitionSchema.roundParams,querystring:schema.empty,body:shopSchema.activation,response:schema.responses(shopSchema.receipt)}},
    async request=>wrap(request,await shop.command(request.cookies[policy.names.participant],request.params.round_id,request.body.request_key,"SHOP_ACTIVATE",{purchase_id:request.body.purchase_id,bounty_id:request.body.bounty_id})));
  app.get<{Params:{round_id:string;request_key:string}}>("/competition/rounds/:round_id/shop/outcomes/:request_key",{exposeHeadRoute:false,
    schema:{params:competitionSchema.outcomeParams,querystring:schema.empty,response:schema.responses(shopSchema.outcome)}},
    async request=>wrap(request,await shop.outcome(request.cookies[policy.names.participant],request.params.round_id,request.params.request_key)));
  app.get<{Params:{round_id:string;bounty_id:string}}>("/competition/rounds/:round_id/shop/intel/:bounty_id",{exposeHeadRoute:false,preSerialization:boundedResponse(524288),
    schema:{params:competitionSchema.bountyParams,querystring:schema.empty,response:schema.responses(shopSchema.intel)}},
    async request=>wrap(request,await shop.intel(request.cookies[policy.names.participant],request.params.round_id,request.params.bounty_id)));
  app.post<{ Params: { round_id: string; bounty_id: string }; Body: { request_key: string; level: number } }>("/competition/rounds/:round_id/bounties/:bounty_id/hints", {
    onRequest: writeHooks("PARTICIPANT"), schema: { querystring: schema.empty, params: competitionSchema.bountyParams, body: competitionSchema.hintBody, response: schema.responses(competitionSchema.receipt) },
  }, async request => wrap(request, await competition.buyHint(request.cookies[policy.names.participant], request.params.round_id, request.params.bounty_id, request.body.level, request.body.request_key)));
  app.get<{ Params: { round_id: string; bounty_id: string } }>("/competition/rounds/:round_id/bounties/:bounty_id/hints", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: competitionSchema.bountyParams, response: schema.responses(competitionSchema.hints) } },
  async request => wrap(request, await competition.hints(request.cookies[policy.names.participant], request.params.round_id, request.params.bounty_id)));
  app.post<{ Params: { round_id: string; bounty_id: string }; Body: { request_key: string; source: string } }>("/competition/rounds/:round_id/bounties/:bounty_id/submissions", {
    bodyLimit: 1048576, config: { participantSource: true }, onRequest: writeHooks("PARTICIPANT"),
    schema: { querystring: schema.empty, params: competitionSchema.bountyParams, body: competitionSchema.submitBody, response: schema.responses(competitionSchema.receipt) },
  }, async request => wrap(request, await competition.submit(request.cookies[policy.names.participant], request.params.round_id, request.params.bounty_id, request.body.source, request.body.request_key)));
  app.post<{ Params: { round_id: string; bounty_id: string }; Body: { request_key: string; source: string } }>("/competition/rounds/:round_id/bounties/:bounty_id/runs", {
    bodyLimit: 1048576, config: { participantSource: true }, onRequest: writeHooks("PARTICIPANT"),
    schema: { querystring: schema.empty, params: competitionSchema.bountyParams, body: competitionSchema.submitBody, response: schema.responses(competitionSchema.receipt) },
  }, async request => wrap(request, await competition.run(request.cookies[policy.names.participant], request.params.round_id, request.params.bounty_id, request.body.source, request.body.request_key)));
  app.get<{ Params: { round_id: string; parent_id: string } }>("/competition/rounds/:round_id/judging/:parent_id", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: competitionSchema.judgingParams, response: schema.responses(competitionSchema.judging) } },
  async request => wrap(request, await competition.judging(request.cookies[policy.names.participant], request.params.round_id, request.params.parent_id)));
  app.post<{ Params: { round_id: string; job_id: string }; Body: { request_key: string; reason: string; own_code: string } }>("/staff/competition/rounds/:round_id/jobs/:job_id/retry", {
    bodyLimit: 16384, onRequest: writeHooks("STAFF"), schema: { querystring: schema.empty, params: competitionSchema.retryParams, body: competitionSchema.retryBody, response: schema.responses(competitionSchema.receipt) },
  }, async request => wrap(request, await competition.retryJob(request.cookies[policy.names.staff], request.params.round_id, request.params.job_id, request.body.request_key, request.body.reason, request.body.own_code)));
  app.get<{ Params: { round_id: string }; Querystring: JudgingFilters & { after?: string } }>("/staff/competition/rounds/:round_id/judging", { exposeHeadRoute: false,preSerialization:boundedResponse(1048576),
    schema: { querystring: competitionSchema.queueQuery, params: competitionSchema.roundParams, response: schema.responses(competitionSchema.queue) } },
  async request => wrap(request, await competition.judgeQueue(request.cookies[policy.names.staff], request.params.round_id, request.query.after,request.query)));
  app.get<{Params:{round_id:string;parent_id:string}}>("/staff/competition/rounds/:round_id/judging/:parent_id",{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:competitionSchema.judgingParams,response:schema.responses(competitionSchema.judgeDetail)}},
    async request=>wrap(request,await competition.judgeDetail(request.cookies[policy.names.staff],request.params.round_id,request.params.parent_id)));
  app.get<{Params:{round_id:string;job_id:string};Querystring:{after?:string}}>("/staff/competition/rounds/:round_id/jobs/:job_id/recovery-history",{exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:competitionSchema.recoveryAuditQuery,params:competitionSchema.retryParams,response:schema.responses(competitionSchema.recoveryAudit)}},
    async request=>wrap(request,await competition.recoveryAudit(request.cookies[policy.names.staff],request.params.round_id,request.params.job_id,request.query.after)));
  app.post<{Params:{round_id:string;parent_id:string};Body:{request_key:string;confirm_parent_id:string;attempt_id:string|null;reason:string}}>("/staff/competition/rounds/:round_id/judging/:parent_id/reviews",{
    bodyLimit:16384,onRequest:writeHooks("STAFF"),preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:competitionSchema.judgingParams,body:reviewSchema.reviewBody,response:schema.responses(reviewSchema.review)}},
    async request=>wrap(request,await submissionReviews.open(request.cookies[policy.names.staff],request.params.round_id,request.params.parent_id,{requestKey:request.body.request_key,confirmParentId:request.body.confirm_parent_id,attemptId:request.body.attempt_id,reason:request.body.reason})));
  app.get<{Params:{round_id:string;parent_id:string;request_key:string}}>("/staff/competition/rounds/:round_id/judging/:parent_id/reviews/:request_key",{
    exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:schema.empty,params:reviewSchema.reviewOutcomeParams,response:schema.responses(reviewSchema.reviewOutcome)}},
    async request=>wrap(request,await submissionReviews.outcome(request.cookies[policy.names.staff],request.params.round_id,request.params.parent_id,request.params.request_key)));
  app.get<{Params:{round_id:string;parent_id:string};Querystring:{after?:string}}>("/staff/competition/rounds/:round_id/judging/:parent_id/reviews",{
    exposeHeadRoute:false,preSerialization:boundedResponse(1048576),schema:{querystring:competitionSchema.recoveryAuditQuery,params:competitionSchema.judgingParams,response:schema.responses(reviewSchema.reviewHistory)}},
    async request=>wrap(request,await submissionReviews.history(request.cookies[policy.names.staff],request.params.round_id,request.params.parent_id,request.query.after)));

  app.get<{ Querystring: { audience: Audience } }>("/bootstrap", { exposeHeadRoute: false,
    schema: { querystring: schema.bootstrapQuery, response: schema.responses(schema.bootstrapData) } }, async (request, reply) => {
    const audience = request.query.audience;
    let id = browserId(request, policy);
    if (!id && audience !== "ANONYMOUS") throw new AccessError("BROWSER_CONTEXT_REQUIRED");
    if (!id) { id = randomUUID(); reply.setCookie(policy.names.browser, id, { ...policy.cookie, signed: true, maxAge: 28800 }); }
    if (audience === "ANONYMOUS") return wrap(request, { audience, csrf_token: reply.generateCsrf({ userInfo: csrfContext(policy, audience, id) }) });
    if (!request.cookies[credentialName(audience)]) throw new AccessError("INVALID_SESSION");
    if (audience === "ENTRY") {
      const flow = await service.describe(request.cookies[policy.names.entry]);
      return wrap(request, { audience, flow: flowView(flow), csrf_token: reply.generateCsrf({ userInfo: context(request, audience) }) });
    }
    if (audience === "REPLACEMENT") {
      const result = await replacements.describe(request.cookies[policy.names.replacement]);
      return wrap(request, { audience, request: result, csrf_token: reply.generateCsrf({ userInfo: context(request, audience) }) });
    }
    if (audience === "STAFF_ENTRY" || audience === "STAFF_RECOVERY_ENTRY") {
      const flow=await staff.describe(request.cookies[credentialName(audience)],audience === "STAFF_RECOVERY_ENTRY");
      return wrap(request,{ audience, flow, csrf_token:reply.generateCsrf({ userInfo:context(request,audience) }) });
    }
    if (audience === "STAFF" || audience === "STAFF_RECOVERY") {
      const recovery=audience === "STAFF_RECOVERY";
      const principal=await staff.inspect(request.cookies[credentialName(audience)],recovery);
      await staffQuota(options.pool,recovery ? recoveryClock() : options.clock,principal.staff_id,"READ_STAFF");
      const current=await staff.inspect(request.cookies[credentialName(audience)],recovery);
      return wrap(request,{ audience,session:current,csrf_token:reply.generateCsrf({ userInfo:context(request,audience) }) });
    }
    const principal = await service.inspect(request.cookies[policy.names.participant]);
    await memberReadQuota(options.pool, options.clock, principal.memberId);
    const current = await service.inspect(request.cookies[policy.names.participant]);
    return wrap(request, { audience, session: sessionView(current), csrf_token: reply.generateCsrf({ userInfo: context(request, audience) }) });
  });

  app.post<{ Body: { code: string } }>("/entry/verify", { onRequest: writeHooks("ANONYMOUS"),
    schema: { querystring: schema.empty, body: schema.verifyBody, response: schema.responses(schema.verifyData) } }, async (request, reply) => {
    const args={ ip:clientAddress(request.raw, options.proxy),browserId:browserId(request,policy)! };
    const result = entryClock() === options.clock ? await service.begin(request.body.code,args) : await staff.beginRecovery(request.body.code,args);
    if (result.audience === "STAFF") {
      const audience=result.mode === "CLOCK_RECOVERY" ? "STAFF_RECOVERY_ENTRY" : "STAFF_ENTRY";
      reply.setCookie(credentialName(audience),result.proofCookie,{...policy.cookie,expires:new Date(result.expires_at)});
      return wrap(request,{ audience:"STAFF",flow:{flow_id:result.flow_id,mode:result.mode,expires_at:result.expires_at},
        csrf_token:reply.generateCsrf({ userInfo:csrfContext(policy,audience,browserId(request,policy)!,result.proofCookie) }) });
    }
    reply.setCookie(policy.names.entry, result.proofCookie, { ...policy.cookie, expires: new Date(result.expiresAt) });
    return wrap(request, { audience: "TEAM", flow: flowView({ ...result, state: "OPEN" }),
      csrf_token: reply.generateCsrf({ userInfo: csrfContext(policy, "ENTRY", browserId(request, policy)!, result.proofCookie) }) });
  });

  type Activated = Awaited<ReturnType<typeof service.activate>>;
  const activationResponse = (result: Activated, request: FastifyRequest, reply: FastifyReply) => {
    if (result.status === "REJECTED") return reply.code(409).send(wrap(request, { status: result.status, reason: result.reason }));
    reply.setCookie(policy.names.participant, result.sessionCookie, { ...policy.cookie, expires: new Date(result.session.absoluteExpiresAt) });
    return wrap(request, { status: result.status, session: sessionView(result.session),
      csrf_token: reply.generateCsrf({ userInfo: csrfContext(policy, "PARTICIPANT", browserId(request, policy)!, result.sessionCookie) }) });
  };
  const activationResponses = { ...schema.responses(schema.activationData), 409: { anyOf: [schema.rejection, schema.responses(schema.activationData).default] } };
  app.post<{ Body: { member_id: string; language: import("./credentials.js").Language; request_key: string } }>("/entry/activate", { onRequest: writeHooks("ENTRY"),
    schema: { querystring: schema.empty, body: schema.activationBody, response: activationResponses } }, async (request, reply) =>
    activationResponse(await service.activate(request.cookies[policy.names.entry], { memberId: request.body.member_id, language: request.body.language, requestKey: request.body.request_key }), request, reply));
  app.post("/entry/recover", { onRequest: writeHooks("ENTRY"),
    schema: { querystring: schema.empty, body: schema.empty, response: activationResponses } }, async (request, reply) =>
    activationResponse(await service.recover(request.cookies[policy.names.entry]), request, reply));

  app.post<{ Body: { member_id: string; request_key: string } }>("/entry/replacement", { bodyLimit: 16384, onRequest: writeHooks("ENTRY"),
    schema: { querystring: schema.empty, body: schema.replacementRequestBody, response: schema.responses(schema.replacementRequestData) } }, async (request, reply) => {
    const result = await replacements.request(request.cookies[policy.names.entry], { memberId: request.body.member_id, requestKey: request.body.request_key }, request.cookies[policy.names.participant]);
    if (result.status === "RESUME") return wrap(request, { status: result.status, session: sessionView(result.session),
      csrf_token: reply.generateCsrf({ userInfo: context(request, "PARTICIPANT") }) });
    reply.setCookie(policy.names.replacement, result.proofCookie, { ...policy.cookie, expires: new Date(result.request.expires_at) });
    return wrap(request, { status: result.status, request: result.request,
      csrf_token: reply.generateCsrf({ userInfo: csrfContext(policy, "REPLACEMENT", browserId(request, policy)!, result.proofCookie) }) });
  });
  app.post<{ Body: { request_key: string } }>("/entry/replacement/activate", { bodyLimit: 16384, onRequest: writeHooks("REPLACEMENT"),
    schema: { querystring: schema.empty, body: schema.staffActivationBody, response: activationResponses } }, async (request, reply) =>
    activationResponse(await replacements.activate(request.cookies[policy.names.replacement], request.body.request_key), request, reply));
  app.post("/entry/replacement/recover", { bodyLimit: 16384, onRequest: writeHooks("REPLACEMENT"),
    schema: { querystring: schema.empty, body: schema.empty, response: activationResponses } }, async (request, reply) =>
    activationResponse(await replacements.recover(request.cookies[policy.names.replacement]), request, reply));

  type SessionBody = { session_id: string; request_key: string };
  app.post<{ Body: SessionBody }>("/participant/keep-alive", { bodyLimit: 16384, onRequest: writeHooks("PARTICIPANT"),
    schema: { querystring: schema.empty, body: schema.participantSessionCommand, response: schema.responses(schema.participantKeepAliveData) } }, async (request) => {
    const result = await service.keepAlive(request.cookies[policy.names.participant], { sessionId: request.body.session_id, requestKey: request.body.request_key });
    return wrap(request, { session: sessionView(result.session), receipt: sessionReceipt(result.receipt) });
  });
  app.post<{ Body: SessionBody }>("/participant/logout", { bodyLimit: 16384, onRequest: writeHooks("PARTICIPANT"),
    schema: { querystring: schema.empty, body: schema.participantSessionCommand, response: schema.responses(schema.participantLogoutData) } }, async (request, reply) => {
    const result = await service.logout(request.cookies[policy.names.participant], { sessionId: request.body.session_id, requestKey: request.body.request_key });
    reply.clearCookie(policy.names.participant, policy.cookie); reply.clearCookie(policy.names.entry, policy.cookie);
    return wrap(request, { signed_out: result.signedOut, receipt: sessionReceipt(result.receipt) });
  });
  app.get<{ Params: SessionBody }>("/participant/session-outcomes/:session_id/:request_key", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: schema.participantSessionCommand, response: schema.responses(schema.participantOutcomeData) } }, async (request) => {
    const result = await service.sessionOutcome(request.cookies[policy.names.participant], { sessionId: request.params.session_id, requestKey: request.params.request_key });
    return wrap(request, { status: result.status, receipt: result.receipt ? sessionReceipt(result.receipt) : null });
  });

  for (const recovery of [false,true]) {
    const prefix=recovery ? "/staff/recovery" : "/staff";
    const flowAudience: Audience=recovery ? "STAFF_RECOVERY_ENTRY" : "STAFF_ENTRY";
    const sessionAudience: Audience=recovery ? "STAFF_RECOVERY" : "STAFF";
    const delivered=(result: Awaited<ReturnType<typeof staff.activate>>,request:FastifyRequest,reply:FastifyReply) => {
      reply.setCookie(credentialName(sessionAudience),result.sessionCookie,{...policy.cookie,expires:new Date(result.session.absolute_expires_at)});
      return wrap(request,{ session:result.session,csrf_token:reply.generateCsrf({ userInfo:csrfContext(policy,sessionAudience,browserId(request,policy)!,result.sessionCookie) }) });
    };
    app.post<{Body:{request_key:string}}>(`${prefix}/entry/activate`,{ config:{clockRecovery:recovery}, onRequest:writeHooks(flowAudience),
      schema:{querystring:schema.empty,body:schema.staffActivationBody,response:schema.responses(schema.staffActivationData)} },async(request,reply) =>
      delivered(await staff.activate(request.cookies[credentialName(flowAudience)],request.body.request_key,recovery),request,reply));
    app.post(`${prefix}/entry/recover`,{ config:{clockRecovery:recovery},onRequest:writeHooks(flowAudience),
      schema:{querystring:schema.empty,body:schema.empty,response:schema.responses(schema.staffActivationData)} },async(request,reply) =>
      delivered(await staff.recover(request.cookies[credentialName(flowAudience)],recovery),request,reply));
    app.post(`${prefix}/logout`,{config:{clockRecovery:recovery},onRequest:writeHooks(sessionAudience),
      schema:{querystring:schema.empty,body:schema.empty,response:schema.responses(schema.signedOut)} },async(request,reply) => {
      const result=await staff.logout(request.cookies[credentialName(sessionAudience)],recovery);
      reply.clearCookie(credentialName(sessionAudience),policy.cookie); reply.clearCookie(credentialName(flowAudience),policy.cookie);
      return wrap(request,result);
    });
  }
  app.post<{Body:{request_key:string}}>("/staff/keep-alive",{onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,body:schema.staffActivationBody,response:schema.responses(schema.staffSessionData)}},async(request) =>
    wrap(request,{session:await staff.keepAlive(request.cookies[policy.names.staff],request.body.request_key)}));
  app.get("/staff/recovery/clock",{config:{clockRecovery:true},exposeHeadRoute:false,
    schema:{querystring:schema.empty,response:schema.responses(schema.clockStatus)}},async(request) => wrap(request,await staff.clockStatus(request.cookies[policy.names.staffRecovery])));
  app.get<{Params:{request_key:string}}>("/staff/recovery/clock/outcomes/:request_key",{config:{clockRecovery:true},exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.replacementOutcomeParams,response:schema.responses(schema.clockOutcomeData)}},async request=>
    wrap(request,await staff.clockOutcome(request.cookies[policy.names.staffRecovery],request.params.request_key)));
  app.post<{Body:{own_code:string;request_key:string;runtime_id:string;generation:string;reason:string}}>("/staff/recovery/clock/clear",{
    config:{clockRecovery:true},onRequest:writeHooks("STAFF_RECOVERY"),schema:{querystring:schema.empty,body:schema.clockClearBody,response:schema.responses(schema.clockClearData)}},async(request) =>
    wrap(request,await staff.clearClock(request.cookies[policy.names.staffRecovery],{code:request.body.own_code,requestKey:request.body.request_key,
      runtimeId:request.body.runtime_id,generation:request.body.generation,reason:request.body.reason})));

  app.post<{Body:{action:"BLOCK"|"UNBLOCK"|"PENALISE"|"REVERSE";arena_id:string;team_id:string;member_id:string|null;round_id:string|null;
    block_id:string|null;original_id:string|null;minutes:number|null;expected_revision:string;request_key:string;reason:string;own_code:string}}>("/staff/discipline",{
    onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,body:schema.disciplineBody,response:schema.responses(schema.disciplineData)}},async request=>{
      const b=request.body;return wrap(request,await discipline.command(request.cookies[policy.names.staff],{action:b.action,arenaId:b.arena_id,teamId:b.team_id,
        memberId:b.member_id,roundId:b.round_id,blockId:b.block_id,originalId:b.original_id,minutes:b.minutes,expectedRevision:b.expected_revision,
        requestKey:b.request_key,reason:b.reason,ownCode:b.own_code}));
    });
  app.get<{Querystring:{arena_id:string;team_id:string;round_id:string;after?:string}}>("/staff/discipline",{exposeHeadRoute:false,
    schema:{querystring:schema.disciplineQuery,response:schema.responses(schema.disciplineListData)}},async request=>{
      const q=request.query;return wrap(request,await discipline.inspect(request.cookies[policy.names.staff],q.arena_id,q.team_id,q.round_id,q.after));
    });
  app.get<{Params:{request_key:string}}>("/staff/outcomes/discipline/:request_key",{exposeHeadRoute:false,
    schema:{params:schema.replacementOutcomeParams,querystring:schema.empty,response:schema.responses(schema.disciplineOutcomeData)}},async request=>
    wrap(request,await discipline.outcome(request.cookies[policy.names.staff],request.params.request_key)));

  app.post<{Body:{csv:string}}>("/staff/registrations/preview",{bodyLimit:2097152,config:{largeContent:true},onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,
    body:schema.registrationPreviewBody,response:schema.responses(schema.registrationPreviewData)}},async request=>
    wrap(request,await registrations.preview(request.cookies[policy.names.staff],request.body.csv)));
  app.post<{Body:{csv:string;csv_digest:string;expected_revision:string;request_key:string;own_code:string;reason:string}}>("/staff/registrations/import",{
    bodyLimit:2097152,config:{largeContent:true},onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,body:schema.registrationImportBody,response:schema.responses(schema.registrationImportData)}},async request=>{
      const b=request.body;return wrap(request,await registrations.commit(request.cookies[policy.names.staff],{csv:b.csv,csvDigest:b.csv_digest,expectedRevision:b.expected_revision,
        requestKey:b.request_key,ownCode:b.own_code,reason:b.reason}));
    });
  app.get<{Params:{request_key:string}}>("/staff/outcomes/registrations/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.replacementOutcomeParams,response:schema.responses(schema.registrationOutcomeData)}},async request=>
    wrap(request,await registrations.outcome(request.cookies[policy.names.staff],request.params.request_key)));

  type TeamBody={request_key:string;expected_revision:string;own_code:string;reason:string;team_name?:string;member_one?:string;member_two?:string};
  for(const action of ["CREATE","ROTATE","ISSUE","REVOKE"] as const) {
    app.post<{Body:TeamBody;Params:{team_id?:string}}>(action==="CREATE"?"/staff/teams":`/staff/teams/:team_id/${action.toLowerCase()}-code`,{
      bodyLimit:16384,onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,...(action==="CREATE"?{}:{params:schema.teamTargetParams}),
        body:action==="CREATE"?schema.teamCreateBody:schema.staffRotateBody,response:schema.responses(schema.teamManagementData)}},async request=>{
      const b=request.body;
      return wrap(request,await teamManagement.command(request.cookies[policy.names.staff],{action,targetId:request.params.team_id??null,
        requestKey:b.request_key,expectedRevision:b.expected_revision,ownCode:b.own_code,reason:b.reason,teamName:b.team_name??null,memberOne:b.member_one??null,memberTwo:b.member_two??null}));
    });
  }
  app.get<{Querystring:{after?:string;search?:string}}>("/staff/teams",{exposeHeadRoute:false,schema:{querystring:schema.teamListQuery,response:schema.responses(schema.teamListData)}},async request=>
    wrap(request,await teamManagement.list(request.cookies[policy.names.staff],request.query.after,request.query.search)));
  app.get<{Params:{request_key:string}}>("/staff/outcomes/teams/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.replacementOutcomeParams,response:schema.responses(schema.teamOutcomeData)}},async request=>
    wrap(request,await teamManagement.outcome(request.cookies[policy.names.staff],request.params.request_key)));

  type StaffBody={request_key:string;expected_revision:string;own_code:string;reason:string;display_name?:string;role?:"OWNER"|"ORGANISER";enabled?:boolean};
  const managedResponses={...schema.responses(schema.staffManagementData),409:{anyOf:[schema.envelope(schema.staffManagementData),schema.responses(schema.staffManagementData).default]}};
  for(const action of ["CREATE","UPDATE","ROTATE"] as const){
    const path=action==="CREATE"?"/staff/staff-identities":`/staff/staff-identities/:staff_id/${action==="UPDATE"?"update":"rotate-code"}`;
    app.post<{Body:StaffBody;Params:{staff_id?:string}}>(path,{bodyLimit:16384,onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,
      ...(action==="CREATE"?{}:{params:schema.staffTargetParams}),body:action==="CREATE"?schema.staffCreateBody:action==="UPDATE"?schema.staffUpdateBody:schema.staffRotateBody,response:managedResponses}},async(request,reply)=>{
      const b=request.body;
      const result=await management.command(request.cookies[policy.names.staff],{action,targetId:request.params.staff_id??null,requestKey:b.request_key,
        expectedRevision:b.expected_revision,ownCode:b.own_code,reason:b.reason,displayName:b.display_name??null,role:b.role??null,enabled:action==="CREATE"?true:b.enabled??null});
      if(result.outcome.outcome==="REJECTED")reply.code(409);
      return wrap(request,result);
    });
  }
  app.get<{Querystring:{after?:string}}>("/staff/staff-identities",{exposeHeadRoute:false,schema:{querystring:schema.staffListQuery,response:schema.responses(schema.staffListData)}},async(request)=>
    wrap(request,await management.list(request.cookies[policy.names.staff],request.query.after)));
  app.get<{Params:{action:StaffAction;target:string;request_key:string}}>("/staff/outcomes/staff/:action/:target/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.staffOutcomeParams,response:schema.responses(schema.staffOutcomeData)}},async(request)=>
    wrap(request,await management.outcome(request.cookies[policy.names.staff],request.params.action,request.params.target==="security"?null:request.params.target,request.params.request_key)));
  app.get<{ Querystring: { after?: string } }>("/staff/replacements", { exposeHeadRoute: false,
    schema: { querystring: schema.staffListQuery, response: schema.responses(schema.replacementListData) } }, async (request) =>
    wrap(request, await replacements.list(request.cookies[policy.names.staff], request.query.after)));
  app.post<{ Params: { request_id: string }; Body: { request_key: string; action: "APPROVE" | "REJECT"; expected_revision: string; reason: string } }>("/staff/replacements/:request_id/decision", {
    bodyLimit: 16384, onRequest: writeHooks("STAFF"), schema: { querystring: schema.empty, params: schema.replacementParams, body: schema.replacementDecisionBody,
      response: { ...schema.responses(schema.replacementReceipt), 409: { anyOf: [schema.envelope(schema.replacementReceipt), schema.responses(schema.replacementReceipt).default] } } } }, async (request, reply) => {
    const b = request.body;
    const result = await replacements.decide(request.cookies[policy.names.staff], { flowId: request.params.request_id, requestKey: b.request_key, action: b.action, expectedRevision: b.expected_revision, reason: b.reason });
    if (result.outcome === "REJECTED") reply.code(409);
    return wrap(request, result);
  });
  app.get<{ Params: { request_key: string } }>("/staff/outcomes/replacements/:request_key", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: schema.replacementOutcomeParams, response: schema.responses(schema.replacementOutcomeData) } }, async (request) =>
    wrap(request, await replacements.outcome(request.cookies[policy.names.staff], request.params.request_key)));

  type ArenaBody = { request_key: string; expected_revision: string; duration_ms: number; team_ids: string[]; reason: string };
  for (const action of ["CREATE", "CONFIGURE"] as const) {
    app.post<{ Body: ArenaBody; Params: { round_id?: string } }>(action === "CREATE" ? "/staff/arenas" : "/staff/arenas/rounds/:round_id/configuration", {
      bodyLimit: 16384, onRequest: writeHooks("STAFF"), schema: { querystring: schema.empty, ...(action === "CREATE" ? {} : { params: schema.arenaRoundParams }),
        body: schema.arenaSetupBody, response: { ...schema.responses(schema.arenaSetupReceipt),
          409: { anyOf: [schema.envelope(schema.arenaSetupReceipt), schema.responses(schema.arenaSetupReceipt).default] } } } }, async (request, reply) => {
      const b = request.body;
      const result = await arenas.command(request.cookies[policy.names.staff], { action, roundId: request.params.round_id ?? null, requestKey: b.request_key,
        expectedRevision: b.expected_revision, durationMs: b.duration_ms, teamIds: b.team_ids, reason: b.reason });
      if (result.outcome === "REJECTED") reply.code(409);
      return wrap(request, result);
    });
  }
  app.get("/staff/arenas/current", { exposeHeadRoute: false, schema: { querystring: schema.empty, response: schema.responses(schema.arenaCurrentData) } }, async request =>
    wrap(request, await arenas.current(request.cookies[policy.names.staff])));
  app.get<{ Querystring: { after?: string } }>("/staff/arena-teams", { exposeHeadRoute: false,
    schema: { querystring: schema.staffListQuery, response: schema.responses(schema.arenaTeamsData) } }, async request =>
    wrap(request, await arenas.teams(request.cookies[policy.names.staff], request.query.after)));
  app.get<{ Params: { action: "CREATE" | "CONFIGURE"; target: string; request_key: string } }>("/staff/outcomes/arena-setup/:action/:target/:request_key", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: schema.arenaOutcomeParams, response: schema.responses(schema.arenaOutcomeData) } }, async request =>
    wrap(request, await arenas.outcome(request.cookies[policy.names.staff], request.params.action, request.params.target === "arena" ? null : request.params.target, request.params.request_key)));

  type ContentBody = { request_key: string; expected_revision: string; reason: string; payload: unknown };
  for (const action of ["CREATE", "NEW_VERSION", "EDIT"] as const) {
    const path = action === "CREATE" ? "/staff/content/definitions" : action === "NEW_VERSION" ? "/staff/content/definitions/:definition_id/versions" : "/staff/content/versions/:version_id/:operation";
    app.post<{ Body: ContentBody; Params: { definition_id?: string; version_id?: string; operation?: ContentAction } }>(path, {
      bodyLimit: action === "EDIT" ? 16777216 : 524288, config: { largeContent: true }, onRequest: writeHooks("STAFF"),
      schema: { querystring: schema.empty, ...(action === "CREATE" ? {} : { params: action === "NEW_VERSION" ? schema.contentDefinitionParams : schema.contentOperationParams }),
        body: schema.contentCommandBody, response: { ...schema.responses(schema.contentReceipt),
          409: { anyOf: [schema.envelope(schema.contentReceipt), schema.responses(schema.contentReceipt).default] } } } }, async (request, reply) => {
      const b = request.body;
      const result = await content.command(request.cookies[policy.names.staff], { action: action === "EDIT" ? request.params.operation! : action,
        targetId: request.params.version_id ?? request.params.definition_id ?? null, requestKey: b.request_key, expectedRevision: b.expected_revision, reason: b.reason, payload: b.payload });
      if (result.outcome === "REJECTED") reply.code(409);
      return wrap(request, result);
    });
  }
  app.get<{ Querystring: { after?: string } }>("/staff/content/versions", { exposeHeadRoute: false, schema: { querystring: schema.staffListQuery, response: schema.responses(schema.contentListData) } }, async request =>
    wrap(request, await content.list(request.cookies[policy.names.staff], request.query.after)));
  app.get<{ Params: { version_id: string } }>("/staff/content/versions/:version_id", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: schema.contentVersionParams, response: schema.responses(schema.contentDescribeData) } }, async request =>
    wrap(request, await content.describe(request.cookies[policy.names.staff], request.params.version_id)));
  for (const section of ["VARIANTS", "CASES", "HINTS", "WITNESSES"] as const) {
    const suffix = section === "VARIANTS" ? "variants/:language" : section === "CASES" ? "cases/:case_id" : section.toLowerCase();
    app.get<{ Params: { version_id: string; language?: string; case_id?: string } }>(`/staff/content/versions/:version_id/${suffix}`, { exposeHeadRoute: false,
      config: { largeContent: section === "VARIANTS" || section === "CASES" }, schema: { querystring: schema.empty,
        params: section === "VARIANTS" ? schema.contentVariantParams : section === "CASES" ? schema.contentCaseParams : schema.contentVersionParams,
        response: schema.responses(schema.contentPrivateData) } }, async request =>
      wrap(request, await content.privateRead(request.cookies[policy.names.staff], request.params.version_id, section, request.params.language ?? request.params.case_id)));
  }
  app.get<{ Params: { action: ContentAction; target: string; request_key: string } }>("/staff/outcomes/content/:action/:target/:request_key", { exposeHeadRoute: false,
    schema: { querystring: schema.empty, params: schema.contentOutcomeParams, response: schema.responses(schema.contentOutcomeData) } }, async request =>
    wrap(request, await content.outcome(request.cookies[policy.names.staff], request.params.action, request.params.target === "catalogue" ? null : request.params.target, request.params.request_key)));

  app.get<{Querystring:{family:string;arena_id?:string;after?:string}}>("/staff/audit",{exposeHeadRoute:false,
    schema:{querystring:auditQuery,response:schema.responses(auditPage)},
  },async request=>wrap(request,await audit.list(request.cookies[policy.names.staff],request.query.family,request.query.arena_id,request.query.after)));
  app.post<{ Params: { version_id: string }; Body: { request_key: string; expected_revision: string; reason: string } }>("/staff/content/versions/:version_id/prepare-validation", {
    bodyLimit: 16384, config: { largeContent: true }, onRequest: writeHooks("STAFF"),
    schema: { querystring: schema.empty, params: schema.contentVersionParams, body: schema.validationPrepareBody,
      response: { ...schema.responses(schema.validationPrepareReceipt),409:{ anyOf:[schema.envelope(schema.validationPrepareReceipt),schema.responses(schema.validationPrepareReceipt).default] } } },
  }, async (request,reply) => {
    const result = await validation.prepare(request.cookies[policy.names.staff], { versionId:request.params.version_id,requestKey:request.body.request_key,
      expectedRevision:request.body.expected_revision,reason:request.body.reason });
    if (result.outcome === "REJECTED") reply.code(409);
    return wrap(request,result);
  });
  app.get<{ Params: { version_id: string; request_key: string } }>("/staff/outcomes/validation-preparation/:version_id/:request_key", { exposeHeadRoute:false,
    schema:{ querystring:schema.empty,params:schema.validationOutcomeParams,response:schema.responses(schema.validationOutcomeData) } }, async request =>
    wrap(request,await validation.outcome(request.cookies[policy.names.staff],request.params.version_id,request.params.request_key)));
  for (const section of ["SUMMARY","CHECKS"] as const) {
    app.get<{ Params: { snapshot_id:string } }>(`/staff/content/validation-snapshots/:snapshot_id/${section.toLowerCase()}`, { exposeHeadRoute:false,
      schema:{ querystring:schema.empty,params:schema.validationSnapshotParams,response:schema.responses(schema.validationSnapshotData) } }, async request =>
      wrap(request,await validation.describe(request.cookies[policy.names.staff],request.params.snapshot_id,section)));
  }
  app.post<{Params:{snapshot_id:string};Body:{request_key:string;expected_revision:string;reason:string}}>("/staff/content/validation-snapshots/:snapshot_id/runs",{
    bodyLimit:16384,onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,params:schema.validationSnapshotParams,body:schema.validationPrepareBody,
      response:{...schema.responses(schema.validationRunReceipt),409:{anyOf:[schema.envelope(schema.validationRunReceipt),schema.responses(schema.validationRunReceipt).default]}}},
  },async(request,reply)=>{
    const result=await validationRuns.admit(request.cookies[policy.names.staff],{snapshotId:request.params.snapshot_id,expectedRevision:request.body.expected_revision,requestKey:request.body.request_key,reason:request.body.reason});
    if(result.outcome==="REJECTED")reply.code(409);return wrap(request,result);
  });
  app.get<{Params:{version_id:string};Querystring:{after?:string}}>("/staff/content/versions/:version_id/validation-snapshots",{exposeHeadRoute:false,
    schema:{querystring:schema.staffListQuery,params:schema.contentVersionParams,response:schema.responses(schema.validationSnapshotsPage)}},async request=>wrap(request,await validation.snapshots(request.cookies[policy.names.staff],request.params.version_id,request.query.after)));
  app.get<{Params:{snapshot_id:string};Querystring:{after?:string}}>("/staff/content/validation-snapshots/:snapshot_id/runs",{exposeHeadRoute:false,
    schema:{querystring:schema.staffListQuery,params:schema.validationSnapshotParams,response:schema.responses(schema.validationRunsPage)}},async request=>wrap(request,await validationRuns.list(request.cookies[policy.names.staff],request.params.snapshot_id,request.query.after)));
  app.get<{Params:{run_id:string}}>("/staff/content/validation-runs/:run_id",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.validationRunParams,response:schema.responses(schema.validationRunReport)}},async request=>wrap(request,await validationRuns.report(request.cookies[policy.names.staff],request.params.run_id)));
  app.post<{Params:{run_id:string};Body:{request_key:string;confirm_run_id:string;attempt_id:string;reason:string}}>("/staff/content/validation-runs/:run_id/diagnostics",{
    bodyLimit:16384,onRequest:writeHooks("STAFF"),schema:{querystring:schema.empty,params:schema.validationRunParams,body:diagnosticSchema.diagnosticBody,response:schema.responses(diagnosticSchema.diagnostic)},
  },async request=>wrap(request,await diagnostics.open(request.cookies[policy.names.staff],request.params.run_id,{requestKey:request.body.request_key,confirmRunId:request.body.confirm_run_id,attemptId:request.body.attempt_id,reason:request.body.reason})));
  app.get<{Params:{run_id:string;request_key:string}}>("/staff/content/validation-runs/:run_id/diagnostics/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:diagnosticSchema.diagnosticOutcomeParams,response:schema.responses(diagnosticSchema.diagnosticOutcome)},
  },async request=>wrap(request,await diagnostics.outcome(request.cookies[policy.names.staff],request.params.run_id,request.params.request_key)));
  app.get<{Params:{run_id:string};Querystring:{after?:string}}>("/staff/content/validation-runs/:run_id/diagnostics",{exposeHeadRoute:false,
    schema:{querystring:schema.staffListQuery,params:schema.validationRunParams,response:schema.responses(diagnosticSchema.diagnosticHistory)},
  },async request=>wrap(request,await diagnostics.history(request.cookies[policy.names.staff],request.params.run_id,request.query.after)));
  app.get<{Params:{snapshot_id:string;request_key:string}}>("/staff/outcomes/validation-run/:snapshot_id/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.validationRunOutcomeParams,response:schema.responses(schema.validationRunOutcomeData)}},async request=>wrap(request,await validationRuns.outcome(request.cookies[policy.names.staff],request.params.snapshot_id,request.params.request_key)));
};
