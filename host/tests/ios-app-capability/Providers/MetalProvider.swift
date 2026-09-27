import Foundation
import Metal

enum MetalProvider {
    static func invoke(_ input: Data) throws -> Data {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else {
            return try ProviderSupport.encode(["metal_available": false])
        }
        let sourceBytes = Array(0..<64).map(UInt32.init)
        guard let source = device.makeBuffer(bytes: sourceBytes, length: sourceBytes.count * 4),
              let destination = device.makeBuffer(length: sourceBytes.count * 4),
              let command = queue.makeCommandBuffer(),
              let blit = command.makeBlitCommandEncoder() else {
            throw NSError(domain: "wasmc.metal", code: 1)
        }
        blit.copy(from: source, sourceOffset: 0, to: destination, destinationOffset: 0, size: source.length)
        blit.endEncoding()
        command.commit()
        command.waitUntilCompleted()
        let observed = destination.contents().bindMemory(to: UInt32.self, capacity: sourceBytes.count)
        let matches = sourceBytes.indices.allSatisfy { observed[$0] == sourceBytes[$0] }
        return try ProviderSupport.encode([
            "metal_available": true,
            "device": device.name,
            "command_completed": command.status == .completed,
            "gpu_copy_roundtrip": matches,
            "bytes": source.length,
        ])
    }
}
