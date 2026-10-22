import XCTest
@testable import GazeReader

final class GazeMathTests: XCTestCase {
    private func group(_ value: Double) -> [Double] { Array(repeating: value, count: 30) }
    func testConstantSignalAndMissingGroupsFail() {
        XCTAssertNil(VerticalCalibration.fit([group(0), group(0), group(0)]))
        XCTAssertNil(VerticalCalibration.fit([group(0), group(0.1)]))
        XCTAssertNil(VerticalCalibration.fit([group(.nan), group(0), group(0.1)]))
    }
    func testBothCameraDirectionsAreSupported() throws {
        for sign in [1.0, -1.0] {
            let model = try XCTUnwrap(VerticalCalibration.fit([group(-0.1 * sign), group(0), group(0.1 * sign)]))
            XCTAssertEqual(model.zone(-0.1 * sign), .up)
            XCTAssertEqual(model.zone(0), .neutral)
            XCTAssertEqual(model.zone(0.1 * sign), .down)
            XCTAssertNil(model.zone(.nan))
            XCTAssertNil(model.zone(100))
        }
    }
    func testUnorderedAndNoisyCalibrationFails() {
        XCTAssertNil(VerticalCalibration.fit([group(0), group(0.1), group(0.05)]))
        let noisy = (0..<30).map { $0 % 2 == 0 ? -0.1 : 0.1 }
        XCTAssertNil(VerticalCalibration.fit([group(-0.1), noisy, group(0.1)]))
    }
    func testIndependentValidationDoesNotDropBadFrames() throws {
        let model = try XCTUnwrap(VerticalCalibration.fit([group(-0.1), group(0), group(0.1)]))
        let mixed = Array(repeating: -0.1, count: 20) + Array(repeating: Double.nan, count: 10)
        let rates = try XCTUnwrap(model.validate([mixed, group(0), group(0.1)]))
        XCTAssertEqual(rates[0], 2.0 / 3.0, accuracy: 0.001)
        XCTAssertLessThan(rates[0], 0.8)
    }
    func testDwellNeedsCenterAndFiresOnce() {
        var gate = DwellGate()
        for i in 0...20 { XCTAssertNil(gate.update(.down, at: Double(i) * 0.1)) }
        for i in 21...26 { XCTAssertNil(gate.update(.neutral, at: Double(i) * 0.1)) }
        var actions = 0
        for i in 27...60 { if gate.update(.down, at: Double(i) * 0.1) != nil { actions += 1 } }
        XCTAssertEqual(actions, 1)
    }
    func testStaleInvalidAndBackwardsTimeDisarm() {
        for invalid in [Double.nan, -1, 4] {
            var gate = DwellGate()
            for i in 0...5 { _ = gate.update(.neutral, at: Double(i) * 0.1) }
            XCTAssertTrue(gate.armed)
            XCTAssertNil(gate.update(.down, at: invalid))
            XCTAssertFalse(gate.armed)
        }
        var gate = DwellGate()
        for i in 0...5 { _ = gate.update(.neutral, at: Double(i) * 0.1) }
        _ = gate.update(nil, at: 0.6)
        XCTAssertFalse(gate.armed)
    }
    func testNavigationUsesExactHTTPSHostsAndEpisodePath() throws {
        XCTAssertTrue(ReaderPolicy.allows(try XCTUnwrap(URL(string: "https://comic.naver.com/webtoon/weekday"))))
        XCTAssertTrue(ReaderPolicy.isEpisode(URL(string: "https://m.comic.naver.com/webtoon/detail?titleId=1&no=1")))
        for bad in ["http://comic.naver.com/webtoon/detail", "https://comic.naver.com.evil.test/webtoon/detail", "https://evil.test/?comic.naver.com", "https://comic.naver.com/webtoon/detail.evil", "https://comic.naver.com:444/webtoon/detail", "https://user:pass@comic.naver.com/webtoon/detail", "https://nid.naver.com/webtoon/detail", "javascript:alert(1)"] {
            XCTAssertFalse(ReaderPolicy.isEpisode(URL(string: bad)), bad)
        }
    }
}
