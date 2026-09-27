import AVFoundation
import Foundation

enum AudioProvider {
    static func invoke(_ input: Data) throws -> Data {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()
        engine.attach(player)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1),
              let inputBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512),
              let outputBuffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512),
              let samples = inputBuffer.floatChannelData?[0] else {
            throw NSError(domain: "wasmc.audio", code: 1)
        }
        inputBuffer.frameLength = 512
        for frame in 0..<512 {
            samples[frame] = sin(Float(frame) * 2 * .pi * 440 / 48_000) * 0.25
        }
        engine.connect(player, to: engine.mainMixerNode, format: format)
        try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 512)
        player.scheduleBuffer(inputBuffer)
        try engine.start()
        player.play()
        let status = try engine.renderOffline(512, to: outputBuffer)
        let rendered = outputBuffer.floatChannelData?[0]
        let nonSilent = rendered.map { channel in
            (0..<Int(outputBuffer.frameLength)).contains { abs(channel[$0]) > 0.0001 }
        } ?? false
        player.stop()
        engine.stop()
        engine.disableManualRenderingMode()
        return try ProviderSupport.encode([
            "offline_render_success": status == .success,
            "rendered_frames": outputBuffer.frameLength,
            "non_silent_output": nonSilent,
            "sample_rate": Int(format.sampleRate),
            "channels": format.channelCount,
            "microphone_permission_requested": false,
        ])
    }
}
