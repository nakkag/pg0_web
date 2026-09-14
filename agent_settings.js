// Settings for the AI agent API (agent_api.js).

// API key required in "Authorization: Bearer <key>" or "X-API-Key" header.
// Empty string disables authentication (same as the existing /api endpoints).
exports.apiKey = '';

// Base URL of the site, used to build script URLs and links in responses.
// Empty string uses the request's X-Forwarded-Host / Host header.
exports.publicUrl = 'https://pg0.jp';

// Execution limits
exports.maxConcurrentRuns = 4;
exports.defaultTimeoutMs = 5000;
exports.maxTimeoutMs = 30000;
exports.defaultMaxSteps = 10000000;
exports.maxMaxSteps = 100000000;
exports.maxCodeLength = 200000;
exports.maxInputLength = 200000;
exports.maxOutputLength = 1000000;
// Response fields (variables, storage, screen.record, ...) are dropped when the JSON would exceed this
exports.maxResponseLength = 4000000;
// Heap limit (--max-old-space-size) of each runner process; up to maxConcurrentRuns of them run at once
exports.workerMemoryMb = 256;

// Headless screen (lib/screen.pg0 through the API)
exports.defaultMaxFrames = 10000;
exports.maxMaxFrames = 1000000;
exports.maxMaxVirtualMs = 86400000;
exports.defaultRecordedCalls = 2000;
exports.maxRecordedCalls = 20000;
exports.maxTimelineEvents = 10000;

// Stored scripts pulled in with #import("...cid=...") per run
exports.maxImportScripts = 30;

// Script storage
exports.defaultAuthor = 'AI agent';
exports.defaultSpeed = 250;
