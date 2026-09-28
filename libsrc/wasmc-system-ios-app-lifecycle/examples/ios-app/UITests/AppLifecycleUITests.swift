import XCTest

final class AppLifecycleUITests: XCTestCase {
    private func runFiniteWindow(milliseconds: Int, foregroundDelaySeconds: UInt32) {
        let app = XCUIApplication()
        app.launchArguments = [
            "--wasmc-reset-lifecycle-journal",
            "--wasmc-finite-window-ms=\(milliseconds)",
        ]
        app.launch()
        XCTAssertTrue(app.staticTexts["lifecycle-title"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        sleep(foregroundDelaySeconds)
        app.activate()
        XCTAssertTrue(app.staticTexts["lifecycle-title"].waitForExistence(timeout: 10))
    }

    func testFifteenSecondFiniteBackgroundWindow() {
        runFiniteWindow(milliseconds: 15_000, foregroundDelaySeconds: 18)
    }

    func testThirtySecondFiniteBackgroundWindow() {
        runFiniteWindow(milliseconds: 30_000, foregroundDelaySeconds: 34)
    }

    func testSixtySecondFiniteBackgroundWindow() {
        runFiniteWindow(milliseconds: 60_000, foregroundDelaySeconds: 65)
    }

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
