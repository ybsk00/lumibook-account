/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as aiJournal from "../aiJournal.js";
import type * as aiJournalExamples from "../aiJournalExamples.js";
import type * as bankUpload from "../bankUpload.js";
import type * as bankUploadAi from "../bankUploadAi.js";
import type * as hometax from "../hometax.js";
import type * as journalEntries from "../journalEntries.js";
import type * as journals from "../journals.js";
import type * as ledger from "../ledger.js";
import type * as openingBalances from "../openingBalances.js";
import type * as partners from "../partners.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as statements from "../statements.js";
import type * as taxInvoices from "../taxInvoices.js";
import type * as vatPeriods from "../vatPeriods.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  aiJournal: typeof aiJournal;
  aiJournalExamples: typeof aiJournalExamples;
  bankUpload: typeof bankUpload;
  bankUploadAi: typeof bankUploadAi;
  hometax: typeof hometax;
  journalEntries: typeof journalEntries;
  journals: typeof journals;
  ledger: typeof ledger;
  openingBalances: typeof openingBalances;
  partners: typeof partners;
  seed: typeof seed;
  settings: typeof settings;
  statements: typeof statements;
  taxInvoices: typeof taxInvoices;
  vatPeriods: typeof vatPeriods;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
