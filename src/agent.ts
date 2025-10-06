import { Request, Response, NextFunction } from "express";
import { InitConfig } from "./types/InitConfig";
import { configStore } from "./store/configStore";
import { deviceStore } from "./store/deviceStore";
import { SystemIdentityService } from "./utils/SystemIdentityService";
import { authSync, scheduleReAuth } from "./api/authenticate";
import { registerUserWithAgentAsync } from "./api/regUserWithAgent";
import { fileTypeFromBuffer } from "file-type";
import { maskData, maskFileFromBuffer } from "./utils/masking";
import * as fs from "fs";
import path from "path";

let isAgentReady = false;
const IGNORE_PATHS = [
  ".well-known/appspecific", // Chrome DevTools probe
  "favicon.ico", // browser favicon request
  "robots.txt", // crawler file
  "manifest.json", // web manifest
  "service-worker.js", // PWA files
  "sitemap.xml", // optional
];
export function dsaMiddleware(config: InitConfig) {
  Object.assign(configStore, config);
  SystemIdentityService.updateSystemIdentityInfo();

  // Agent initialization
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
    // Ignore specific paths
    if (IGNORE_PATHS.some((p) => req.originalUrl.includes(p))) {
      return next();
    }

    console.log("🟢 Processing Request...", req.originalUrl);

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    const chunks: Buffer[] = [];

    // Capture response chunks
    res.write = ((chunk: any, encoding?: BufferEncoding, cb?: (err?: Error | null) => void) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      if (cb) cb(null);
      return true;
    }) as any;

    res.end = ((chunk?: any, encoding?: BufferEncoding, cb?: () => void): Response => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const buffer = Buffer.concat(chunks);

      (async () => {
        try {
          if (!isAgentReady) {
            // Agent not ready, pass data unchanged
            originalWrite(buffer);
            return originalEnd(cb);
          }

          let finalBuffer: any = buffer;
          let mime = res.getHeader("content-type")?.toString() || "application/octet-stream";

          // Try to resolve static file path
          const possiblePath = path.join(process.cwd(), req.originalUrl);
          const fileExists = fs.existsSync(possiblePath) && fs.statSync(possiblePath).isFile();

          if ((buffer.length === 0 || fileExists) && fileExists) {
            // Read static file once
            finalBuffer = fs.readFileSync(possiblePath);
            const detected = await fileTypeFromBuffer(finalBuffer);
            mime = detected?.mime || mime;
            console.log("📦before buffer length :", finalBuffer.length);

            // Apply masking
            finalBuffer = await maskFileFromBuffer(finalBuffer, mime);
            console.log("after buffer length :", finalBuffer.length);
          } else if (buffer.length > 0) {
            // Dynamic response: detect MIME
            const detected = await fileTypeFromBuffer(finalBuffer);
            mime = detected?.mime || mime;

            // Fallback by URL extension
            if (!mime || mime === "application/octet-stream") {
              if (req.originalUrl.endsWith(".pdf")) mime = "application/pdf";
              else if (req.originalUrl.endsWith(".docx"))
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
              else if (req.originalUrl.endsWith(".xlsx"))
                mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
              else if (req.originalUrl.endsWith(".txt")) mime = "text/plain";
            }

            // Mask dynamic content if applicable
            if (
              mime.includes("application/pdf") ||
              mime.includes("officedocument.wordprocessingml.document") ||
              mime.includes("spreadsheetml.sheet") ||
              mime.includes("application/vnd.ms-excel")
            ) {
              // Binary file masking
              finalBuffer = await maskFileFromBuffer(finalBuffer, mime);
            } else if (mime.startsWith("text/") || mime.includes("application/json")) {
              // Text or JSON masking
              const text = finalBuffer.toString("utf8");
              const masked = maskData(text);
              finalBuffer = Buffer.from(masked, "utf8");
            }
          }

          // Send masked data
          res.removeHeader("content-encoding"); // prevent broken files
          res.setHeader("Content-Type", mime);
          res.setHeader("Content-Length", finalBuffer.length);
          originalWrite(finalBuffer);
        } catch (err) {
          console.error("❌ Error modifying response:", err);
          originalWrite(buffer);
        }

        originalEnd(cb);
      })();

      return res;
    }) as any;

    next();
  };
}
