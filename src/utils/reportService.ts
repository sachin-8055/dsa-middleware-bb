import fs from "fs/promises";
import path from "path";
import os from "os";

import { agentStore } from "../store/agentStore";
import { configStore } from "../store/configStore";
import { OperationReport, RuleReport, FileReport, SyncEntry } from "../types/OperationReport";
import { deviceStore } from "../store/deviceStore";

const report: OperationReport = {
  accountId: configStore.accountId,
  platform: agentStore.agent?.platform,
  deviceId: deviceStore.device?.id ?? undefined,
  type: "middleware_agent",
  agentId: agentStore.agent?.agentId ?? configStore.agentId,
  reportOn: new Date().toISOString(),
  sync: [],
  rules: [],
  files: [],
};

const folder = path.join(os.tmpdir(), "DSAReports");
let reportFilePath = path.join(folder, `${report.agentId}.json`);

// Ensure folder exists (called once at startup)
async function ensureFolder() {
  try {
    await fs.mkdir(folder, { recursive: true });
  } catch (err) {
    console.error("Failed to create report folder:", err);
  }
}

async function saveReport(): Promise<void> {
  if (!report.agentId) {
    report.agentId = agentStore.agent?.agentId ?? configStore.agentId;
    if (!report.agentId) {
      console.warn("No agentId available, cannot save report");
      return;
    }
    await ensureFolder();
    reportFilePath = path.join(folder, `${report.agentId}.json`);
  }

  report.reportOn = new Date().toISOString();
// console.log("SAVING RPT:::")
  const json = JSON.stringify(report, null, 2);
  try {
    await fs.writeFile(reportFilePath, json, "utf-8");
  } catch (err) {
    console.error("Failed to save report:", err);
  }
}

export const reportService = {
  async init() {
    await ensureFolder();
    await saveReport();
  },

  addSync(isSuccess: boolean, message: string) {
    const entry: SyncEntry = {
      on: new Date().toISOString(),
      isSuccess,
      message,
    };
    report.sync.push(entry);
    void saveReport();
  },

  addRuleResult(rule: RuleReport) {
    // console.log("Add Rule Called ...")
    const existing = report.rules.find((r) => r.name === rule.name);
    // console.log({existing})
    if (existing) {
      existing.matchCount += rule.matchCount;
      existing.lastProcessed = new Date().toISOString();
      if (rule.error) existing.error = rule.error;
    } else {
      rule.lastProcessed = new Date().toISOString();
      report.rules.push(rule);
    }
    
    // console.log({rule})
    void saveReport();
  },

  addFileCount(type: string, count: number) {
    const cleanType = type.replace(/^\./, "");
    const file = report.files.find((f) => f.type === cleanType);
    if (file) {
      file.lastProcessed = new Date().toISOString();
      file.count += count;
    } else {
      const newFile: FileReport = {
        type: cleanType,
        count,
        lastProcessed: new Date().toISOString(),
      };
      report.files.push(newFile);
    }
    void saveReport();
  },

  getReport(): OperationReport {
    return report;
  },

  clearReport() {
    console.info("Clearing report...");
    report.sync = [];
    report.rules = [];
    report.files = [];
    report.reportOn = new Date().toISOString();
    void saveReport();
  },
};
