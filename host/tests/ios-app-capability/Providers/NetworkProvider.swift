import Foundation

enum NetworkProvider {
    static func invoke(_ input: Data) throws -> Data {
        var output = [CChar](repeating: 0, count: 4096)
        let status = wasmc_ios_app_loopback_probe(&output, output.count)
        guard status == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(status)) }
        return Data(String(cString: output).utf8)
    }
}
