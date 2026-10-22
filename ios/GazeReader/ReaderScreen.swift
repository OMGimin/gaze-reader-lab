import SwiftUI
import WebKit

struct EmbeddedReader: UIViewRepresentable {
    let model: ReaderModel
    func makeUIView(context: Context) -> WKWebView { model.webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

struct CameraControls: View {
    @ObservedObject var tracker: FaceTracker
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(tracker.status).font(.caption).foregroundStyle(tracker.running ? .orange : .secondary)
                .accessibilityLabel(tracker.running ? "카메라 사용 중" : tracker.status)
            HStack {
                Button("카메라 시작") { tracker.start() }.disabled(tracker.running || !tracker.supported)
                Button("카메라 끄기", role: .destructive) { tracker.stop() }
            }.buttonStyle(.bordered).controlSize(.regular)
            if !tracker.supported { Text("이 기기는 ARKit 얼굴 추적을 지원하지 않습니다. 웹툰은 손으로 읽을 수 있습니다.").font(.caption) }
        }
    }
}

struct ReaderScreen: View {
    @StateObject private var model = ReaderModel()
    @Environment(\.scenePhase) private var phase
    @State private var privacy = false
    @FocusState private var editing: Bool
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                TextField("웹툰 주소", text: $model.address)
                    .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder).focused($editing)
                    .onSubmit { editing = false; model.open() }
                Button("열기") { editing = false; model.open() }
                Button { model.tracker.stop(); privacy = true } label: { Image(systemName: "info.circle") }
                    .accessibilityLabel("이용 안내와 개인정보 처리방침")
            }
            CameraControls(tracker: model.tracker)
            HStack {
                Button("시선 보정") { editing = false; model.calibrate() }
                Button(model.active ? "정지" : "시작") {
                    if model.active { model.pause() } else { editing = false; model.resume() }
                }.disabled(!model.calibrated)
                if model.collecting { Button("취소") { model.invalidate("보정 취소") } }
            }.buttonStyle(.borderedProminent)
            Text(model.message).font(.caption).frame(maxWidth: .infinity, alignment: .leading)
            GeometryReader { geometry in
                ZStack {
                    EmbeddedReader(model: model)
                    if let target = model.target {
                        Color.black.opacity(0.9)
                        VStack(spacing: 8) {
                            Text(model.step < 3 ? "시선 보정" : "새 표본으로 검증")
                            Text("기기와 머리를 고정하고 점만 바라보세요").font(.caption)
                        }.foregroundStyle(.white).position(x: geometry.size.width / 2, y: geometry.size.height * 0.35)
                        Circle().fill(.yellow).frame(width: 28, height: 28)
                            .overlay(Circle().stroke(.white, lineWidth: 3))
                            .position(x: geometry.size.width / 2, y: geometry.size.height * target)
                            .accessibilityLabel("\(model.step % 3 == 0 ? "위" : model.step % 3 == 1 ? "가운데" : "아래") 보정점")
                    } else if model.active {
                        VStack {
                            Text("이전 · 0.9초 응시").frame(maxWidth: .infinity).frame(height: geometry.size.height * 0.23)
                            Spacer()
                            Text("다음 · 0.9초 응시").frame(maxWidth: .infinity).frame(height: geometry.size.height * 0.23)
                        }.font(.caption).foregroundStyle(.white).background(Color.clear)
                            .allowsHitTesting(false)
                    }
                }
                .onAppear { model.resize(geometry.size) }
                .onChange(of: geometry.size) { _, size in model.resize(size) }
            }
        }.padding(.horizontal, 10)
            .onChange(of: editing) { _, value in if value { model.pause("주소 입력 중 · 자동 이동 정지") } }
            .onChange(of: phase) { _, value in if value != .active { model.tracker.stop() } }
            .onDisappear { model.tracker.stop() }
            .sheet(isPresented: $privacy) {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            Text("설치형 실험 버전").font(.title2)
                            Text("네이버 웹툰 앱을 조작하지 않습니다. 이 앱 안에서 무료 공개 웹툰 웹페이지를 읽습니다. 로그인·결제·외부 앱 열기는 지원하지 않습니다. 세로 화면에서 기기를 거치하고 사용하세요.")
                            Text("카메라와 얼굴 정보").font(.headline)
                            Text("카메라 시작을 직접 누르고 권한을 허용해야 전면 카메라를 사용합니다. ARKit의 얼굴 위치, 눈 깜박임, 추정 시선을 기기 메모리에서만 처리합니다. 촬영·녹화·파일 저장·서버 전송·광고 추적에 사용하지 않습니다. 보정 표본은 검증 후 또는 취소하면 버리고, 화면을 떠나거나 카메라를 끄면 보정값도 버립니다.")
                            Text("웹페이지는 별도입니다").font(.headline)
                            Text("네이버 페이지는 인터넷을 사용하고 자체 콘텐츠·이미지·통계 요청을 보낼 수 있습니다. 이 앱은 얼굴·시선 정보를 페이지나 네이버에 전달하지 않습니다. 웹사이트 카메라·마이크 요청은 거절합니다. 웹 방문 데이터는 비영구 세션으로 사용합니다.")
                            Text("안전한 정지").font(.headline)
                            Text("가운데를 0.35초 보고 위나 아래를 0.9초 보면 반 화면씩 한 번 이동합니다. 이동마다 가운데로 돌아와야 합니다. 손으로 스크롤하거나 얼굴 추적이 끊기면 정지합니다. 위치가 바뀌면 다시 보정해야 합니다. 부정확하거나 불편하면 정지하거나 카메라를 끄세요.")
                            Text("지원 여부와 정확도는 다릅니다. 실제 기기의 보정 검증에 실패하면 자동 스크롤을 켤 수 없습니다. 의료·보조공학 인증 제품이 아니며 실제 기기 검증이 필요합니다.").font(.caption)
                        }.padding()
                    }.navigationTitle("이용 안내·개인정보")
                        .toolbar { Button("닫기") { privacy = false } }
                }
            }
    }
}
