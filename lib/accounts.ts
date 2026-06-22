import fs from "fs";
import path from "path";
import { STORAGE_ROOT } from "./storage";
import {
  Account,
  PlanId,
  applyReset,
  changePlan,
  needsReset,
  newAccount,
} from "./credits";

// Simple file-backed account store (demo). For production swap for a DB.
const STORE = path.join(STORAGE_ROOT, "accounts.json");

function loadAll(): Record<string, Account> {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf-8"));
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, Account>): void {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(all));
}

export function isValidUid(id: string): boolean {
  return /^[a-z0-9_-]{6,64}$/i.test(id);
}

/** Get the account for an id, creating a Free one if missing, and rolling
 *  over the billing cycle if due. Always persists the current state. */
export function getAccount(id: string): Account {
  const all = loadAll();
  let acc = all[id];
  if (!acc) acc = newAccount(id);
  if (needsReset(acc)) acc = applyReset(acc);
  all[id] = acc;
  saveAll(all);
  return acc;
}

export function saveAccount(acc: Account): Account {
  const all = loadAll();
  all[acc.id] = acc;
  saveAll(all);
  return acc;
}

export function setPlan(id: string, planId: PlanId): Account {
  const acc = changePlan(getAccount(id), planId);
  return saveAccount(acc);
}
