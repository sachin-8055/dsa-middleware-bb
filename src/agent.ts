import { Request, Response, NextFunction } from "express";
import { InitConfig } from "./types/InitConfig";
import { configStore } from "./store/configStore";
import { deviceStore } from "./store/deviceStore";
import { SystemIdentityService } from "./utils/SystemIdentityService";
import { authSync, scheduleReAuth } from "./api/authenticate";
import { registerUserWithAgentAsync } from "./api/regUserWithAgent";
import { fileTypeFromBuffer } from "file-type";
import { maskData, maskFileFromBuffer } from "./utils/masking";
// import fileType from "file-type";

let isAgentReady = false;

export function dsaMiddleware(config: InitConfig) {
  Object.assign(configStore, config);
  SystemIdentityService.updateSystemIdentityInfo();

  // console.log("Device info:", deviceStore.toJson(true));
  // console.log("Config :", configStore.toJson(true));

  // Agent init
  (async () => {
    try {
      const registered = await registerUserWithAgentAsync();
      if (!registered) {
        console.warn("⚠️ Unable to register User with this Agent. Middleware will pass data unchanged.");
        return;
      }

      const authenticated = await authSync();
      if (!authenticated) {
        console.warn("⚠️ Unable to authenticate Agent. Middleware will pass data unchanged.");
        return;
      }

      console.log("✅ Agent registration and authentication successful.");
      isAgentReady = true;
      scheduleReAuth();
    } catch (err) {
      console.error("❌ Agent initialization failed:", err);
    }
  })();
  return function (req: Request, res: Response, next: NextFunction) {
    console.log("🟢 Incoming Request:", req.method, req.originalUrl);

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];

    // --- Capture chunks
    res.write = ((chunk: any, encoding?: BufferEncoding, cb?: (error?: Error) => void): boolean => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    }) as any; // ✅ type cast back to avoid overload mismatch

    // --- Override res.end safely
    res.end = ((chunk?: any, encoding?: BufferEncoding, cb?: () => void): Response => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const buffer = Buffer.concat(chunks);
      let contentType = res.getHeader("content-type")?.toString() || "";

      (async () => {
        try {
          if (!isAgentReady) {
            console.log("⚪ Agent not ready — skipping modification.");
            originalWrite(buffer);
            return originalEnd(cb);
          }

          const detected = await fileTypeFromBuffer(buffer);
          let mime = detected?.mime || contentType || "application/octet-stream";
          if (detected?.mime) mime = detected.mime;

          if (contentType.includes("text/csv")) mime = "text/plain";

          // Fallback by file extension if still unknown or generic
          if (!mime || mime === "application/octet-stream") {
            if (req.url.endsWith(".txt")) mime = "text/plain";
            if (req.url.endsWith(".log")) mime = "text/plain";
            if (req.url.endsWith(".csv")) mime = "text/plain";
            if (req.url.endsWith(".pdf")) mime = "application/pdf";
            if (req.url.endsWith(".docx"))
              mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (req.url.endsWith(".xlsx")) mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          }

          console.log("📦 Detected Content-Type:", mime);

          if (mime.includes("application/json")) {
            const text = buffer.toString("utf8");
            const masked = maskData(text);
            res.setHeader("content-length", Buffer.byteLength(masked));
            originalWrite(masked);
          } else if (mime.includes("text/plain") || mime.includes("text/csv")) {
            const maskedBuffer = await maskFileFromBuffer(buffer, "text/plain");
            // const maskedBuffer = maskData(buffer.toString("utf8"));
            res.setHeader("content-length", maskedBuffer.length);
            res.setHeader("content-type", mime);
            originalWrite(maskedBuffer);
          } else if (
            mime.includes("application/pdf") ||
            mime.includes("officedocument.wordprocessingml.document") ||
            mime.includes("application/vnd.ms-excel") ||
            mime.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          ) {
            const maskedBuffer = await maskFileFromBuffer(buffer, mime);
            // const maskedBuffer = maskData(buffer.toString("utf8"));
            res.setHeader("content-length", maskedBuffer.length);
            res.setHeader("content-type", mime);
            originalWrite(maskedBuffer);
          } else {
            console.log("⚪ Unsupported type, passing as-is.");
            originalWrite(buffer);
          }
        } catch (err) {
          console.error("❌ Error modifying response:", err);
          originalWrite(buffer);
        }

        originalEnd(cb);
      })();

      return res;
    }) as any; // ✅ type cast fixes TS overload error

    next();
  };
}
