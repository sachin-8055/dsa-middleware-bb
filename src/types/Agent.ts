// Root Agent interface
export interface Agent {
  agentId: string; // required
  name?: string;
  type: "middleware_agent"; // constant literal type
  platform?: string;
  accountId?: string;
  status?: number;
  syncFrequency: number; // default = 10
  reportFrequency: number; // default = 15
  configurations?: Config;
}

// Config interface
export interface Config {
  action?: ActionOptions;
  regxRules?: RegexMaskRules[];
  documentFilesExtentions?: string[];
  esc?: string;
}

// Action options
interface ActionOptions {
  isMask: boolean;
  isEncrypt: boolean;
}

// Regex Mask Rules
export interface RegexMaskRules {
  name?: string;
  description?: string;
  pattern?: string;
  isFullMask: boolean;
  maskWith?: string;
}
