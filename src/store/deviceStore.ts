import { DeviceDetails } from "../types/DeviceDetails";

class DeviceStore {
  device?: DeviceDetails;

  toJson(indented = false): string {
    return JSON.stringify(this.device ?? {}, null, indented ? 2 : 0);
  }
}

// ✅ Export one global instance
export const deviceStore = new DeviceStore();
