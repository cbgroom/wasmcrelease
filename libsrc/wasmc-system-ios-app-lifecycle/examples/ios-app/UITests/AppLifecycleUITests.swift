import XCTest

final class AppLifecycleUITests: XCTestCase {
    func testEightSecondFiniteBackgroundWindow() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-reset-lifecycle-journal", "--wasmc-finite-window-probe"]
        app.launch()

        XCTAssertTrue(app.staticTexts["lifecycle-title"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        sleep(11)
        app.activate()
        XCTAssertTrue(app.staticTexts["background-cycle-complete"].waitForExistence(timeout: 10))
    }

    func testBackgroundCycleAndColdRelaunchJournal() {
        let app = XCUIApplication()
        app.launchArguments = ["--wasmc-reset-lifecycle-journal"]
        app.launch()

        XCTAssertTrue(app.staticTexts["lifecycle-title"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        sleep(3)
        app.activate()
        XCTAssertTrue(app.staticTexts["background-cycle-complete"].waitForExistence(timeout: 10))

        app.terminate()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(app.staticTexts["cold-relaunch-complete"].waitForExistence(timeout: 10))
    }
}
