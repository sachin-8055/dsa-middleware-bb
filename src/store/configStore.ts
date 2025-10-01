
const DEFAULT_SERVER_BASE_URL = "https://access.axiomprotect.com:6653";

interface IConfigStore {
  isRegistered: boolean;
  accountId: string;
  agentId: string;
  agentType: string;
  serverBaseUrl?: string;
  userName: string;
  password: string;
  userEmail?: string;
  userMobile?: string;
}

export class ConfigStore implements IConfigStore {
  isRegistered = false;
  accountId = "";
  agentId = "";
  agentType = "middleware_agent";
  serverBaseUrl?: string = DEFAULT_SERVER_BASE_URL;
  userName = "";
  password = "";
  userEmail?: string;
  userMobile?: string;

  constructor(_serverBaseUrl?: string) {
    this.serverBaseUrl = _serverBaseUrl ?? DEFAULT_SERVER_BASE_URL;
  }

  toJson(indented = false): string {
    return JSON.stringify(this, null, indented ? 2 : 0);
  }
}
