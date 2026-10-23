# Security and CI repair

## Scope

Repository: `redmoondz/hina-desktop`.
Baseline: `09ee9f5c8f91646ba2934e8dee383e4bd47a4b43`.

The audit used GitHub CLI to inspect all 11 open CodeQL alerts and the failed
Build and Notarize, Release, Update Nix package, and Update WinGet package runs.
Dependabot alerts are disabled in the repository. Secret scanning returned no alerts.

## CodeQL changes

| Alerts | Change                                                                                |
| ------ | ------------------------------------------------------------------------------------- |
| 1–3    | Invoke MSVC, GCC, and Clang directly with argument arrays; remove shell path quoting. |
| 4      | Escape desktop-entry executable paths in one pass, preserving both unescaping layers. |
| 5      | Preserve Markdown backslashes while inserting table pipe delimiters with split/join.  |
| 6      | Dispatch test HTTP requests by equality against explicitly registered routes.         |
| 7      | Explicitly disable the shell when spawning the text monitor.                          |
| 8      | Identify Groq endpoints by parsed hostname, including spoofed-host regression tests.  |
| 9      | Check the parsed origin in the self-hosted transcription test.                        |
| 10–11  | Assert the route's endpoint field directly instead of searching serialized objects.   |

No alert was dismissed or excluded from analysis. GitHub must rerun CodeQL on the
changed commit before its alerts can be confirmed closed.

## Workflow changes

- Use complete translation keys in the tray updater so source coverage validates them.
- Add missing `noReleases` messages to every locale. New messages use English,
  following the workspace's English-only rule for disk changes.
- Build unsigned Windows and macOS artifacts when signing credentials are absent.
- Treat the Microsoft Calendar integration as optional for Hina releases.
- Use the workflow token when a separate download/publish token is unavailable.
- Allow bundled fallback fonts when private upstream font credentials are absent.
- Verify the macOS bundle at `Hina Desktop.app`.
- Restrict the inherited Nix and WinGet jobs to `OpenWhispr/openwhispr`: their
  existing package definitions and identifier belong to upstream, not Hina.

## Dependencies and verification

Electron is updated from 41.10.7 to 42.11.18. Its package no longer installs the
binary automatically, so the project postinstall explicitly runs Electron's
installer before rebuilding app dependencies.

Validation includes the project quality check, locale coverage, npm audit,
actionlint over every workflow, Windows compiler argument regression tests,
HTTP route rejection tests, and the complete test suite with required SQLite tests.

The first full test run passed 8,644 cases but failed 12: ten Vite module-loader
timeouts under parallel load and two missing-Xvfb probes reporting EACCES through
the inherited PATH. The verification rerun uses two test workers and a Linux-only
PATH. Native X11 integration tests require Xvfb and their development libraries;
GitHub's platform builds still need to run after the changes are pushed.

Final verification: 8,658 passed, 0 failed, 37 skipped, and 1 TODO across 8,696
cases (278 seconds). The nine compiler argument regression cases also pass.
`npm run quality-check`, `npm run i18n:check`, `npm run build:renderer`, and
`actionlint` pass. `npm audit` reports zero vulnerabilities at every severity.
