import { Agent } from "../types/Agent";
class AgentStore {
  agent?: Agent;

  toJson(indented = false): string {
    return JSON.stringify(this.agent ?? {}, null, indented ? 2 : 0);
  }
}


// ✅ Export one global instance
export const agentStore = new AgentStore();