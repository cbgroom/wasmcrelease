import Foundation
import WebKit

final class WebViewSurfaceProvider {
    private struct Entry {
        let webView: WKWebView
        var generation: UInt64
    }

    private var entries: [String: Entry] = [:]
    private(set) var agentUsesPhysicalInput = false

    func register(surfaceID: String, webView: WKWebView) {
        precondition(entries[surfaceID] == nil)
        entries[surfaceID] = Entry(webView: webView, generation: 0)
    }

    func semanticSnapshot(
        surfaceID: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard let entry = entries[surfaceID] else {
            completion(.failure(NSError(domain: "wasmc.web-surface", code: 1)))
            return
        }
        let script = """
        (() => JSON.stringify({
          title: document.title,
          focused: document.activeElement?.dataset?.agentId || '',
          input_first_at: window.inputFirstAt || 0,
          input_last_at: window.inputLastAt || 0,
          nodes: Array.from(document.querySelectorAll('[data-agent-id]')).map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              id: node.dataset.agentId,
              role: node.tagName.toLowerCase(),
              text: node.value ?? node.textContent ?? '',
              disabled: !!node.disabled,
              rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}
            };
          })
        }))()
        """
        entry.webView.evaluateJavaScript(script) { result, error in
            if let error { completion(.failure(error)); return }
            guard let text = result as? String,
                  let data = text.data(using: .utf8),
                  var snapshot = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(.failure(NSError(domain: "wasmc.web-surface", code: 2)))
                return
            }
            snapshot["surface_id"] = surfaceID
            snapshot["generation"] = entry.generation
            completion(.success(snapshot))
        }
    }

    func virtualActivate(
        surfaceID: String,
        expectedGeneration: UInt64,
        elementID: String,
        completion: @escaping (Result<[String: Any], Error>) -> Void
    ) {
        guard var entry = entries[surfaceID] else {
            completion(.failure(NSError(domain: "wasmc.web-surface", code: 3)))
            return
        }
        guard entry.generation == expectedGeneration else {
            completion(.failure(NSError(domain: "wasmc.web-surface", code: 5)))
            return
        }
        guard let encodedData = try? JSONEncoder().encode(elementID),
              let encoded = String(data: encodedData, encoding: .utf8) else {
            completion(.failure(NSError(domain: "wasmc.web-surface", code: 6)))
            return
        }
        let script = """
        (() => {
          const elementID = \(encoded);
          const node = Array.from(document.querySelectorAll('[data-agent-id]'))
            .find((candidate) => candidate.dataset.agentId === elementID);
          if (!node) return JSON.stringify({accepted: false, value: ''});
          node.click();
          return JSON.stringify({
            accepted: true,
            value: document.querySelector('[data-agent-id=count]')?.textContent ?? ''
          });
        })()
        """
        entry.webView.evaluateJavaScript(script) { [weak self] result, error in
            if let error { completion(.failure(error)); return }
            guard let text = result as? String,
                  let data = text.data(using: .utf8),
                  var receipt = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(.failure(NSError(domain: "wasmc.web-surface", code: 4)))
                return
            }
            if receipt["accepted"] as? Bool == true {
                entry.generation += 1
                self?.entries[surfaceID] = entry
            }
            receipt["surface_id"] = surfaceID
            receipt["element_id"] = elementID
            receipt["generation"] = entry.generation
            receipt["physical_input_injection"] = false
            completion(.success(receipt))
        }
    }

    static func descriptorProbe(_ input: Data) throws -> Data {
        precondition(input.isEmpty)
        return try JSONSerialization.data(withJSONObject: [
            "api": "wasmc:system-app-surface-control@0.0.3",
            "provider": "wasmc:system-ios-app-surface-control@0.0.3-dev.1",
            "real_wkwebview_surfaces": true,
            "semantic_dom_snapshot": true,
            "virtual_dom_action": true,
            "physical_input_injection": false,
        ], options: [.sortedKeys])
    }
}
