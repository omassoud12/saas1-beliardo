import { createClient } from "redis";
import { RedisStore } from "rate-limit-redis";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { logEvent } from "../shared/utils/logger.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", () => logEvent("error", "redis_connection_error"));
  await redisClient.connect();
}

export function createRateLimitStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix: `saas1:rate-limit:${prefix}:`,
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

export async function closeRedis() {
  if (redisClient?.isOpen) await redisClient.quit();
}
