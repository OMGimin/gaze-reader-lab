# Validation record — 2026-10-22

Environment: Linux cloud workspace. No Swift compiler, Xcode, iPhone connection or camera session.

## Executed

- `npm test`: 22/22 existing JavaScript tests pass on the independent mobile branch based on main.
- `npm run build`: existing web/Chrome bundle build succeeds.
- Python `plistlib`: Info.plist and PrivacyInfo.xcprivacy parse successfully.
- Source review: reviewed stale/pre-start frame rejection, face identity binding, transition-zone intent, privacy-sheet cancellation and blink behavior; changes are recorded in separate fix commits.

Earlier 30/30 JavaScript results belonged to the desktop diagnostics branch including PR #1. The mobile branch deliberately excludes those unrelated changes, so its 22-test result is expected and is not a reduction of PR #1's tests.

## Written but NOT run

Eight XCTest methods cover vertical calibration failure/inversion/noise, unfiltered held-out validation, one-shot dwell, stale/invalid time, short/long transit and exact-host navigation. These do not constitute ARKit, lifecycle integration, signing or real-device coverage.

## Not established

XcodeGen project validity, Swift compilation, XCTest results, simulator launch, signing, installation, ARKit signal quality on iPhone 14 Pro, live Naver route/scroll compatibility, latency/power/accessibility. This change stays draft until those gates are checked. A generated project or green JS test run is not evidence of a usable iOS release.
