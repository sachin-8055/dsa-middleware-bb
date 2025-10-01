import { Request, Response, NextFunction } from "express";
import { InitConfig } from "./types/InitConfig";
import { ConfigStore } from "./store/configStore";
import { SystemIdentityService } from "./utils/systemIdentityService";
import { DeviceStore } from "./store/deviceStore";

export function dsaMiddleware(config: InitConfig) {
  const configStore = new ConfigStore();
  Object.assign(configStore, config);

  SystemIdentityService.updateSystemIdentityInfo();

  const deviceStore = new DeviceStore();

  console.log("Device info:", deviceStore.toJson(true));

  return function (req: Request, res: Response, next: NextFunction) {
    // Log incoming request
    console.log("🟢 Incoming Request:", {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
    });

    // Capture original send
    const originalSend = res.send.bind(res);

    res.send = (body?: any): Response => {
      // Detect response type
      let contentType = res.getHeader("content-type")?.toString() || "unknown";

      let detectedType = "unknown";

      if (contentType.includes("application/json")) {
        detectedType = "JSON";
      } else if (contentType.includes("text/plain")) {
        detectedType = "Text";
      } else if (contentType.includes("text/xml") || contentType.includes("application/xml")) {
        detectedType = "XML";
      } else if (
        contentType.includes("application/pdf") ||
        contentType.includes("application/msword") ||
        contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      ) {
        detectedType = "Document (Word/PDF)";
      } else if (
        contentType.includes("application/vnd.ms-excel") ||
        contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
        contentType.includes("text/csv")
      ) {
        detectedType = "Spreadsheet/CSV";
      } else if (contentType.includes("text/html")) {
        detectedType = "HTML";
      } else if (typeof body === "string" && contentType === "unknown") {
        // fallback: guess text if string
        detectedType = "Text";
      } else if (typeof body === "object" && contentType === "unknown") {
        // fallback: guess JSON if object
        detectedType = "JSON (guessed)";
      }

      console.log("🔵 Outgoing Response:", {
        statusCode: res.statusCode,
        detectedType,
        contentType,
        preview:
          typeof body === "string"
            ? body.slice(0, 100) // log first 100 chars only
            : body,
      });

      return originalSend(body);
    };

    if (config.debug) {
      console.log("⚙️ Middleware initialized with config:", config);
    }

    next();
  };
}
