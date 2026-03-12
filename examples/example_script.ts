import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "../src/client";
import type { BdcClient } from "../src/client";
import type { BdcConfig } from "../src/types/config";
import type { CsnFile } from "../src/types/csn";

const LOCAL_TABLES_DIR = process.env["BDC_LOCAL_TABLES_DIR"]!;
const FLOWS_DIR = process.env["BDC_FLOWS_DIR"]!;
const VIEWS_DIR = process.env["BDC_VIEWS_DIR"]!;

const config: BdcConfig = {
    host: process.env["DSP_HOST"]!,
    space: process.env["DSP_SPACE"]!,
    verbose: true,
    oauth: { optionsFile: "./oauth.json" },
};

type UploadMode = "flow" | "flow-only" | "view";

const MODE_DEFAULT_DIR: Record<UploadMode, string> = {
    "flow": FLOWS_DIR,
    "flow-only": FLOWS_DIR,
    "view": VIEWS_DIR,
};

function resolveNames(mode: UploadMode, nameArgs: string[]): string[] {
    if (nameArgs.length === 1 && nameArgs[0] === "*") {
        return readdirSync(MODE_DEFAULT_DIR[mode])
            .filter((f) => f.toLowerCase().endsWith(".json"))
            .map((f) => f.slice(0, -5));
    }
    return nameArgs;
}

function loadCsn(dir: string, name: string): CsnFile {
    const fileName = name.endsWith(".json") ? name : `${name}.json`;
    return JSON.parse(readFileSync(path.join(dir, fileName), "utf-8")) as CsnFile;
}

async function uploadFlow(client: BdcClient, name: string): Promise<void> {
    // Merge the local table CSN and flow CSN into one import
    const tableCsn = loadCsn(LOCAL_TABLES_DIR, name);
    const flowCsn = loadCsn(FLOWS_DIR, name);

    const merged: CsnFile = {
        ...flowCsn,
        definitions: { ...tableCsn.definitions },
    };

    console.log(`[FLOW] Importing table + flow for ${name}`);
    const [result, importErr] = await client.importCsn(merged);
    if (importErr) {
        console.error(`  ERROR: ${importErr.message}`);
        process.exit(1);
    }
    console.log(`  Imported ${result.objectIds.length} objects`);
}

async function uploadFlowOnly(client: BdcClient, name: string): Promise<void> {
    const flowCsn = loadCsn(FLOWS_DIR, name);

    console.log(`[FLOW] Importing flow for ${name}`);
    const [result, importErr] = await client.importCsn(flowCsn);
    if (importErr) {
        console.error(`  ERROR: ${importErr.message}`);
        process.exit(1);
    }
    console.log(`  Imported ${result.objectIds.length} objects`);
}

async function uploadView(client: BdcClient, name: string): Promise<void> {
    const viewCsn = loadCsn(VIEWS_DIR, name);

    console.log(`[VIEW] Importing view ${name}`);
    const [result, importErr] = await client.importCsn(viewCsn);
    if (importErr) {
        console.error(`  ERROR: ${importErr.message}`);
        process.exit(1);
    }
    console.log(`  Imported ${result.objectIds.length} objects`);
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const modeArg = args[0];
    const nameArgs = args.slice(1);

    const VALID_MODES: UploadMode[] = ["flow", "flow-only", "view"];
    if (!modeArg || nameArgs.length === 0 || !VALID_MODES.includes(modeArg as UploadMode)) {
        console.error("Usage: bun scripts/upload.ts <flow|flow-only|view> <name|*> [name...]");
        console.error("Examples:");
        console.error('  bun scripts/upload.ts flow "*"                  # all flows (table + flow)');
        console.error("  bun scripts/upload.ts flow I_BusinessArea       # imports delta table + replication flow");
        console.error('  bun scripts/upload.ts flow-only "*"             # all flows, no table creation');
        console.error("  bun scripts/upload.ts flow-only I_BusinessArea");
        console.error('  bun scripts/upload.ts view "*"                  # all views');
        console.error("  bun scripts/upload.ts view MY_VIEW");
        process.exit(1);
    }

    const mode: UploadMode = modeArg as UploadMode;
    const names = resolveNames(mode, nameArgs).map((n) => n.toUpperCase());

    const [client, clientErr] = createClient(config);
    if (clientErr) {
        console.error("Failed to create client:", clientErr.message);
        process.exit(1);
    }

    console.log("Logging in...");
    const [, loginErr] = await client.login();
    if (loginErr) {
        console.error("Login failed:", loginErr.message);
        process.exit(1);
    }
    console.log("Login successful.\n");

    for (const name of names) {
        if (mode === "flow") {
            await uploadFlow(client, name);
        } else if (mode === "flow-only") {
            await uploadFlowOnly(client, name);
        } else {
            await uploadView(client, name);
        }
    }

    console.log("Done.");
}

main();
