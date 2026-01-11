const server = Bun.spawn({
  cmd: ["bun", "run", "server.ts"],
  stdout: "inherit",
  stderr: "inherit",
});

const client = Bun.spawn({
  cmd: ["bun", "run", "dev:ui"],
  stdout: "inherit",
  stderr: "inherit",
});

const shutdown = (signal: NodeJS.Signals) => {
  server.kill(signal);
  client.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

const winner = await Promise.race([server.exited, client.exited]);
if (winner !== 0) {
  process.exitCode = 1;
}
shutdown("SIGTERM");
