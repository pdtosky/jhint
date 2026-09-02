const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("app.js", "utf8");
const config = fs.readFileSync("config.js", "utf8");
const bridge = fs.readFileSync("sop/bridge.js", "utf8");
const sopApp = fs.readFileSync("sop/app.js", "utf8");
const styles = fs.readFileSync("sop/styles.css", "utf8");
const sql = fs.readFileSync("supabase-sop-media-storage.sql", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

assert(config.includes('supabaseSopMediaBucket: "sop-media"'), "media bucket must be configurable");
assert(app.includes("SOP_VIDEO_MAX_BYTES = 50 * 1024 * 1024"), "video size must be capped at 50MB");
assert(app.includes("SOP_VIDEO_MIME_TYPES"), "video MIME types must be allowlisted");
assert(app.includes("supabaseAuthClient.storage.from(SOP_MEDIA_BUCKET).upload"), "videos must upload to Supabase Storage");
assert(app.includes("createSignedUrl(storagePath, 3600)"), "private videos must use expiring signed URLs");
assert(app.includes("getSopMediaUser"), "storage actions must require an authenticated user");
assert(app.includes("${user.id}/${sanitizeSopStorageSegment(sopId)}/${createCompatibleRandomId()}.${videoExtension}"), "storage paths must use an authenticated-user prefix and an ASCII-only generated filename");
assert(!app.includes("createCompatibleRandomId()}-${sanitizeSopMediaName(file.name)}"), "original filenames must never be copied into storage keys");
assert(app.includes('name: String(file.name || "첨부영상")'), "the original filename must remain available as display metadata");
assert(app.includes("contentType: videoMimeType"), "the upload content type must be normalized from the supported extension");
assert(!app.includes("service_role"), "frontend code must never expose the service role key");

const sanitizerSource = app.match(/function sanitizeSopStorageSegment\(value\) \{[\s\S]*?\n\}/)?.[0];
assert(sanitizerSource, "the ASCII storage-key sanitizer must exist");
const sanitizeSopStorageSegment = Function(`${sanitizerSource}; return sanitizeSopStorageSegment;`)();
const sanitizedKoreanName = sanitizeSopStorageSegment("태성-BUFFER PAD-B.mp4");
assert.match(sanitizedKoreanName, /^[0-9A-Za-z_-]+$/, "Korean filenames must become Storage-safe ASCII path segments");
assert(!sanitizedKoreanName.includes("태성"), "Korean characters must never remain in Storage keys");

assert(bridge.includes("uploadAttachment(options)"), "embedded SOP module must bridge uploads to the authenticated parent");
assert(bridge.includes("resolveAttachmentUrl(file)"), "embedded SOP module must bridge signed URL creation");
assert(sopApp.includes('accept="image/*,video/mp4,video/webm,video/quicktime,.mov"'), "file picker must accept supported videos");
assert(sopApp.includes("사진과 영상을 합쳐 최대 8개"), "combined attachment limit must be explicit");
assert(sopApp.includes("작업표준서를 먼저 임시저장한 후 영상을 추가"), "unsaved SOP video uploads must be blocked");
assert(sopApp.includes('<video class="attachment-video"'), "admin view must render video controls");
assert(sopApp.includes('<div class="worker-media worker-video"><video'), "worker view must render video controls");
assert(styles.includes(".attachment-video"), "admin video preview must be styled");
assert(styles.includes(".worker-media video"), "worker video preview must be styled");

assert.match(sql, /'sop-media'[\s\S]*false[\s\S]*52428800/, "bucket must be private with a 50MB limit");
assert.match(sql, /for select\s+to authenticated/i, "only authenticated users may read videos");
assert.match(sql, /storage\.foldername\(name\)\)\[1\].*auth\.uid/s, "uploads must be scoped to the user's folder");
assert.match(sql, /for delete\s+to authenticated[\s\S]*owner_id = \(select auth\.uid\(\)\)::text/i, "users may only delete their own videos");
assert(sw.includes("jhint-production-app-v20260902-01"), "service worker cache must be bumped");

console.log("sop video attachment test passed");
