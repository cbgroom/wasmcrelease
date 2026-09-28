# iOS real WKWebView Agent example

This package-owned example renders two real `WKWebView` surfaces. A user edits
the second surface while the Agent invokes a stable DOM element on the first
through `evaluateJavaScript`. The retained report proves semantic snapshots,
stable element IDs, exact per-surface postconditions and that the Agent action
does not enter the physical UIKit input stream.
