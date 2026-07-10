const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sqlPath = path.join(root, "supabase-auth-public-signup.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

assert(!sql.includes("Only invited emails can create an account"), "public signup SQL must not reject uninvited emails");
assert(sql.includes("if next_role is not null then"), "inspection-log profiles must only be created for authorized roles");
assert(sql.includes("account_signup_pending"), "unapproved public signups must be logged as pending");
assert(sql.includes("'approvalStatus', 'pending'"), "public signup logs must retain pending approval status");

console.log("global auth public signup test passed");
