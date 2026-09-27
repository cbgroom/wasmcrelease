import Foundation
import UIKit

enum UIProvider {
    static func invoke(_ input: Data) throws -> Data {
        guard let controller = UIApplication.shared.delegate?.window??.rootViewController else {
            throw NSError(domain: "wasmc.ui", code: 1)
        }
        let title = UILabel()
        title.text = "WAsmC iOS App Host"
        title.accessibilityIdentifier = "wasmc-title"
        let state = UILabel()
        state.text = "state:ready"
        state.accessibilityIdentifier = "wasmc-state"
        let button = UIButton(type: .system)
        button.setTitle("Advance", for: .normal)
        button.accessibilityIdentifier = "wasmc-advance"
        button.addAction(UIAction { _ in state.text = "state:advanced" }, for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, state, button])
        stack.axis = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        controller.view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: controller.view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: controller.view.centerYAnchor),
        ])
        controller.view.layoutIfNeeded()
        let before = state.text
        button.sendActions(for: .touchUpInside)
        let nodes = [title, state, button].map { view in
            [
                "identifier": view.accessibilityIdentifier ?? "",
                "label": view.accessibilityLabel ?? (view as? UILabel)?.text ?? (view as? UIButton)?.title(for: .normal) ?? "",
                "enabled": view.isUserInteractionEnabled,
                "hidden": view.isHidden,
            ] as [String: Any]
        }
        return try ProviderSupport.encode([
            "foreground": UIApplication.shared.applicationState == .active,
            "semantic_nodes": nodes,
            "semantic_action": "wasmc-advance",
            "state_before": before ?? "",
            "state_after": state.text ?? "",
            "semantic_action_confirmed": state.text == "state:advanced",
        ])
    }
}
