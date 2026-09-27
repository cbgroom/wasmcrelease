import Foundation
import WebKit

private final class WebNavigationProbe: NSObject, WKNavigationDelegate {
    var completed = false
    var error: Error?

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        completed = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        self.error = error
        completed = true
    }
}

enum WebProvider {
    private static func pump(until predicate: () -> Bool, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while !predicate() && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.01))
        }
        return predicate()
    }

    static func invoke(_ input: Data) throws -> Data {
        let webView = WKWebView(frame: .init(x: 0, y: 0, width: 320, height: 200))
        let navigation = WebNavigationProbe()
        webView.navigationDelegate = navigation
        webView.loadHTMLString("<main id='probe'>wasmc-web</main><script>window.answer=6*7</script>", baseURL: nil)
        guard pump(until: { navigation.completed }, timeout: 5), navigation.error == nil else {
            throw NSError(domain: "wasmc.web", code: 1)
        }
        var result: Any?
        var scriptError: Error?
        var evaluated = false
        webView.evaluateJavaScript("JSON.stringify({text:document.querySelector('#probe').textContent,answer:window.answer})") {
            value, error in
            result = value
            scriptError = error
            evaluated = true
        }
        guard pump(until: { evaluated }, timeout: 5), scriptError == nil,
              let json = result as? String,
              let data = json.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "wasmc.web", code: 2)
        }
        return try ProviderSupport.encode([
            "html_loaded": object["text"] as? String == "wasmc-web",
            "javascript_executed": object["answer"] as? Int == 42,
            "network_used": false,
            "ephemeral_probe": true,
        ])
    }
}
