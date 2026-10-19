const { createServerHealthMonitor } = require("../lib/server-health");

function createServerHealthHandler(dependencies) {
  const monitor = createServerHealthMonitor(dependencies);
  return async function serverHealthHandler(request, response) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.method !== "GET") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET");
      response.setHeader("Cache-Control", "no-store");
      response.end();
      return;
    }
    if (String(request.url || "").includes("?")) {
      response.statusCode = 400;
      response.setHeader("Cache-Control", "no-store");
      response.end();
      return;
    }

    // Intentionally public: no application data, metric values, or diagnostics.
    const { payload, cacheSeconds } = await monitor.getHealth();
    // The monitor checks payload.ok/status; HTTP 200 also lets the CDN cache failures.
    response.statusCode = 200;
    response.setHeader("Cache-Control", `public, max-age=0, s-maxage=${cacheSeconds}, must-revalidate, proxy-revalidate`);
    response.end(JSON.stringify(payload));
  };
}

module.exports = createServerHealthHandler();
module.exports.config = { maxDuration: 15 };
module.exports._test = { createServerHealthHandler };
