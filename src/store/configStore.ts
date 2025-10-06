// configStore.ts
const DEFAULT_SERVER_BASE_URL = "https://access.axiomprotect.com:6653";

class ConfigStore {
  isRegistered = false;
  accountId = "";
  agentId = "";
  agentType = "middleware_agent";
  serverBaseUrl?: string = DEFAULT_SERVER_BASE_URL;
  name = "";
  password = "";
  email?: string;
  mobile?: string;

  constructor(_serverBaseUrl?: string) {
    this.serverBaseUrl = _serverBaseUrl ?? DEFAULT_SERVER_BASE_URL;
  }

  toJson(indented = false): string {
    return JSON.stringify(this, null, indented ? 2 : 0);
  }
}

// ✅ Export one global instance
export const configStore = new ConfigStore();
