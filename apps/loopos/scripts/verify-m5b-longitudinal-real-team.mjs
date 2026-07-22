#!/usr/bin/env node

import pg from "pg";

const { Client } = pg;

function parseArgs(argv) {
  const options = {
    databaseUrl: process.env.DATABASE_URL,
    organizationSlug: "",
    from: "",
    to: "",
    minPeople: 2,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--database-url") {
      options.databaseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--organization-slug") {
      options.organizationSlug = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--from") {
      options.from = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--to") {
      options.to = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--min-people") {
      options.minPeople = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.databaseUrl) throw new Error("DATABASE_URL or --database-url is required");
  if (!options.organizationSlug) throw new Error("--organization-slug is required");
  if (!Number.isInteger(options.minPeople) || options.minPeople < 1) {
    throw new Error("--min-people must be a positive integer");
  }

  const from = parseDate(options.from, "--from");
  const to = parseDate(options.to, "--to");
  if (to <= from) throw new Error("--to must be after --from");

  return { ...options, from, to };
}

function printHelp() {
  console.log(`Usage: node scripts/verify-m5b-longitudinal-real-team.mjs [options]

Required:
  --organization-slug <slug>  Real team organization slug to verify
  --from <date>               Inclusive window start, YYYY-MM-DD or ISO timestamp
  --to <date>                 Exclusive window end, YYYY-MM-DD or ISO timestamp

Options:
  --database-url <url>        Database URL. Default: DATABASE_URL
  --min-people <n>            Minimum real people with non-test emails. Default: 2
  --json                      Print JSON output

This verifier is read-only. It proves whether a real team left enough evidence
for one weekly tension-to-closure operating loop. It does not create evidence
and it intentionally rejects loopos.test smoke tenants.
`);
}

function parseDate(value, label) {
  if (!value) throw new Error(`${label} is required`);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date`);
  return date;
}

function gate(name, ok, detail, evidence = {}) {
  return { name, ok, detail, evidence };
}

function count(rows, key) {
  return Number(rows[0]?.[key] ?? 0);
}

async function one(client, sql, values) {
  const result = await client.query(sql, values);
  return result.rows[0] ?? {};
}

async function facts(client, options) {
  const org = await one(
    client,
    `select id, name, slug from organizations where slug = $1`,
    [options.organizationSlug],
  );
  if (!org.id) return { organization: null };

  const base = [org.id, options.from, options.to];
  const people = await one(
    client,
    `
      select
        count(distinct p.id)::int as real_people,
        count(*) filter (
          where coalesce(p.email, u.email, '') like '%@loopos.test'
        )::int as smoke_people
      from people p
      left join users u on u.id = p."userId"
      where p."organizationId" = $1
    `,
    [org.id],
  );
  const users = await one(
    client,
    `
      select
        count(distinct u.id) filter (where u.email not like '%@loopos.test')::int as real_users,
        count(*) filter (where u.email like '%@loopos.test')::int as smoke_users
      from memberships m
      join users u on u.id = m."userId"
      where m."organizationId" = $1
    `,
    [org.id],
  );
  const meetings = await one(
    client,
    `
      select
        count(*)::int as meetings,
        count(*) filter (where type = 'TACTICAL')::int as tactical_meetings,
        count(*) filter (where type = 'GOVERNANCE')::int as governance_meetings,
        count(*) filter (where "endedAt" is not null or notes is not null)::int as recorded_meetings
      from meetings
      where "organizationId" = $1
        and "startedAt" >= $2
        and "startedAt" < $3
    `,
    base,
  );
  const tensions = await one(
    client,
    `
      select
        count(*)::int as tensions,
        count(*) filter (where "handlingMode" in ('TACTICAL', 'GOVERNANCE'))::int as routed_tensions,
        count(*) filter (where status in ('RESOLVED', 'REJECTED'))::int as closed_tensions,
        count(*) filter (where "handlingMode" = 'GOVERNANCE')::int as governance_tensions
      from tensions
      where "organizationId" = $1
        and "createdAt" >= $2
        and "createdAt" < $3
    `,
    base,
  );
  const tactical = await one(
    client,
    `
      select
        count(*)::int as proposals,
        count(*) filter (where status = 'APPROVED')::int as approved,
        count(*) filter (where status = 'APPROVED' and "outcomeProjectId" is not null)::int as approved_projects,
        count(*) filter (where status = 'APPROVED' and "outcomeActionId" is not null)::int as approved_actions
      from tactical_outcome_proposals
      where "organizationId" = $1
        and "createdAt" >= $2
        and "createdAt" < $3
    `,
    base,
  );
  const governance = await one(
    client,
    `
      select
        count(*)::int as processes,
        count(*) filter (where state in ('ADOPTED', 'NOT_ADOPTED'))::int as terminal_processes,
        count(*) filter (where "decisionId" is not null or "changeLogId" is not null or "outcomeRoleId" is not null)::int as applied_outcomes
      from governance_decision_processes
      where "organizationId" = $1
        and "createdAt" >= $2
        and "createdAt" < $3
    `,
    base,
  );
  const goals = await one(
    client,
    `
      select
        count(distinct gc.id)::int as cycles,
        count(distinct g.id)::int as goals,
        count(distinct gt.id)::int as targets,
        count(distinct gci.id)::int as check_ins,
        count(distinct gwl.id)::int as work_links,
        count(*) filter (where duplicate.active_count > 1)::int as duplicate_active_goal_scopes
      from goal_cycles gc
      left join goals g on g."organizationId" = gc."organizationId" and g."cycleId" = gc.id
      left join goal_targets gt on gt."organizationId" = g."organizationId" and gt."goalId" = g.id
      left join goal_check_ins gci on gci."organizationId" = g."organizationId"
        and gci."goalId" = g.id
        and gci."recordedAt" >= $2
        and gci."recordedAt" < $3
      left join goal_work_links gwl on gwl."organizationId" = g."organizationId" and gwl."goalId" = g.id
      left join lateral (
        select count(*)::int as active_count
        from goals active_goal
        where active_goal."organizationId" = gc."organizationId"
          and active_goal."cycleId" = gc.id
          and active_goal."circleId" = g."circleId"
          and active_goal.status = 'ACTIVE'
      ) duplicate on true
      where gc."organizationId" = $1
        and gc."startAt" < $3
        and gc."endAt" > $2
    `,
    base,
  );

  return {
    organization: org,
    people,
    users,
    meetings,
    tensions,
    tactical,
    governance,
    goals,
  };
}

function buildResult(options, data) {
  const days = Math.round((options.to.getTime() - options.from.getTime()) / 86_400_000);
  const gates = [
    gate("organization-found", Boolean(data.organization), "organization slug exists", {
      slug: options.organizationSlug,
    }),
  ];

  if (!data.organization) {
    return { ok: false, mode: "m5b-longitudinal-real-team", days, gates, facts: data };
  }

  gates.push(
    gate(
      "not-smoke-tenant",
      !/^M5B Smoke /.test(data.organization.name)
        && !data.organization.slug.includes("smoke")
        && count([data.people], "smoke_people") === 0
        && count([data.users], "smoke_users") === 0,
      "organization and participants are not loopos.test smoke data",
      {
        organizationName: data.organization.name,
        smokePeople: count([data.people], "smoke_people"),
        smokeUsers: count([data.users], "smoke_users"),
      },
    ),
    gate(
      "weekly-window",
      days >= 6,
      "evidence window spans at least six days",
      { from: options.from.toISOString(), to: options.to.toISOString(), days },
    ),
    gate(
      "real-team-participation",
      count([data.people], "real_people") >= options.minPeople
        && count([data.users], "real_users") >= options.minPeople,
      "organization has enough real participants with non-test accounts",
      {
        minPeople: options.minPeople,
        realPeople: count([data.people], "real_people"),
        realUsers: count([data.users], "real_users"),
      },
    ),
    gate(
      "goal-cycle-loop",
      count([data.goals], "cycles") >= 1
        && count([data.goals], "goals") >= 1
        && count([data.goals], "targets") >= 1
        && count([data.goals], "check_ins") >= 1
        && count([data.goals], "duplicate_active_goal_scopes") === 0,
      "one overlapping Goal cycle has Goals, Targets, check-ins, and no duplicate active Goal per circle",
      data.goals,
    ),
    gate(
      "tactical-meeting-loop",
      count([data.meetings], "tactical_meetings") >= 1
        && count([data.meetings], "recorded_meetings") >= 1,
      "at least one tactical meeting in the window has notes or an ended timestamp",
      data.meetings,
    ),
    gate(
      "tension-to-output",
      count([data.tensions], "tensions") >= 1
        && count([data.tensions], "routed_tensions") >= 1
        && (
          count([data.tensions], "closed_tensions") >= 1
          || count([data.tactical], "approved") >= 1
          || count([data.governance], "terminal_processes") >= 1
        ),
      "at least one Tension is raised, routed, and reaches closure or approved output",
      {
        ...data.tensions,
        tacticalApproved: count([data.tactical], "approved"),
        governanceTerminal: count([data.governance], "terminal_processes"),
      },
    ),
    gate(
      "work-linked-to-goal",
      count([data.goals], "work_links") >= 1
        || count([data.tactical], "approved_projects") >= 1
        || count([data.tactical], "approved_actions") >= 1,
      "weekly work is linked to a Goal or approved as Project/Action output",
      {
        workLinks: count([data.goals], "work_links"),
        approvedProjects: count([data.tactical], "approved_projects"),
        approvedActions: count([data.tactical], "approved_actions"),
      },
    ),
    gate(
      "governance-if-used",
      count([data.tensions], "governance_tensions") === 0
        || (
          count([data.meetings], "governance_meetings") >= 1
          && count([data.governance], "terminal_processes") >= 1
        ),
      "governance-routed Tensions have governance meeting and terminal process evidence when present",
      {
        governanceTensions: count([data.tensions], "governance_tensions"),
        governanceMeetings: count([data.meetings], "governance_meetings"),
        terminalProcesses: count([data.governance], "terminal_processes"),
        appliedOutcomes: count([data.governance], "applied_outcomes"),
      },
    ),
  );

  return {
    ok: gates.every((item) => item.ok),
    mode: "m5b-longitudinal-real-team",
    organization: data.organization,
    days,
    gates,
    facts: data,
  };
}

function printHuman(result) {
  console.log(`ok=${result.ok ? "true" : "false"}`);
  console.log(`mode=${result.mode}`);
  for (const item of result.gates) {
    console.log(`${item.ok ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    await client.query("begin read only");
    const result = buildResult(options, await facts(client, options));
    await client.query("rollback");
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printHuman(result);
    }
    if (!result.ok) process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
