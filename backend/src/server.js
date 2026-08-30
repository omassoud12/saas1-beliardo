import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
import { createShutdownHandler } from "./serverLifecycle.js";
import { closeRedis } from "./config/redis.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const { port } = getEnv();
const app = createApp();

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

const shutdown = createShutdownHandler({ server, cleanup: closeRedis });
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
