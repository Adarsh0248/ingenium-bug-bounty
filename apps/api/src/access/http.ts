import { randomUUID } from "node:crypto";
import cookie from "@fastify/cookie";
import csrf from "@fastify/csrf-protection";
import helmet from "@fastify/helmet";
import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { browserId, browserPolicy, boundedCookies, csrfContext, requestOrigin } from "./browser-policy.js";
import type { Audience, BrowserSettings } from "./browser-policy.js";
import type { SessionDelivery } from "./credentials.js";
import { createEntryService } from "./entry-service.js";
import { browserHttpQuota, memberReadQuota, staffQuota } from "./quotas.js";
import { createStaffService } from "./staff-service.js";
import { createStaffManagement } from "./staff-management.js";
import { createReplacementService } from "./replacement-service.js";
import { createArenaService } from "./arena-service.js";
import { createContentService } from "../content/service.js";
import { createValidationService } from "../content/validation-service.js";
import { createValidationRunService } from "../content/validation-runs.js";
import type { ContentAction } from "../content/policy.js";
import type { StaffAction } from "./staff-management.js";
import { AccessError } from "./transaction.js";
import type { ClockGuard } from "./transaction.js";
import * as schema from "./http-schemas.js";

declare module "fastify" {
  interface FastifyRequest { entryCsrfContext: string; }
  interface FastifyContextConfig { clockRecovery?: boolean; largeContent?: boolean; }
}
export interface EntryHttpOptions { pool: Pool; clock: ClockGuard; recoveryClock?: ClockGuard; delivery: SessionDelivery; browser: BrowserSettings; }

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
  const replacements = createReplacementService(options.pool, options.clock, options.delivery);
  const arenas = createArenaService(options.pool, options.clock, options.delivery);
  const content = createContentService(options.pool, options.clock, options.delivery);
  const validation = createValidationService(options.pool, options.clock, options.delivery);
  const validationRuns = createValidationRunService(options.pool, options.clock, options.delivery);
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
    if (pending.size >= 128) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
    pending.add(request);
    boundedCookies(request, policy);
    requestOrigin(request, policy);
    if (request.headers["content-encoding"] !== undefined) throw new AccessError("UNSUPPORTED_ENCODING");
    if (request.method === "POST" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers["content-type"] ?? "")) throw new AccessError("JSON_REQUIRED");
    const bootstrapAudience = request.routeOptions.url === "/api/v1/bootstrap" ? new URL(request.url,"http://local").searchParams.get("audience") : null;
    const quotaClock = request.routeOptions.config.clockRecovery ? recoveryClock() :
      request.routeOptions.url === "/api/v1/entry/verify" || bootstrapAudience === "ANONYMOUS" ? entryClock() :
      bootstrapAudience?.startsWith("STAFF_RECOVERY") ? recoveryClock() : options.clock;
    try { await browserHttpQuota(options.pool, quotaClock, request.ip); }
    finally { if (request.raw.aborted) release(request); }
    waitingBody.add(request);
    if (request.routeOptions.config.largeContent) {
      const actor = await staff.inspect(request.cookies[policy.names.staff]);
      if (actor.role === "ORGANISER") throw new AccessError("ACCESS_UNAVAILABLE");
      if (largeContent.size >= 2) throw new AccessError("REQUEST_CAPACITY_UNAVAILABLE");
      largeContent.add(request);
      reply.raw.once("close", () => { if (!pending.has(request)) largeContent.delete(request); });
    }
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
      else if (["ORIGIN_DENIED", "ACCESS_UNAVAILABLE"].includes(error.code)) { status = 403; code = "ACCESS_DENIED"; }
      else if (["ROUND_OR_MEMBER_UNAVAILABLE","STAFF_TARGET_UNAVAILABLE","REPLACEMENT_UNAVAILABLE","ARENA_UNAVAILABLE","CONTENT_UNAVAILABLE"].includes(error.code)) { status = 404; code = "SCOPE_UNAVAILABLE"; }
      else if (["INVALID_HEADERS", "INVALID_CONTEXT"].includes(error.code)) { status = 400; code = "INVALID_REQUEST"; }
      else if (error.code === "CONTENT_LIMIT_EXCEEDED") { status = 400; code = "CONTENT_LIMIT_EXCEEDED"; }
      else if (["UNSUPPORTED_ENCODING", "JSON_REQUIRED"].includes(error.code)) { status = 415; code = "JSON_REQUIRED"; }
      else if (error.code === "RATE_LIMITED") { status = 429; code = "RATE_LIMITED"; reply.header("Retry-After", String(Math.max(1, Math.min(60, error.retryAfterSeconds ?? 1)))); }
      else if (error.code === "INTENT_CONFLICT") { status = 409; code = "INTENT_KEY_REUSED"; }
      else if (error.code === "HANDOFF_NOT_READY") { status = 409; code = "HANDOFF_NOT_READY"; }
      else if (error.code === "REQUEST_CAPACITY_UNAVAILABLE") { code = "CAPACITY_UNAVAILABLE"; outcome = "NOT_PROCESSED"; }
      if (status !== 503) outcome = "NOT_PROCESSED";
    } else if (failure?.code?.startsWith("FST_CSRF_")) { status = 403; code = "CSRF_DENIED"; outcome = "NOT_PROCESSED"; }
    else if (failure?.validation || failure?.statusCode === 400 || failure?.statusCode === 413 || failure?.statusCode === 415) {
      status = failure.statusCode === 413 ? 413 : failure.statusCode === 415 ? 415 : 400;
      code = status === 413 ? "BODY_TOO_LARGE" : "INVALID_REQUEST"; outcome = "NOT_PROCESSED";
    }
    if (status === 503) request.log.warn({ event: "entry_request_unavailable", trace_id: request.id }, "Entry request could not be completed.");
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

  app.get<{ Querystring: { audience: Audience } }>("/bootstrap", { exposeHeadRoute: false,
    schema: { querystring: schema.bootstrapQuery, response: schema.responses(schema.bootstrapData) } }, async (request, reply) => {
    const audience = request.query.audience;
    let id = browserId(request, policy);
    if (!id && audience !== "ANONYMOUS") throw new AccessError("BROWSER_CONTEXT_REQUIRED");
    if (!id) { id = randomUUID(); reply.setCookie(policy.names.browser, id, { ...policy.cookie, signed: true, maxAge: 28800 }); }
    if (audience === "ANONYMOUS") return wrap(request, { audience, csrf_token: reply.generateCsrf({ userInfo: csrfContext(policy, audience, id) }) });
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
    const args={ ip:request.ip,browserId:browserId(request,policy)! };
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
  app.post<{Body:{own_code:string;request_key:string;runtime_id:string;generation:string;reason:string}}>("/staff/recovery/clock/clear",{
    config:{clockRecovery:true},onRequest:writeHooks("STAFF_RECOVERY"),schema:{querystring:schema.empty,body:schema.clockClearBody,response:schema.responses(schema.clockClearData)}},async(request) =>
    wrap(request,await staff.clearClock(request.cookies[policy.names.staffRecovery],{code:request.body.own_code,requestKey:request.body.request_key,
      runtimeId:request.body.runtime_id,generation:request.body.generation,reason:request.body.reason})));

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
  app.get<{Params:{run_id:string}}>("/staff/content/validation-runs/:run_id",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.validationRunParams,response:schema.responses(schema.validationRunReport)}},async request=>wrap(request,await validationRuns.report(request.cookies[policy.names.staff],request.params.run_id)));
  app.get<{Params:{snapshot_id:string;request_key:string}}>("/staff/outcomes/validation-run/:snapshot_id/:request_key",{exposeHeadRoute:false,
    schema:{querystring:schema.empty,params:schema.validationRunOutcomeParams,response:schema.responses(schema.validationRunOutcomeData)}},async request=>wrap(request,await validationRuns.outcome(request.cookies[policy.names.staff],request.params.snapshot_id,request.params.request_key)));
};
