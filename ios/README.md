# iPhone 14 Pro reader — experimental, not yet device-validated

## Scope and status

This is a separate native iPhone app, not an update to the Chrome extension and not a controller for the Naver Webtoon app. The current target is **iPhone 14 Pro, portrait, iOS 17 or newer**, with the phone on a stand. iPad work is postponed. A runtime ARKit capability check remains in place.

**Not ready to claim an installable release yet:** source is implemented, but Xcode generation/build, XCTest execution, Apple signing, installation, live gaze accuracy and real Naver scrolling have NOT been verified. No IPA or TestFlight invitation exists. No Apple account, signing certificate, device permission or Developer Mode was configured by this work.

The app uses a native ARSession and native WKWebView scrolling. It does not inject face/gaze data into JavaScript, use the desktop MediaPipe model, scrape/copy webtoon assets, bypass paywalls, or automate login/purchases.

## Installation from source (requires your Mac)

1. Install a compatible Xcode from Apple. Xcode must support the iOS version on your phone. Open it and complete any first-run setup yourself.
2. Clone this repository and check out `feature/iphone14pro-reader`. Do not use `main` or the older Chrome PR branch for these instructions.
3. Install XcodeGen from its official Homebrew formula if not already installed: `brew install xcodegen`.
4. In the repository run `cd ios && xcodegen generate`, then `open GazeReader.xcodeproj`.
5. In the GazeReader target's Signing & Capabilities, choose your own Personal Team / Apple Developer team and a unique bundle identifier. `com.example.GazeReader` is a placeholder. Never put credentials, certificates or profiles in Git.
6. Connect your iPhone 14 Pro, select it as the run destination, and follow Apple's pairing/Developer Mode prompts yourself. Those are device-security changes; this repository does not automate them.
7. Build and Run. If a signing/trust error appears, follow Xcode's exact error rather than disabling device security broadly.
8. Review the in-app information screen, open a free public episode, press Camera Start and decide whether to grant camera access.

Free Personal Team signing is temporary: Apple documents seven-day expiration, so rebuilding/reinstalling is required. TestFlight/App Store distribution is a separate developer-program/signing/review workflow and has not been configured. Do not pay for membership merely to try this source build without first checking the free option.

## Reading flow

- Open an episode under `https://comic.naver.com/webtoon/detail` or `https://m.comic.naver.com/webtoon/detail`. The initial catalog is `/webtoon/weekday`.
- Only exact HTTPS hosts are allowed for main-frame navigation. Login, purchase and external app links are intentionally unsupported. If Naver changes its routes or uses a nested scroll container, this build may not work; test and fix that compatibility rather than widening access blindly.
- Camera starts only from the native Camera Start button. Website camera/microphone requests are denied.
- Run calibration: top, center, bottom, followed by three fresh validation targets. Each point waits 1.2 seconds and takes 30 valid frames. Each validation region must reach at least 80% matching samples; samples are not discarded to manufacture a pass.
- The vertical signal is derived from ARKit's estimated face-relative look-at point. The mapping is empirical, not a screen-coordinate API or a claim of 80% real-world accuracy. Minimum signal separation and pose thresholds need real-device tuning.
- Press Start after validation passes. Center for 0.35 seconds arms one action; top/bottom for 0.9 seconds moves half a viewport, capped at 480 points. Center is required again for the next action.
- Short blinks disarm dwell; prolonged eye closure, lost/late tracking and touch scrolling pause. Head displacement >4 cm or rotation >10 degrees invalidates calibration. These are provisional engineering limits, not validated universal limits.
- Navigation, camera stop, opening the information sheet, leaving the foreground, zooming or viewport size changes invalidate calibration. No background camera/resume behavior is intended.
- Tracking requests the maximum supported face count and binds calibration to the face anchor identifier. ARKit's supported face limit does not guarantee detection of all other people in view. Use alone, with one face in frame.

## Privacy

Camera frames, face transforms, blink values and derived gaze are processed natively in memory only. No recording, persistence or transmission is implemented. Raw calibration samples are discarded on completion/cancel; calibration is discarded when capture stops. No camera/microphone entitlement is granted to the website. Only the resulting ordinary scroll changes are visible to web content.

Naver and its embedded resources still make their own network requests. The navigation allowlist is **not a network firewall**. The app uses a nonpersistent WKWebsiteDataStore, not an offline or tracker-blocking browser. See the in-app Korean privacy explanation and `PrivacyInfo.xcprivacy`. System boot time is used only for local frame-age/interval checks (required-reason category, 35F9.1).

## Validation commands

```sh
cd ios
xcodegen generate
xcodebuild -list -project GazeReader.xcodeproj
xcodebuild test -project GazeReader.xcodeproj -scheme GazeReader \
  -destination 'platform=iOS Simulator,name=<an available iPhone simulator>' \
  CODE_SIGNING_ALLOWED=NO
```

The simulator can compile and run pure-logic tests, not prove face tracking. `.github/workflows/ios-manual.yml` is a manual macOS validation workflow; it was not dispatched by this change and does not run on every push. It is not a substitute for physical-device tests.

## Release gate: all items still pending on iPhone 14 Pro

- [ ] XcodeGen generation, simulator build and eight XCTest methods pass.
- [ ] Physical-device signing, installation and launch pass.
- [ ] First-time camera Allow and Deny paths behave correctly; cancellation/backgrounding during the prompt never auto-starts capture later.
- [ ] A real public Naver episode loads and its outer WKWebView scroll view moves the reading content, not just the browser chrome.
- [ ] Fresh three-zone validation passes without relaxing thresholds to hide errors; a fixed/invalid gaze signal fails.
- [ ] Neutral→edge movements work across transition bands; long transit disarms.
- [ ] Short blink cancels intention; long closure, missing face, different tracked face, late frames and interruption cannot scroll.
- [ ] Lock screen, home switch, phone interruption, privacy sheet and navigation shut down/cancel as documented.
- [ ] Manual dragging and zoom stop automatic behavior; no unintended motion after resuming.
- [ ] Recalibration after movement/resize works; screen targets fit the 14 Pro's safe area and keyboard behavior.
- [ ] Five-minute reading session has no unintended scroll; check heat, battery, fatigue and accessibility text sizes.
- [ ] No face/gaze network payload, recorded files, device identifiers or signing data in logs/artifacts.

## Sources

- [Apple ARFaceTrackingConfiguration and runtime support](https://developer.apple.com/documentation/arkit/arfacetrackingconfiguration)
- [Apple face-relative lookAtPoint](https://developer.apple.com/documentation/arkit/arfaceanchor/lookatpoint)
- [WKWebView scrollView](https://developer.apple.com/documentation/webkit/wkwebview/scrollview)
- [Apple ARKit permission and privacy](https://developer.apple.com/documentation/arkit/verifying-device-support-and-user-permission)
- [Apple Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Xcode requirements](https://developer.apple.com/xcode/system-requirements/)
- [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)
