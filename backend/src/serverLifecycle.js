export function createShutdownHandler({
  server,
  timeoutMs = 30_000,
  exit = (code) => process.exit(code),
  logger = console,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let shuttingDown = false;

  return function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`Received ${signal}; draining active requests`);

    const timeout = setTimer(() => {
      logger.error("Graceful shutdown timed out");
      exit(1);
    }, timeoutMs);
    timeout.unref?.();

    server.close((error) => {
      clearTimer(timeout);
      if (error) {
        logger.error(error);
        exit(1);
        return;
      }
      logger.log("Server shutdown complete");
      exit(0);
    });
  };
}
