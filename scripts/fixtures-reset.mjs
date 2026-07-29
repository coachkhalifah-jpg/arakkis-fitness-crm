const appEnv = process.env.APP_ENV || "development";
if (appEnv === "production") {
  throw new Error("Refusing to create synthetic fixtures when APP_ENV=production.");
}

console.log("This repository has no automatic production seed or checked-in fixture credentials.");
console.log("The phase-specific Playwright setup creates synthetic Auth users at runtime.");
console.log("Run `pnpm db:reset` first, then `pnpm test:e2e` for the documented fixture workflow.");
