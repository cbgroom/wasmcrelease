import XCTest

final class WebViewAgentUITests: XCTestCase {
    func testAgentDOMActionOverlapsUserInputOnAnotherWebView() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["web-agent-title"].waitForExistence(timeout: 10))
        let input = app.textFields.matching(identifier: "human note").element(boundBy: 1)
        XCTAssertTrue(input.waitForExistence(timeout: 10))
        app.buttons["web-agent-start"].tap()
        input.tap()
        input.typeText("human-")
        sleep(3)
        input.typeText("owned")
        XCTAssertTrue(app.staticTexts["web-agent-action-complete"].waitForExistence(timeout: 10))
        app.buttons["web-agent-verify"].tap()
        XCTAssertTrue(app.staticTexts["web-agent-qualification-complete"].waitForExistence(timeout: 10))
    }
}
