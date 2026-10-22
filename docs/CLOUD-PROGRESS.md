# Cloud continuation: diagnostics and camera lifecycle

The public baseline was cloned into a separate Linux cloud workspace. The user's Mac was not modified by this continuation.

## Changes

- Calibration diagnostics now offer an explicit **진단 요약 복사** button. Only aggregate errors, predefined target coordinates, region agreement and sample counts are copied. No video, eye features, model coefficients, page URL or device identifiers are included. There is no automatic upload. If clipboard access is unavailable, a selectable text area is shown. Recalibration clears the prior summary.
- Pending model creation is disposed when its tracker has been destroyed.
- Camera track termination is observed before waiting for video playback. End events are bound to their originating stream/session, so a stale event cannot stop a newer camera session.
- Back/Forward-cache restoration starts a fresh camera-off document, requiring explicit user activation again.
- Playwright optionally accepts `PLAYWRIGHT_EXECUTABLE_PATH` for an existing test browser.

## Verification

- Dependency installation, pinned model download/hash validation and production build succeeded on Linux.
- 30 Node unit tests passed, including synthetic camera lifecycle and diagnostic privacy checks.
- UI coverage was extended for summary copy and clipboard fallback. Linux UI execution was blocked before tests could run: Chromium could not create its process socket in the sandbox; the approved escalation path failed to start its container. These are **not passed UI tests**. The previous Mac baseline's 9 UI passes do not validate these newer changes.
- No real camera was activated. Human gaze accuracy and actual Naver integration remain unverified.

For a permitted environment with a system Chromium:

```sh
npm ci --ignore-scripts
npm run model
npm run build
npm test
PLAYWRIGHT_BROWSER=chromium PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm run test:ui
```

If the browser cannot launch, use the environment's normal approval/setup route. Do not weaken system security settings. The previous Mac version and these cloud changes must not be conflated; pull and rebuild before testing the newer revision.
