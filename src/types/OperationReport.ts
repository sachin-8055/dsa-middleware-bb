export interface SyncEntry {
  on: string;              // ISO Date string
  isSuccess: boolean;
  message: string;
}

export interface RuleReport {
  name: string;
  pattern: string;
  matchCount: number;
  isMask: boolean;
  isEncrypt: boolean;
  error?: string;
  lastProcessed?: string;   // ISO Date string
}

export interface FileReport {
  type: string;
  count: number;
  lastProcessed: string;   // ISO Date string
}

export interface OperationReport {
  agentId: string;
  type: string;
  platform: string | undefined;
  accountId: string;
  deviceId: string  | undefined;
  sync: SyncEntry[];
  rules: RuleReport[];
  files: FileReport[];
  reportOn: string;        // ISO Date string
}
