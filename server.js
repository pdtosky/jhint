const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "data.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function createDefaultState() {
  return {
    orders: [],
    activities: []
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createDefaultState(), null, 2), "utf8");
  }
}

function readState() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return createDefaultState();
  }
}

function writeState(nextState) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextState, null, 2), "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function getSafeFilePath(urlPath) {
  const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
  const resolvedPath = path.normalize(path.join(ROOT_DIR, normalizedPath));
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return resolvedPath;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/state") {
    if (request.method === "GET") {
      sendJson(response, 200, readState());
      return;
    }

    if (request.method === "PUT") {
      let rawBody = "";
      request.on("data", (chunk) => {
        rawBody += chunk;
      });
      request.on("end", () => {
        try {
          const nextState = JSON.parse(rawBody || "{}");
          writeState(nextState);
          sendJson(response, 200, { ok: true });
        } catch {
          sendJson(response, 400, { ok: false, message: "Invalid JSON" });
        }
      });
      return;
    }

    sendJson(response, 405, { ok: false, message: "Method not allowed" });
    return;
  }

  const safeFilePath = getSafeFilePath(requestUrl.pathname);
  if (!safeFilePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  sendFile(response, safeFilePath);
});

server.listen(PORT, HOST, () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    });
  });

  console.log(`Production server running on http://localhost:${PORT}`);
  addresses.forEach((address) => {
    console.log(`Mobile access: http://${address}:${PORT}`);
  });
});
