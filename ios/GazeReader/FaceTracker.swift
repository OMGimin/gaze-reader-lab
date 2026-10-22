import ARKit
import AVFoundation
import Combine

/// All frames and derived face geometry stay native and in memory.
/// No rendering surface, recording, analytics, network client or web message bridge.
final class FaceTracker: NSObject, ObservableObject, ARSessionDelegate {
    struct Sample {
        let blinking: Bool
        let faceID: UUID
        let signal: Double
        let head: simd_float4x4
        let time: TimeInterval
    }
    @Published private(set) var running = false
    @Published private(set) var status = "카메라 꺼짐"
    var onSample: ((Sample?) -> Void)?
    var onStop: (() -> Void)?
    private let session = ARSession()
    private var generation = 0
    private var lastTime: TimeInterval = -1
    private var startedAt: TimeInterval = 0
    var supported: Bool { ARFaceTrackingConfiguration.isSupported }
    override init() { super.init(); session.delegate = self; session.delegateQueue = .main }
    func start() {
        guard supported else { status = "이 기기는 ARKit 얼굴 추적을 지원하지 않습니다"; return }
        stop()
        let request = generation
        status = "카메라 권한 확인 중"
        AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self, request == self.generation else { return }
                guard allowed else { self.status = "카메라 권한이 필요합니다. 설정에서 허용할 수 있습니다"; return }
                let config = ARFaceTrackingConfiguration()
                config.isLightEstimationEnabled = false
                config.maximumNumberOfTrackedFaces = ARFaceTrackingConfiguration.supportedNumberOfTrackedFaces
                self.running = true
                self.lastTime = -1
                self.startedAt = ProcessInfo.processInfo.systemUptime
                self.status = "카메라 사용 중 · 얼굴을 화면 정면에 두세요"
                self.session.run(config, options: [.resetTracking, .removeExistingAnchors])
            }
        }
    }
    func stop() {
        generation += 1; session.pause(); running = false
        status = "카메라 꺼짐"; onSample?(nil); onStop?()
    }
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard running, frame.timestamp > lastTime else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard frame.timestamp >= startedAt, now >= frame.timestamp, now - frame.timestamp <= 0.25 else {
            onSample?(nil); return
        }
        lastTime = frame.timestamp
        guard case .normal = frame.camera.trackingState else { onSample?(nil); return }
        let faces = frame.anchors.compactMap { $0 as? ARFaceAnchor }
        guard faces.count == 1, let face = faces.first, face.isTracked else { onSample?(nil); return }
        let blinking = (face.blendShapes[.eyeBlinkLeft]?.doubleValue ?? 1) >= 0.55 ||
                       (face.blendShapes[.eyeBlinkRight]?.doubleValue ?? 1) >= 0.55
        let p = face.lookAtPoint
        guard p.x.isFinite, p.y.isFinite, p.z.isFinite, abs(p.z) > 0.001 else { onSample?(nil); return }
        let relative = simd_mul(simd_inverse(frame.camera.transform), face.transform)
        onSample?(Sample(blinking: blinking, faceID: face.identifier, signal: atan2(Double(p.y), Double(abs(p.z))), head: relative, time: frame.timestamp))
    }
    func sessionWasInterrupted(_ session: ARSession) { stop(); status = "카메라 중단 · 직접 다시 시작하세요" }
    func session(_ session: ARSession, didFailWithError error: Error) { stop(); status = "추적 오류 · 카메라를 다시 시작하세요" }
    deinit { session.pause() }
}
