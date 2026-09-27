import CryptoKit
import Foundation
import UIKit

enum DisplayProvider {
    static func invoke(_ input: Data) throws -> Data {
        guard let window = UIApplication.shared.delegate?.window ?? nil else {
            throw NSError(domain: "wasmc.display", code: 1)
        }
        let format = UIGraphicsImageRendererFormat()
        format.scale = UIScreen.main.scale
        let renderer = UIGraphicsImageRenderer(bounds: window.bounds, format: format)
        let image = renderer.image { context in window.layer.render(in: context.cgContext) }
        guard let png = image.pngData() else { throw NSError(domain: "wasmc.display", code: 2) }
        let digest = SHA256.hash(data: png).map { String(format: "%02x", $0) }.joined()
        return try ProviderSupport.encode([
            "window_capture": true,
            "width_points": Int(window.bounds.width),
            "height_points": Int(window.bounds.height),
            "scale": UIScreen.main.scale,
            "png_bytes": png.count,
            "png_sha256": digest,
        ])
    }
}
