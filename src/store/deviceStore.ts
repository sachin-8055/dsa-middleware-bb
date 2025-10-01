import { DeviceDetails } from "../types/DeviceDetails";

export interface IDeviceStore {
  device?: DeviceDetails;
}

export class DeviceStore implements IDeviceStore {
  device?: DeviceDetails;

  toJson(indented = false): string {
    return JSON.stringify(this.device ?? {}, null, indented ? 2 : 0);
  }
}
