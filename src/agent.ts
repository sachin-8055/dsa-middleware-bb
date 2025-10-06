import { Request, Response, NextFunction } from "express";
import { InitConfig } from "./types/InitConfig";
import { configStore } from "./store/configStore";
import { SystemIdentityService } from "./utils/SystemIdentityService";
import { authSync, scheduleReAuth } from "./api/authenticate";
import { registerUserWithAgentAsync } from "./api/regUserWithAgent";
import { fileTypeFromBuffer } from "file-type";
import { maskData, maskFileFromBuffer } from "./utils/masking";
import * as fs from "fs";
import path from "path";
import { agentStore } from "./store/agentStore";

let isAgentReady = false;

const IGNORE_PATHS = [
  ".well-known/appspecific",
  "favicon.ico",
  "robots.txt",
  "manifest.json",
  "service-worker.js",
  "sitemap.xml",
];

const DOWNLOAD_FILE_EXTENSIONS = ["docx", "pdf", "xlsx"]; // Add more if needed

function isSupportedFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const allowedExtensions = agentStore?.agent?.configurations?.documentFilesExtentions || [];
  return ext ? allowedExtensions.includes(ext) : false;
}

export function dsaMiddleware(config: InitConfig) {
  Object.assign(configStore, config);
  SystemIdentityService.updateSystemIdentityInfo();

  // Initialize agent asynchronously
  (async () => {
    try {
      const registered = await registerUserWithAgentAsync();
      if (!registered) return console.warn("⚠️ Agent registration failed");

      const authenticated = await authSync();
      if (!authenticated) return console.warn("⚠️ Agent authentication failed");

      console.log("✅ Agent registration and authentication successful");
      isAgentReady = true;
      scheduleReAuth();
    } catch (err) {
      console.error("❌ Agent init failed:", err);
    }
  })();

  return function (req: Request, res: Response, next: NextFunction) {
    if (IGNORE_PATHS.some((p) => req.originalUrl.includes(p))) return next();

    const originalEnd = res.end.bind(res);
    const chunks: Buffer[] = [];

    res.write = ((chunk: any, encoding?: BufferEncoding,cb?: () => void) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    }) as any;

    res.end = ((chunk?: any, encoding?: BufferEncoding,cb?: () => void): any => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));

      (async () => {
        let finalBuffer = Buffer.concat(chunks);
        const ext = req.originalUrl.split(".").pop()?.toLowerCase();

        try {
          if (!isAgentReady) return (originalEnd as Function).call(res, finalBuffer, undefined, cb);

          let mime = res.getHeader("content-type")?.toString() || "application/octet-stream";
          const staticPath = path.join(process.cwd(), req.originalUrl);
          const fileExists = fs.existsSync(staticPath) && fs.statSync(staticPath).isFile();

          // Load static file if exists
          if ((finalBuffer.length === 0 || fileExists) && fileExists) {
            finalBuffer = fs.readFileSync(staticPath);
            const detected = await fileTypeFromBuffer(finalBuffer);
            mime = detected?.mime || mime;
          } else {
            const detected = await fileTypeFromBuffer(finalBuffer);
            mime = detected?.mime || mime;
          }

          // Fallback MIME by extension
          if (!mime || mime === "application/octet-stream") {
            if (ext === "pdf") mime = "application/pdf";
            else if (ext === "docx") mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            else if (ext === "xlsx") mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            else if (ext === "txt") mime = "text/plain";
          }

          // Masking logic
          const isMaskable =
            mime.includes("application/pdf") ||
            mime.includes("officedocument.wordprocessingml.document") ||
            mime.includes("spreadsheetml.sheet") ||
            mime.includes("application/vnd.ms-excel");

          if (isMaskable && isSupportedFile(req.originalUrl)) {
            finalBuffer = Buffer.from(await maskFileFromBuffer(finalBuffer, mime));
          } else if (mime.startsWith("text/") || mime.includes("application/json")) {
            finalBuffer = Buffer.from(maskData(finalBuffer.toString("utf8")), "utf8");
          }

          // Apply download headers if applicable
          if (DOWNLOAD_FILE_EXTENSIONS.includes(ext!)) {
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${path.basename(req.originalUrl)}"`
            );
          }

          res.removeHeader("content-encoding");
          res.setHeader("Content-Type", mime);
          res.setHeader("Content-Length", finalBuffer.length);

          return (originalEnd as Function).call(res, finalBuffer, undefined, cb);
        } catch (err) {
          console.error("❌ Error processing response:", err);
          return (originalEnd as Function).call(res, finalBuffer, undefined, cb);
        }
      })();

      return res;
    }) as any;

    next();
  };
}
