import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DeviceDetails } from "../types/DeviceDetails";
import { deviceStore } from "../store/deviceStore";

export class SystemIdentityService {
  private static persistPath: string =
    process.platform === "win32"
      ? path.join(process.env["ProgramData"] || "C:\\ProgramData", "LogsSecurityAgent", "device-id")
      : "/var/lib/logssecurityagent/device-id";

  /**
   * Update the system identity and store it inside DeviceStore
   */
  static updateSystemIdentityInfo(): DeviceDetails {
    const store = deviceStore;
    const info: DeviceDetails = {
      platform: this.getPlatform(),
      architecture: os.arch(),
      macAddress: this.getPrimaryMacAddress(),
      ip: this.getLocalIPAddress(),
      dockerId: this.getDockerContainerId(),
      id: "", // will set below
    };

    // 1) Use persisted if exists
    let persisted = this.readPersistedId();
    if (persisted) {
      info.id = persisted;
      store.device = info;
      return info;
    }

    // 2) Choose best stable source
    let bestStable =
      info.dockerId ||
      this.getLinuxMachineId() ||
      this.getWindowsMachineGuid() ||
      info.macAddress;

    // 3) Fallback if none
    if (!bestStable) {
      bestStable = "gen:" + crypto.randomUUID();
    }

    // 4) Hash + persist
    const combined = `${info.platform}|${info.architecture}|${bestStable}`;
    const hash = crypto.createHash("sha256").update(combined).digest("hex");
    info.id = hash;

    this.tryPersistId(info.id);

    // 5) Save into store
    store.device = info;

    return info;
  }

  /* ---------- Helpers ---------- */

  private static getPlatform(): string {
    switch (process.platform) {
      case "win32": return "Windows";
      case "linux": return "Linux";
      case "darwin": return "macOS";
      default: return "Unknown";
    }
  }

  private static getPrimaryMacAddress(): string {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;
        for (const i of iface) {
          if (i.mac && i.mac !== "00:00:00:00:00:00") {
            return i.mac;
          }
        }
      }
    } catch {}
    return "";
  }

  private static getLocalIPAddress(): string {
    try {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;
        for (const i of iface) {
          if (i.family === "IPv4" && !i.internal) {
            return i.address;
          }
        }
      }
    } catch {}
    return "";
  }

  private static getDockerContainerId(): string {
    try {
      const cgroupPath = "/proc/self/cgroup";
      if (fs.existsSync(cgroupPath)) {
        const text = fs.readFileSync(cgroupPath, "utf8");
        const match = text.match(/([a-f0-9]{64})/i);
        if (match) return match[1];
      }
      if (fs.existsSync("/etc/hostname")) {
        const h = fs.readFileSync("/etc/hostname", "utf8").trim();
        if (/^[a-f0-9]{12,64}$/i.test(h)) return h;
      }
    } catch {}
    return "";
  }

  private static getLinuxMachineId(): string {
    try {
      if (process.platform !== "linux") return "";
      const paths = ["/etc/machine-id", "/var/lib/dbus/machine-id"];
      for (const p of paths) {
        if (fs.existsSync(p)) {
          const id = fs.readFileSync(p, "utf8").trim();
          if (id) return id;
        }
      }
    } catch {}
    return "";
  }

  private static getWindowsMachineGuid(): string {
    // ⚠ Node.js cannot read registry without extra modules like `winreg` or `registry-js`
    return "";
  }

  private static readPersistedId(): string {
    try {
      if (fs.existsSync(this.persistPath)) {
        return fs.readFileSync(this.persistPath, "utf8").trim();
      }
    } catch {}
    return "";
  }

  private static tryPersistId(id: string): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, id, "utf8");
    } catch {}
  }
}
