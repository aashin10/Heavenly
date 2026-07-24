/**
 * Runtime configuration.
 *
 * `useRealApi` is the integration flag: while `false`, auth (and later, all
 * data) runs on the existing localStorage mocks so the app is fully usable with
 * no backend. Flip it to `true` once the .NET API is running and reachable at
 * `apiBaseUrl` — see docs/backend/05-INTEGRATION-RUNBOOK.md.
 *
 * For a production build, override `apiBaseUrl` (and set `useRealApi: true`) via
 * an angular.json `fileReplacements` entry pointing at an environment.prod.ts.
 */
export const environment = {
  production: false,
  /** Base URL of the .NET API (ApiControllerBase route is `api/[controller]`). */
  apiBaseUrl: 'https://localhost:5001/api',
  /** false → localStorage mocks; true → real HTTP calls to `apiBaseUrl`. */
  useRealApi: false,
};
