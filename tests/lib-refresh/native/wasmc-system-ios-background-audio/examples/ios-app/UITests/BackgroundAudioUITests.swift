import XCTest

final class BackgroundAudioUITests: XCTestCase {
    func testPlaybackClockProgressesWhileAppIsBackgrounded() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["background-audio-title"].waitForExistence(timeout: 10))
        app.buttons["background-audio-start"].tap()
        sleep(1)
        XCUIDevice.shared.press(.home)
        sleep(4)
        app.activate()
        XCTAssertTrue(app.staticTexts["background-audio-complete"].waitForExistence(timeout: 10))
    }
}
