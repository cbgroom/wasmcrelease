import XCTest

final class AuthorizationFlowUITests: XCTestCase {
    private func tapFirstExistingButton(
        in application: XCUIApplication,
        labels: [String]
    ) -> Bool {
        for label in labels {
            let button = application.buttons[label]
            if button.exists {
                button.tap()
                return true
            }
        }
        return false
    }

    func testAllowContactsThenUseCapability() {
        let app = XCUIApplication()
        app.launchArguments = ["--request-contacts"]
        app.launch()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alert = springboard.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "Contacts authorization alert did not appear")

        let continueLabels = ["Continue", "继续"]
        guard tapFirstExistingButton(in: springboard, labels: continueLabels) else {
            XCTFail("Contacts authorization alert had no recognized allow button: \(alert.debugDescription)")
            return
        }

        let shareAll = springboard.buttons.matching(NSPredicate(
          format: "label BEGINSWITH %@ OR label BEGINSWITH %@",
          "Share All", "共享所有"
        )).firstMatch
        if shareAll.waitForExistence(timeout: 10) {
            shareAll.tap()
        } else if !tapFirstExistingButton(
            in: springboard,
            labels: ["Allow Full Access", "Allow", "允许完全访问", "允许"]
        ) {
            XCTFail("Contacts authorization second stage had no full-access button: \(springboard.debugDescription)")
            return
        }

        sleep(3)
    }

    func testDenyContactsThenFailClosed() {
        let app = XCUIApplication()
        app.launchArguments = ["--request-contacts"]
        app.launch()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let alert = springboard.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "Contacts authorization alert did not appear")

        let denyLabels = ["Don’t Allow", "Don't Allow", "Not Now", "不允许", "暂不"]
        guard tapFirstExistingButton(in: springboard, labels: denyLabels) else {
            XCTFail("Contacts authorization alert had no recognized deny button: \(alert.debugDescription)")
            return
        }

        XCTAssertTrue(app.staticTexts["wasmc-title"].waitForExistence(timeout: 10),
          "qualification UI did not appear after denial callback")
        sleep(3)
    }
}
