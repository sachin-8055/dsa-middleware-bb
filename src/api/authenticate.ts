import { configStore } from "../store/configStore";
import { deviceStore } from "../store/deviceStore";
import { agentStore } from "../store/agentStore";
import { HttpRequestService } from "./apiService";
import { reportService } from "../utils/reportService";
import { sendReport } from "./sendReport";

let agentSyncInterval: NodeJS.Timeout | null = null;
let reportSyncInterval: NodeJS.Timeout | null = null;

let agentSyncFrequencyInMinutes = 2;
let reportSyncFrequencyInMinutes = 1;

const httpService = new HttpRequestService();

function resolveLogFile(pattern: string): string {
  return pattern.replace(/\{([^}]+)\}/g, (_, format) => {
    return new Date().toISOString().slice(0, format.length); // simple placeholder resolution
  });
}

function getRawFileName(fileName: string): string {
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const withoutExt = ext ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;

  const parts = withoutExt.split(".");
  if (parts.length === 1) {
    return parts[0] + "_raw" + ext;
  }
  parts[parts.length - 1] = parts[parts.length - 1] + "_raw";
  return parts.join(".") + ext;
}

/**
 * Authenticate agent with server
 */
export async function authSync(): Promise<boolean> {
  // console.info("User registered with Agent:", configStore.isRegistered);
  // console.warn(" >> Device Details:", deviceStore.device);

  const requestBody = {
    agentId: configStore.agentId,
    agentName: "OS Service Agent",
    agentType: configStore.agentType,
    deviceId: deviceStore.device?.id,
    deviceIp: deviceStore.device?.ip,
    timeStamp: new Date().toISOString(),
    userName: configStore.name,
    userEmail: configStore.email,
    userMobile: configStore.mobile,
    platform: deviceStore.device?.platform,
    architecture: deviceStore.device?.architecture,
  };

  try {
    const result = await httpService.postAsync<any>("authenticate", requestBody, true);
    // console.warn(" >> Auth result:", result);

    if (result?.resultData?.configurations) {
      reportService.addSync(true, "");

      // update agent store
      agentStore.agent = result.resultData;

      // update sync frequencies
      agentSyncFrequencyInMinutes = agentStore.agent?.syncFrequency ?? 2;
      reportSyncFrequencyInMinutes = agentStore.agent?.reportFrequency ?? 1;

      return true;
    } else {
      reportService.addSync(false, result?.resultMessage ?? "Unknown");
      return false;
    }
  } catch (err: any) {
    console.error("Auth API failed:", err.message);
    reportService.addSync(false, err.message ?? "Unexpected error");
    return false;
  }
}

/**
 * Start scheduling authentication + report sync
 */
export function scheduleReAuth() {
  console.debug(" > Scheduling Re-Authentication");

  if (agentSyncInterval) clearInterval(agentSyncInterval);
  if (reportSyncInterval) clearInterval(reportSyncInterval);

  // Agent re-auth loop
  agentSyncInterval = setInterval(async () => {
    const success = await authSync();
    if (!success) {
      console.warn("Re-authentication failed. Retrying in 5 minutes...");
      if (agentSyncInterval) clearInterval(agentSyncInterval);
      agentSyncInterval = setInterval(authSync, 5 * 60 * 1000);
    }
  }, agentSyncFrequencyInMinutes * 60 * 1000);

  console.debug(" > Re-Authentication Scheduled every", agentSyncFrequencyInMinutes, "minutes");
  // Report sync loop
  reportSyncInterval = setInterval(async () => {
    const success = await sendReport();
    if (!success) {
      console.warn("Report sync failed. Retrying in 1 minute...");
      if (reportSyncInterval) clearInterval(reportSyncInterval);
      reportSyncInterval = setInterval(sendReport, 60 * 1000);
    }
  }, reportSyncFrequencyInMinutes * 60 * 1000);

  console.debug(" > Report Sync Scheduled every", reportSyncFrequencyInMinutes, "minutes");
}
