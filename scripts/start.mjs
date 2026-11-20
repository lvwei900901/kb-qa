// 托管环境启动入口：直接读取 PORT 环境变量，避免 shell 变量展开问题。
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const hostname = "0.0.0.0";

console.log(`[start] launching next start -H ${hostname} -p ${port}`);

const child = spawn(
  "npx",
  ["next", "start", "-H", hostname, "-p", String(port)],
  {
    stdio: "inherit",
    env: process.env,
    shell: false,
  },
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
