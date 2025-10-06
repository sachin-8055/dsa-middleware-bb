import { configStore } from "../store/configStore";
import { deviceStore } from "../store/deviceStore";
import { generateRandomKey } from "../utils/cryptoService";
import { HttpRequestService } from "./apiService";


// Singleton instances (just like global DI in .NET)
const httpService = new HttpRequestService();

/**
 * Register the current user with this agent
 */
export async function registerUserWithAgentAsync(): Promise<boolean> {
  const _encryptKey = generateRandomKey(14);

  const requestBody = {
    agentId: configStore.agentId,
    deviceId: deviceStore.device?.id,
    deviceIp: deviceStore.device?.ip,
    esc: _encryptKey ?? "",
  };

  try {
    const result = await httpService.postAsync<any>(
      "registerUserWithAgent",
      requestBody,
      true
    );

    // console.info("User Agent Registered.", result);

    if (result && result.resultCode === 0) {
      configStore.isRegistered = true;
      return true;
    } else {
      const isUserRegistered = result?.resultData?.isUserRegistered === true;

      if (isUserRegistered) {
        configStore.isRegistered = true;
        console.info("User is already registered with the agent.");
        return true;
      }

      return false;
    }
  } catch (err: any) {
    console.error("Unexpected error during registration:", err);
    return false;
  }
}
