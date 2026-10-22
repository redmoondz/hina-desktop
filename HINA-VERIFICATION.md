# Hina Desktop v0.1 verification

Test date: 2026-10-22. This report distinguishes verified integration from
interactive voice acceptance. It does not mark the complete milestone accepted.

## Checkout audit

| Checkout | Initial state |
| --- | --- |
| WSL `/home/redmoon/projects/hina-desktop/desktop` | Clean, `hina-desktop` at `ba6d618`, only `upstream` remote |
| Windows `C:\Users\siriu\projects\hina-desktop\desktop` | Clean, upstream `ba6d61820`, `origin` pointed to OpenWhispr |

No initial tracked or untracked changes were present. Neither checkout was
reset or cleaned. The infrastructure repository `redmoondz/hine-whispr` was
preserved. The separate fork is `https://github.com/redmoondz/hina-desktop`.
Upstream source history and MIT attribution remain intact.

## Verified results

| Check | Result |
| --- | --- |
| Windows Node / Electron | Node 24.22.1 / Electron 41.10.7 |
| Full `npm run quality-check` | Passed; two existing fast-refresh warnings, zero lint errors |
| Hina transport / renderer route / LAN / secret storage / field policy | 48 passed, 0 failed |
| Windows renderer and unsigned directory packaging | Passed |
| Packaged app launch | Separate `Hina Desktop.exe` and `%APPDATA%\Hina Desktop`; SQLite loads with Electron ABI 145 |
| Packaged app real integration | `ReasoningService` -> IPC -> WSL curl -> existing Connector -> existing `hina` agent returned `HINA_CONNECTION_OK` |
| Connector record of successful integration run | One command, one success |
| Agent turn wall time | 101,709 ms, including transport and CLI execution |
| Screenshot inspection | 1280 and 390 px, light and dark; Hina settings visible and usable |
| Console exception capture during screenshot check | None |
| Original OpenWhispr coexistence | Original OpenWhispr processes remained running while the separate Hina executable ran |

The successful live run used the actual packaged renderer service and actual
main-process transport. Its input was text after the speech-recognition stage;
it did not simulate a microphone. An earlier live attempt lost its renderer
context during a screenshot reload and was not counted as a pass. One repeat
was authorized explicitly and succeeded. A prior Windows-local connectivity
failure did not reach the agent. No extra agent turns were used for the
connection/authentication checks.

Connector does not expose provider token usage or cost. Those fields remain
unknown rather than fabricated. See `evidence/v0.1/live-integration.json`.

## Full upstream test suite

The Windows run completed with 8,759 tests: 8,673 passed, 38 failed, 47 skipped,
and one todo, in approximately 333 seconds. The saved pre-change upstream run
had 8,752 tests, 8,650 passed, 53 failed, 48 skipped, and one todo.

Comparison of failure names found one newly introduced failure: the explicit
review inventory for Input field text direction. Hina URL and token fields
were assigned `dir="ltr"`, and the inventory was updated. The final focused
run, including this policy test, passed all 48 tests. The full suite was not
rerun after this isolated correction; no full-suite green result is claimed.
The other observed failure names already occur in the saved upstream log,
including GPU UI expectations, locale-dependent help strings, native helper
fixtures, and platform-specific IPC/timing tests. They were not changed as part
of this integration.

The initial global formatting failure was Windows CRLF checkout conversion,
not a content rewrite. Tracked text sources were normalized to the project's
required LF, and `.gitattributes` now preserves LF for source/text extensions.
The full quality check then passed.

## Remaining acceptance

- Record a real Russian voice command with a microphone and the configured
  Voice Assistant hotkey in an interactive Windows session.
- Confirm transcript, agent reply delivery, and settings persistence using the
  operator's long-lived Connector and its private token.
- Verify any upstream cloud OAuth flows that the operator uses. The fork has
  an independent URI protocol and requires corresponding provider callbacks.
- Resolve or explicitly accept the inherited upstream test failures before
  claiming a completely green upstream regression suite.

The included build is unsigned and packaged as a complete application
directory. It is not a signed release installer. Follow `HINA-WINDOWS.md` for
launch, connection, and manual voice acceptance.
