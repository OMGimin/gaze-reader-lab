import Foundation

enum GazeZone: String, CaseIterable { case up, neutral, down }
struct VerticalCalibration {
    let up: Double, neutral: Double, down: Double
    static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted(), middle = sorted.count / 2
        guard !sorted.isEmpty else { return .nan }
        return sorted.count % 2 == 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
    }
    static func fit(_ samples: [[Double]]) -> VerticalCalibration? {
        guard samples.count == 3, samples.allSatisfy({ $0.count >= 24 && $0.allSatisfy(\.isFinite) }) else { return nil }
        let centers = samples.map(median)
        let spread = zip(samples, centers).map { values, center in median(values.map { abs($0 - center) }) }
        let first = centers[1] - centers[0], second = centers[2] - centers[1]
        // Device-dependent experimental limits, not a claim of clinical accuracy.
        guard first * second > 0,
              min(abs(first), abs(second)) > max(0.008, 4 * (spread.max() ?? 0)) else { return nil }
        return Self(up: centers[0], neutral: centers[1], down: centers[2])
    }
    func position(_ signal: Double) -> Double? {
        guard signal.isFinite else { return nil }
        let increasing = down > up
        let upperHalf = increasing ? signal <= neutral : signal >= neutral
        let value = upperHalf ? 0.15 + 0.35 * (signal - up) / (neutral - up)
                              : 0.5 + 0.35 * (signal - neutral) / (down - neutral)
        // Never clamp an invalid estimate into a scroll zone.
        return value.isFinite && (0...1).contains(value) ? value : nil
    }
    func zone(_ signal: Double) -> GazeZone? {
        guard let y = position(signal) else { return nil }
        if y <= 0.23 { return .up }
        if y >= 0.77 { return .down }
        return (0.35...0.65).contains(y) ? .neutral : nil
    }
    func validate(_ groups: [[Double]]) -> [Double]? {
        guard groups.count == 3, groups.allSatisfy({ $0.count >= 24 }) else { return nil }
        return zip(groups, GazeZone.allCases).map { samples, expected in
            Double(samples.filter { zone($0) == expected }.count) / Double(samples.count)
        }
    }
}

struct DwellGate {
    private(set) var armed = false
    private var zone: GazeZone?
    private var since: TimeInterval = 0
    private var last: TimeInterval?
    private var transitSince: TimeInterval?
    mutating func reset() { armed = false; zone = nil; last = nil; since = 0; transitSince = nil }
    mutating func update(_ next: GazeZone?, at now: TimeInterval, validTransit: Bool = false) -> GazeZone? {
        guard now.isFinite else { reset(); return nil }
        if let last, now < last || now - last > 0.35 { reset() }
        last = now
        guard let next else {
            zone = nil
            if validTransit {
                transitSince = transitSince ?? now
                if now - (transitSince ?? now) > 0.5 { armed = false }
            } else { armed = false; transitSince = nil }
            return nil
        }
        transitSince = nil
        if next != zone { zone = next; since = now }
        if next == .neutral && now - since >= 0.35 { armed = true }
        if next != .neutral && armed && now - since >= 0.9 {
            armed = false; return next
        }
        return nil
    }
}
