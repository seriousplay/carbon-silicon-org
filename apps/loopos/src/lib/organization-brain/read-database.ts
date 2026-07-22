import "server-only";

import { Pool } from "pg";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  runBrainFoundationReadTransaction,
  type BrainFoundationReadRequest,
  type BrainReadRow,
} from "./read-database-core";
import { toBrainReadPolicyContext } from "./read-policy-context";

let brainPool: Pool | undefined;

function getBrainPool(): Pool {
  if (brainPool) return brainPool;

  const connectionString = process.env.BRAIN_DATABASE_URL;
  if (!connectionString) {
    throw new Error("BRAIN_DATABASE_URL is required");
  }

  brainPool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return brainPool;
}

export type { BrainFoundationReadRequest, BrainReadRow };

export async function readBrainFoundation(
  actor: ActorContext,
  request: BrainFoundationReadRequest,
): Promise<BrainReadRow[]> {
  const context = toBrainReadPolicyContext(actor);
  const client = await getBrainPool().connect();

  return runBrainFoundationReadTransaction(
    {
      query: async (text, values) => {
        const result = await client.query(text, values);
        return { rows: result.rows };
      },
      release: (error) => client.release(error),
    },
    context,
    request,
  );
}
