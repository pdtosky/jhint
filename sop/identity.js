(function exposeSopIdentity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SOP_IDENTITY = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSopIdentity() {
  function normalizeManagementNo(value) {
    return String(value || "").trim().toUpperCase();
  }

  function inspectSopSaveIdentity(input = {}, records = []) {
    const id = String(input?.id || "").trim();
    const managementNo = normalizeManagementNo(input?.document?.managementNo || input?.managementNo);
    const existing = id
      ? records.find((record) => String(record?.id || "") === id) || null
      : null;
    const existingManagementNo = normalizeManagementNo(existing?.document?.managementNo || existing?.managementNo);

    if (existing && existingManagementNo !== managementNo) {
      return { valid: false, reason: "management-number-changed", existing };
    }

    const duplicate = managementNo
      ? records.find((record) => (
        String(record?.id || "") !== id &&
        normalizeManagementNo(record?.document?.managementNo || record?.managementNo) === managementNo
      )) || null
      : null;

    if (duplicate) return { valid: false, reason: "duplicate-management-number", duplicate };
    return { valid: true, mode: existing ? "update" : "create", existing };
  }

  return { inspectSopSaveIdentity, normalizeManagementNo };
}));
