import { reportService } from "../utils/reportService";
import { agentStore } from "../store/agentStore";
import { deviceStore } from "../store/deviceStore";
import { configStore } from "../store/configStore";
import { HttpRequestService } from "./apiService";

const httpService = new HttpRequestService();

/**
 * Send report to backend
 */
export async function sendReport(): Promise<boolean> {
  // 1. Get report data
  let agentReportData = reportService.getReport();

  // 2. Fill missing fields
  if (!agentReportData.accountId) {
    agentReportData.accountId = agentStore.agent?.accountId ?? "";
  }
  if (!agentReportData.platform) {
    agentReportData.platform = agentStore.agent?.platform ?? "";
  }
  if (!agentReportData.deviceId) {
    agentReportData.deviceId = deviceStore.device?.id;
  }

  agentReportData.type = "middleware_agent";

  try {
    // 3. Send report
    const result = await httpService.postAsync<any>("addDSAgentReportData", agentReportData, true);

    // 4. Handle response
    if (result && result.resultCode === 0) {
      console.info(" * Report updated successfully:", result.resultData);
      reportService.clearReport();
      return true;
    }
  } catch (err: any) {
    console.error("Send report failed:", err.message);
  }

  return false;
}
