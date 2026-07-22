#!/usr/bin/env node

import pg from "pg";

const { Client } = pg;

function option(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function date(value, name) {
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${name} must be a valid date`);
  return parsed;
}

const databaseUrl = process.env.DATABASE_URL || option("--database-url");
const slug = option("--organization-slug");
const from = date(option("--from"), "--from");
const to = date(option("--to"), "--to");
if (!databaseUrl || !slug || to <= from) {
  throw new Error("Usage: verify-m8-longitudinal-real-team.mjs --organization-slug <slug> --from <date> --to <date>");
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(`
    WITH org AS (SELECT id, name, slug FROM organizations WHERE slug = $1),
    people AS (
      SELECT count(*)::int AS people,
             count(*) FILTER (WHERE coalesce(p.email, u.email, '') LIKE '%@loopos.test')::int AS smoke_people
      FROM people p LEFT JOIN users u ON u.id = p."userId" JOIN org o ON o.id = p."organizationId"
    ),
    users AS (
      SELECT count(*) FILTER (WHERE u.email NOT LIKE '%@loopos.test')::int AS real_users,
             count(*) FILTER (WHERE u.email LIKE '%@loopos.test')::int AS smoke_users
      FROM memberships m JOIN users u ON u.id = m."userId" JOIN org o ON o.id = m."organizationId"
    ),
    meetings AS (
      SELECT count(*)::int AS meetings,
             count(*) FILTER (WHERE type = 'TACTICAL')::int AS tactical_meetings,
             count(*) FILTER (WHERE "endedAt" IS NOT NULL OR notes IS NOT NULL)::int AS recorded_meetings
      FROM meetings m JOIN org o ON o.id = m."organizationId" WHERE "startedAt" >= $2 AND "startedAt" < $3
    ),
    tensions AS (
      SELECT count(*)::int AS tensions,
             count(*) FILTER (WHERE "handlingMode" IN ('TACTICAL','GOVERNANCE'))::int AS routed_tensions,
             count(*) FILTER (WHERE status IN ('RESOLVED','REJECTED','ASSIGNED'))::int AS closed_tensions
      FROM tensions t JOIN org o ON o.id = t."organizationId" WHERE "createdAt" >= $2 AND "createdAt" < $3
    ),
    tactical AS (
      SELECT count(*)::int AS proposals,
             count(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
             count(*) FILTER (WHERE status = 'APPROVED' AND ("outcomeProjectId" IS NOT NULL OR "outcomeActionId" IS NOT NULL))::int AS closed_outputs
      FROM tactical_outcome_proposals p JOIN org o ON o.id = p."organizationId" WHERE "createdAt" >= $2 AND "createdAt" < $3
    ),
    governance AS (
      SELECT count(*)::int AS processes,
             count(*) FILTER (WHERE state IN ('ADOPTED','NOT_ADOPTED'))::int AS terminal_processes
      FROM governance_decision_processes p JOIN org o ON o.id = p."organizationId" WHERE "createdAt" >= $2 AND "createdAt" < $3
    ),
    brain AS (
      SELECT count(*)::int AS turns,
             count(*) FILTER (WHERE m.content LIKE '%模型不可用%' OR m.content LIKE '%处理失败%')::int AS unavailable_turns
      FROM brain_messages m JOIN brain_conversations c ON c.id = m."conversationId" JOIN org o ON o.id = m."organizationId"
      WHERE m.role = 'BRAIN' AND m."createdAt" >= $2 AND m."createdAt" < $3
    )
    SELECT (SELECT json_build_object('id', id, 'name', name, 'slug', slug) FROM org) AS organization,
      (SELECT json_build_object('people', people, 'smoke_people', smoke_people) FROM people) AS people,
      (SELECT json_build_object('real_users', real_users, 'smoke_users', smoke_users) FROM users) AS users,
      (SELECT json_build_object('meetings', meetings, 'tactical_meetings', tactical_meetings, 'recorded_meetings', recorded_meetings) FROM meetings) AS meetings,
      (SELECT json_build_object('tensions', tensions, 'routed_tensions', routed_tensions, 'closed_tensions', closed_tensions) FROM tensions) AS tensions,
      (SELECT json_build_object('proposals', proposals, 'approved', approved, 'closed_outputs', closed_outputs) FROM tactical) AS tactical,
      (SELECT json_build_object('processes', processes, 'terminal_processes', terminal_processes) FROM governance) AS governance,
      (SELECT json_build_object('turns', turns, 'unavailable_turns', unavailable_turns) FROM brain) AS brain
  `, [slug, from, to]);
  const row = result.rows[0];
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const gates = {
    organizationFound: Boolean(row.organization),
    fourWeekWindow: days >= 28,
    realParticipants: Number(row.people?.people ?? 0) >= 2 && Number(row.users?.real_users ?? 0) >= 2 && Number(row.people?.smoke_people ?? 0) === 0 && Number(row.users?.smoke_users ?? 0) === 0,
    meetingRhythm: Number(row.meetings?.tactical_meetings ?? 0) >= 4 && Number(row.meetings?.recorded_meetings ?? 0) >= 4,
    tensionClosure: Number(row.tensions?.tensions ?? 0) > 0 && Number(row.tensions?.closed_tensions ?? 0) > 0,
    outputsClosed: Number(row.tactical?.closed_outputs ?? 0) + Number(row.governance?.terminal_processes ?? 0) > 0,
  };
  const output = { ok: Object.values(gates).every(Boolean), mode: "m8-longitudinal-real-team", slug, from: from.toISOString(), to: to.toISOString(), days, gates, metrics: row };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.ok ? 0 : 1;
} finally {
  await client.end();
}
