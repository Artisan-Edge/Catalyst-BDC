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

async function createFlow(client: BdcClient, fileName: string): Promise<void> {
    const flowCsn = JSON.parse(readFileSync(path.join(FLOWS_DIR, fileName), "utf-8")) as CsnFile;
    const flowNames = Object.keys(flowCsn.replicationflows ?? {});
    if (flowNames.length === 0) {
        console.error(`No replication flows found in ${fileName}`);
        process.exit(1);
    }
    const actualFlowName = flowNames[0]!;

    console.log(`[FLOW] Creating replication flow ${actualFlowName}`);
    const [flowResult, flowErr] = await client.createReplicationFlow(flowCsn, actualFlowName);
    if (flowErr) {
        console.error(`  ERROR: ${flowErr.message}`);
        process.exit(1);
    }
    console.log(flowResult);
}

async function uploadFlow(client: BdcClient, name: string): Promise<void> {
    const fileName = name.endsWith(".json") ? name : `${name}.json`;

    const tableCsn = JSON.parse(readFileSync(path.join(LOCAL_TABLES_DIR, fileName), "utf-8")) as CsnFile;
    const tableName = Object.keys(tableCsn.definitions ?? {}).find((n) => n.toLowerCase().endsWith("_delta"));
    if (!tableName) {
        console.error(`No delta table definition found in ${fileName}`);
        process.exit(1);
    }

    // Create delta local table (regular table is auto-created by the replication flow)
    console.log(`[TABLE] Creating local table ${tableName}`);
    const [tableResult, tableErr] = await client.createLocalTable(tableCsn, tableName);
    if (tableErr) {
        console.error(`  ERROR: ${tableErr.message}`);
        process.exit(1);
    }
    console.log(tableResult);

    await createFlow(client, fileName);
}

async function uploadFlowOnly(client: BdcClient, name: string): Promise<void> {
    const fileName = name.endsWith(".json") ? name : `${name}.json`;
    await createFlow(client, fileName);
}

async function uploadView(client: BdcClient, name: string): Promise<void> {
    const fileName = name.endsWith(".json") ? name : `${name}.json`;

    const viewCsn = JSON.parse(readFileSync(path.join(VIEWS_DIR, fileName), "utf-8")) as CsnFile;
    const viewNames = Object.keys(viewCsn.definitions ?? {});
    if (viewNames.length === 0) {
        console.error(`No view definitions found in ${fileName}`);
        process.exit(1);
    }
    const actualViewName = viewNames[0]!;

    console.log(`[VIEW] Creating view ${actualViewName}`);
    const [viewResult, viewErr] = await client.createView(viewCsn, actualViewName);
    if (viewErr) {
        console.error(`  ERROR: ${viewErr.message}`);
        process.exit(1);
    }
    console.log(viewResult);
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
        console.error("  bun scripts/upload.ts flow I_BusinessArea       # creates delta table + replication flow");
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
