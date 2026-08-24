import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const { port } = getEnv();
const app = createApp();

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
