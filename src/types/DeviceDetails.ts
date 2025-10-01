export interface DeviceDetails {
  platform?: string;
  architecture?: string;
  macAddress?: string;
  ip?: string;
  dockerId?: string;
  id?: string;
  status?: number; // default 0 in .NET, handle separately in logic
}
