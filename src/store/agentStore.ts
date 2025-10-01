// src/store/AgentStore.ts
export interface Agent {
  agentId: string;
  status: number;
  configurations?: Record<string, any>;
}

export interface IAgentStore {
  agent?: Agent;
}

export class AgentStore implements IAgentStore {
  agent?: Agent;

  toJson(indented = false): string {
    return JSON.stringify(this.agent ?? {}, null, indented ? 2 : 0);
  }
}

