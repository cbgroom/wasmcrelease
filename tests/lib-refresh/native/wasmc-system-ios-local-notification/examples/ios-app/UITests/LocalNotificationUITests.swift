import XCTest

final class LocalNotificationUITests: XCTestCase {
    private func tapFirstExistingButton(in application: XCUIApplication, labels: [String]) -> Bool {
        for label in labels {
            let button = application.buttons[label]
            if button.exists {
                button.tap()
                return true
            }
        }
        return false
    }

    func testSystemDeliversExactPayloadWhileAppIsAwayFromForeground() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["local-notification-title"].waitForExistence(timeout: 10))
        app.buttons["local-notification-schedule"].tap()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alert = springboard.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "Notification authorization alert did not appear")
        XCTAssertTrue(tapFirstExistingButton(
            in: springboard,
            labels: ["Allow", "允许", "Разрешить"]
        ), "Notification alert had no recognized allow button: \(alert.debugDescription)")

        XCTAssertTrue(app.staticTexts["local-notification-scheduled"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        let deliveredTitle = springboard.staticTexts["WAsmC local notification"]
        XCTAssertTrue(deliveredTitle.waitForExistence(timeout: 10), "System notification banner did not appear")
        XCTAssertTrue(springboard.staticTexts["Simulator background delivery fixture"].exists,
          "System notification banner body did not match")
        deliveredTitle.tap()
        XCTAssertTrue(app.staticTexts["local-notification-complete"].waitForExistence(timeout: 10))
    }
}
