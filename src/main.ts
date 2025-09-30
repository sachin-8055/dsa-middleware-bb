import { Request, Response, NextFunction } from "express";
import { InitData } from "./models/InitData";

export function initMiddleware(config: InitData) {
  return function (req: Request, res: Response, next: NextFunction) {
    // Log incoming request
    console.log("🟢 Incoming Request:", {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
    });

    // Capture original send method
    const originalSend = res.send.bind(res);

    res.send = (body?: any): Response => {
      console.log("🔵 Outgoing Response:", {
        statusCode: res.statusCode,
        body,
      });
      return originalSend(body);
    };

    if (config.debug) {
      console.log("⚙️ Middleware initialized with config:", config);
    }

    next();
  };
}
