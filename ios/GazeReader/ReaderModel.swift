import SwiftUI
import WebKit
import simd

final class ReaderModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, UIScrollViewDelegate {
    let tracker = FaceTracker()
    let webView: WKWebView
    @Published var address = "https://comic.naver.com/webtoon/weekday"
    @Published private(set) var message = "무료 공개 회차를 열고 카메라를 시작하세요"
    @Published private(set) var active = false
    @Published private(set) var target: Double?
    @Published private(set) var step = 0
    @Published private(set) var calibrated = false
    @Published private(set) var collecting = false
    @Published private(set) var pageReady = false
    private var groups = Array(repeating: [Double](), count: 6)
    private var settledAt: Double?
    private var baseline: simd_float4x4?
    private var calibratedFace: UUID?
    private var calibration: VerticalCalibration?
    private var gate = DwellGate()
    private var lastSample: Double?
    private var watchdog: Timer?
    private var viewport: CGSize = .zero
    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.delegate = self
        tracker.onSample = { [weak self] sample in self?.receive(sample) }
        tracker.onStop = { [weak self] in self?.invalidate("카메라 꺼짐 · 다시 보정하세요") }
        watchdog = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in
            guard let self, self.active || self.collecting,
                  let last = self.lastSample, ProcessInfo.processInfo.systemUptime - last > 0.5 else { return }
            self.pause("추적 입력 지연 · 다시 시작하세요")
            if self.collecting { self.settledAt = nil; self.groups[self.step] = [] }
        }
        open()
    }
    func open() {
        guard let url = URL(string: address.trimmingCharacters(in: .whitespacesAndNewlines)), ReaderPolicy.allows(url) else {
            message = "https://comic.naver.com 또는 m.comic.naver.com의 /webtoon 주소만 지원합니다"; return
        }
        invalidate("페이지 여는 중"); pageReady = false
        webView.load(URLRequest(url: url))
    }
    func invalidate(_ reason: String) {
        pause(reason); calibration = nil; calibrated = false; baseline = nil; calibratedFace = nil
        collecting = false; target = nil; settledAt = nil
        groups = Array(repeating: [], count: 6)
    }
    func pause(_ reason: String = "일시 정지 · 다시 시작하려면 버튼을 누르세요") {
        active = false; gate.reset(); message = reason
        webView.scrollView.setContentOffset(webView.scrollView.contentOffset, animated: false)
    }
    func resize(_ size: CGSize) {
        defer { viewport = size }
        if viewport != .zero && viewport != size { invalidate("화면 크기가 바뀌었습니다 · 다시 보정하세요") }
    }
    func calibrate() {
        guard tracker.running, pageReady, ReaderPolicy.isEpisode(webView.url) else {
            message = "카메라를 켜고 웹툰 회차 페이지를 먼저 여세요"; return
        }
        invalidate("얼굴과 기기를 고정하고 점을 바라보세요")
        collecting = true; step = 0; target = 0.15; lastSample = ProcessInfo.processInfo.systemUptime
    }
    func resume() {
        guard calibrated, tracker.running, pageReady, ReaderPolicy.isEpisode(webView.url) else { return }
        active = true; gate.reset(); lastSample = ProcessInfo.processInfo.systemUptime
        message = "가운데 0.35초 → 위/아래 0.9초 응시 · 한 번씩 이동"
    }
    private func receive(_ sample: FaceTracker.Sample?) {
        guard let sample else {
            if active { pause("얼굴·눈 추적 중단 · 다시 시작하세요") }
            if collecting { settledAt = nil; groups[step] = [] }
            return
        }
        lastSample = ProcessInfo.processInfo.systemUptime
        if let calibratedFace, calibratedFace != sample.faceID {
            invalidate("추적 대상이 바뀌었습니다 · 다시 보정하세요"); return
        }
        if let base = baseline {
            let offset = simd_distance(base.columns.3, sample.head.columns.3)
            let dot = abs(simd_dot(simd_quatf(base).vector, simd_quatf(sample.head).vector))
            if offset > 0.04 || dot < cos(Float(10 * Double.pi / 180 / 2)) {
                invalidate("얼굴 위치가 바뀌었습니다 · 다시 보정하세요"); return
            }
        }
        if collecting {
            if baseline == nil { baseline = sample.head; calibratedFace = sample.faceID }
            if settledAt == nil { settledAt = sample.time; message = "\(step < 3 ? "보정" : "별도 검증") \(step % 3 + 1)/3 · 점 응시" }
            guard sample.time - (settledAt ?? sample.time) >= 1.2 else { return }
            groups[step].append(sample.signal)
            guard groups[step].count >= 30 else { return }
            if step == 2 {
                guard let fitted = VerticalCalibration.fit(Array(groups.prefix(3))) else {
                    invalidate("위·가운데·아래 시선이 분리되지 않습니다. 기기를 고정하고 다시 보정하세요"); return
                }
                calibration = fitted
            }
            if step == 5 {
                collecting = false; target = nil
                let rates = calibration?.validate(Array(groups.suffix(3))) ?? []
                calibrated = rates.count == 3 && rates.allSatisfy { $0 >= 0.8 }
                groups = Array(repeating: [], count: 6)
                if !calibrated { calibration = nil; baseline = nil }
                message = calibrated ? "검증 통과 · 시작 버튼을 누르세요" : "검증 실패 · 밝기와 자세를 조절해 다시 보정하세요"
            } else {
                step += 1; target = [0.15, 0.5, 0.85][step % 3]; settledAt = nil
            }
            return
        }
        guard active, let calibration, pageReady, ReaderPolicy.isEpisode(webView.url) else { return }
        if let direction = gate.update(calibration.zone(sample.signal), at: sample.time) {
            let scroll = webView.scrollView
            guard !scroll.isDragging, !scroll.isDecelerating else { pause(); return }
            let minimum = -scroll.adjustedContentInset.top
            let maximum = max(minimum, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom)
            let delta = min(scroll.bounds.height * 0.5, 480) * (direction == .down ? 1.0 : -1.0)
            let next = min(maximum, max(minimum, scroll.contentOffset.y + delta))
            scroll.setContentOffset(CGPoint(x: scroll.contentOffset.x, y: next), animated: false)
        }
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.deny)
    }
    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { pause("손으로 스크롤 중 · 자동 이동 정지") }
    func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) { invalidate("확대·축소 후 다시 보정하세요") }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Ignore iframe requests: they never receive gaze information or native privileges.
        if action.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
        guard let url = action.request.url, ReaderPolicy.allows(url), action.targetFrame != nil else {
            pause("외부 링크·로그인·앱 열기는 지원하지 않습니다"); decisionHandler(.cancel); return
        }
        invalidate("페이지 이동 · 다시 보정하세요"); pageReady = false; decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        pageReady = false; invalidate("페이지 불러오는 중")
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = ReaderPolicy.allows(webView.url ?? URL(string: "about:blank")!)
        address = webView.url?.absoluteString ?? address
        message = ReaderPolicy.isEpisode(webView.url) ? "카메라를 켜고 시선 보정을 시작하세요" : "읽을 웹툰의 무료 공개 회차를 선택하세요"
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { pageReady = false; invalidate("페이지를 열지 못했습니다 · 주소를 확인하고 다시 여세요") }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { pageReady = false; invalidate("페이지를 열지 못했습니다 · 네트워크를 확인하세요") }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { pageReady = false; tracker.stop(); invalidate("웹 페이지 종료 · 다시 여세요") }
    deinit { watchdog?.invalidate() }
}
