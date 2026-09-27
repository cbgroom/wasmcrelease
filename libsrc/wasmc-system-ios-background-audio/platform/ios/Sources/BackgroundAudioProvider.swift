import AVFoundation
import Foundation
import UIKit

final class BackgroundAudioProvider: NSObject, AVAudioPlayerDelegate {
    static let didChange = Notification.Name("wasmc.background-audio.did-change")
    private let queue = DispatchQueue(label: "io.wasmc.background-audio-journal")
    private let journalURL: URL
    private let fixtureURL: URL
    private var player: AVAudioPlayer?
    private var timer: Timer?
    private var sequence: UInt64 = 0
    private var startError = ""

    override init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        journalURL = support.appendingPathComponent("wasmc-ios-background-audio.jsonl")
        fixtureURL = support.appendingPathComponent("wasmc-ios-background-audio.wav")
        super.init()
    }

    func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-background-audio@0.0.1",
            "provider": "wasmc:system-ios-background-audio@0.0.1-dev.1",
            "session_category": "playback",
            "physical_output_qualified": false,
        ], options: [.sortedKeys])
    }

    func reset() {
        stop()
        queue.sync {
            try? FileManager.default.removeItem(at: journalURL)
            sequence = 0
            startError = ""
        }
    }

    func start() {
        do {
            if !FileManager.default.fileExists(atPath: fixtureURL.path) {
                try Self.wavFixture().write(to: fixtureURL, options: .atomic)
            }
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            let player = try AVAudioPlayer(contentsOf: fixtureURL)
            player.numberOfLoops = -1
            player.volume = 0
            player.delegate = self
            guard player.prepareToPlay(), player.play() else { throw NSError(domain: "WAsmCBackgroundAudio", code: 1) }
            self.player = player
            record("playback-started")
            timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
                self?.record("playback-sample")
            }
        } catch {
            queue.sync { startError = String(describing: error) }
            record("playback-failed")
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        player?.stop()
        player = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    func report() -> [String: Any] {
        let retained = events()
        let samples = retained.filter { ($0["name"] as? String) == "playback-sample" }
        let background = samples.filter { ($0["phase"] as? String) == "background" }
        let positions = background.compactMap { ($0["position_ms"] as? NSNumber)?.intValue }
        let delta = max(0, (positions.max() ?? 0) - (positions.min() ?? 0))
        let allPlaying = !background.isEmpty && background.allSatisfy { ($0["playing"] as? Bool) == true }
        return [
            "schema": "wasmc.ios-background-audio-qualification/v1",
            "accepted": background.count >= 5 && delta >= 1_500 && allPlaying && startError.isEmpty,
            "background_samples": background.count,
            "background_position_delta_ms": delta,
            "all_background_samples_playing": allPlaying,
            "start_error": startError,
            "physical_output_qualified": false,
            "lock_screen_qualified": false,
            "route_change_qualified": false,
            "interruption_qualified": false,
            "events": retained,
            "admitted": false,
            "released": false,
        ]
    }

    private func record(_ name: String) {
        let phase = Self.phaseName(UIApplication.shared.applicationState)
        let playing = player?.isPlaying ?? false
        let position = Int((player?.currentTime ?? 0) * 1_000)
        queue.sync {
            sequence += 1
            let event: [String: Any] = [
                "sequence": sequence,
                "name": name,
                "phase": phase,
                "playing": playing,
                "position_ms": position,
                "monotonic_ns": DispatchTime.now().uptimeNanoseconds,
            ]
            guard let data = try? JSONSerialization.data(withJSONObject: event, options: [.sortedKeys]) else { return }
            if !FileManager.default.fileExists(atPath: journalURL.path) {
                FileManager.default.createFile(atPath: journalURL.path, contents: nil)
            }
            guard let handle = try? FileHandle(forWritingTo: journalURL) else { return }
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
            try? handle.write(contentsOf: Data([0x0a]))
        }
        DispatchQueue.main.async { NotificationCenter.default.post(name: Self.didChange, object: self) }
    }

    private func events() -> [[String: Any]] {
        queue.sync {
            guard let text = try? String(contentsOf: journalURL, encoding: .utf8) else { return [] }
            return text.split(separator: "\n").compactMap { line in
                guard let data = String(line).data(using: .utf8),
                      let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
                return value
            }
        }
    }

    private static func phaseName(_ state: UIApplication.State) -> String {
        switch state {
        case .active: return "active"
        case .background: return "background"
        case .inactive: return "inactive"
        @unknown default: return "unknown"
        }
    }

    private static func wavFixture() -> Data {
        let sampleRate: UInt32 = 8_000
        let seconds: UInt32 = 12
        let dataBytes = sampleRate * seconds * 2
        var data = Data()
        func appendASCII(_ value: String) { data.append(value.data(using: .ascii)!) }
        func append16(_ value: UInt16) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }
        func append32(_ value: UInt32) {
            var little = value.littleEndian
            withUnsafeBytes(of: &little) { data.append(contentsOf: $0) }
        }
        appendASCII("RIFF"); append32(36 + dataBytes); appendASCII("WAVE")
        appendASCII("fmt "); append32(16); append16(1); append16(1)
        append32(sampleRate); append32(sampleRate * 2); append16(2); append16(16)
        appendASCII("data"); append32(dataBytes)
        data.append(Data(count: Int(dataBytes)))
        return data
    }
}
