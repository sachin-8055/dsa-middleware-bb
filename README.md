# 🧩 DSA Middleware BB

[![npm version](https://img.shields.io/npm/v/dsa-middleware-bb.svg?style=flat-square)](https://www.npmjs.com/package/dsa-middleware-bb)
[![npm downloads](https://img.shields.io/npm/dm/dsa-middleware-bb.svg?style=flat-square)](https://www.npmjs.com/package/dsa-middleware-bb)
[![license](https://img.shields.io/npm/l/dsa-middleware-bb.svg?style=flat-square)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/sachin-8055/dsa-middleware-bb.svg?style=flat-square)](https://github.com/sachin-8055/dsa-middleware-bb/issues)
[![GitHub stars](https://img.shields.io/github/stars/sachin-8055/dsa-middleware-bb.svg?style=flat-square)](https://github.com/sachin-8055/dsa-middleware-bb)

A lightweight and secure middleware for integrating **Digital Smart Agent (DSA)** capabilities into your **Node.js** or **NestJS** applications.  
It handles automatic authentication, request validation, and agent-level configurations seamlessly.

---

## 🚀 Installation

```bash
npm install dsa-middleware-bb
# or
yarn add dsa-middleware-bb
```

---

## ⚙️ Usage in Node.js (CommonJS)

```js
const express = require("express");
const { dsaMiddleware } = require("dsa-middleware-bb");

const app = express();

app.use(
  dsaMiddleware({
    accountId: "<YOUR_ACCOUNT_ID>",
    agentId: "<YOUR_AGENT_ID>",
    email: "<YOUR_EMAIL>",
    password: "<YOUR_PASSWORD>",
    debug: true, // optional: logs internal activity
  })
);

app.get("/", (req, res) => {
  res.send("✅ DSA Middleware Active!");
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
```

✅ That’s it! The middleware will automatically handle authentication and enrich incoming requests with DSA session context.

---

## ⚙️ Usage in TypeScript / NestJS

### 1️⃣ Install

```bash
npm install dsa-middleware-bb
```

### 2️⃣ Register Middleware in `main.ts`

```ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { dsaMiddleware } from "dsa-middleware-bb";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    dsaMiddleware({
      accountId: "<YOUR_ACCOUNT_ID>",
      agentId: "<YOUR_AGENT_ID>",
      email: "<YOUR_EMAIL>",
      password: "<YOUR_PASSWORD>",
    })
  );

  await app.listen(3000);
  console.log("🚀 NestJS App running on http://localhost:3000");
}

bootstrap();
```

---

## ⚙️ Configuration Options

| Option      | Type      | Required | Description                                 |
| ----------- | --------- | -------- | ------------------------------------------- |
| `accountId` | `string`  | ✅ Yes   | Unique account identifier                   |
| `agentId`   | `string`  | ✅ Yes   | Registered agent ID                         |
| `email`     | `string`  | ✅ Yes   | Login email for agent authentication        |
| `password`  | `string`  | ✅ Yes   | Login password for agent authentication     |
| `debug`     | `boolean` | ❌ No    | Enables detailed console logs for debugging |

---

## 🧠 Middleware Behavior

Once applied, `dsaMiddleware` will:

- Authenticate and cache the DSA session for each agent
- Attach session context to each incoming request (`req.dsa` or `req.agent`)
- Optionally log internal actions if `debug: true` is set

Example:

```js
app.get("/info", (req, res) => {
  console.log(req.dsa); // { accountId, agentId, sessionToken, ... }
  res.json({ message: "Agent context active", dsa: req.dsa });
});
```

---

## 🧩 Example Output (Debug Mode)

```
🔑 Authenticating Agent...
✅ Agent authenticated: agent_12345
📦 Session initialized for account acc_abcde
```

---

## 📦 Latest Version

**Version:** `1.0.0`  
_(Always check the [npm registry](https://www.npmjs.com/package/dsa-middleware-bb) for the latest release.)_

---

## 🧰 Troubleshooting

| Issue                 | Possible Cause       | Solution                                                          |
| --------------------- | -------------------- | ----------------------------------------------------------------- |
| `Invalid credentials` | Wrong email/password | Verify your credentials                                           |
| `Unauthorized agent`  | Invalid `agentId`    | Check your agent registration                                     |
| `Request blocked`     | Missing middleware   | Ensure `app.use(dsaMiddleware(...))` is placed before your routes |

---

## 📜 License

MIT © [Your Organization or Name]

---

## 💬 Support

For issues, suggestions, or contributions:  
👉 [Open a GitHub Issue](https://github.com/yourusername/dsa-middleware-bb/issues)

---

### 💡 Pro Tip

Use environment variables to keep your credentials secure:

```bash
ACCOUNT_ID=acc_12345
AGENT_ID=agent_56789
AGENT_EMAIL=agent@example.com
AGENT_PASSWORD=supersecret
```

```js
app.use(
  dsaMiddleware({
    accountId: process.env.ACCOUNT_ID,
    agentId: process.env.AGENT_ID,
    email: process.env.AGENT_EMAIL,
    password: process.env.AGENT_PASSWORD,
  })
);
```

---

> 🧩 _Simple. Secure. Smart — That’s DSA Middleware._

## 📜 Changelog

See full details in [CHANGELOG.md](./CHANGELOG.md)
