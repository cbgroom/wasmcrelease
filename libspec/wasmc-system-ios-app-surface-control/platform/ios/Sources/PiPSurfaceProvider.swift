import AVFoundation
import AVKit
import CoreMedia
import CoreVideo
import UIKit

final class PiPStatusView: UIView {
    override class var layerClass: AnyClass { AVSampleBufferDisplayLayer.self }

    var displayLayer: AVSampleBufferDisplayLayer {
        layer as! AVSampleBufferDisplayLayer
    }
}

final class PiPSurfaceProvider: NSObject,
    AVPictureInPictureControllerDelegate,
    AVPictureInPictureSampleBufferPlaybackDelegate
{
    let sourceView = PiPStatusView()
    private(set) var isSupported = AVPictureInPictureController.isPictureInPictureSupported()
    private(set) var wasPossible = false
    private(set) var userInitiated = false
    private(set) var didStart = false
    private(set) var didStop = false
    private(set) var restoreRequested = false
    private(set) var framesEnqueued = 0
    private(set) var lastError: String?

    var onStateChange: (() -> Void)?
    var onRestoreRequested: (() -> Void)?

    private var controller: AVPictureInPictureController?
    private var possibleObservation: NSKeyValueObservation?
    private var frameTimer: Timer?
    private var counter = 0

    override init() {
        super.init()
        sourceView.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.13, alpha: 1)
        sourceView.layer.cornerRadius = 16
        sourceView.layer.masksToBounds = true
        sourceView.accessibilityIdentifier = "surface-pip-preview"
        sourceView.displayLayer.videoGravity = .resizeAspect

        guard isSupported else { return }
        let source = AVPictureInPictureController.ContentSource(
            sampleBufferDisplayLayer: sourceView.displayLayer,
            playbackDelegate: self
        )
        let controller = AVPictureInPictureController(contentSource: source)
        controller.delegate = self
        controller.canStartPictureInPictureAutomaticallyFromInline = false
        controller.requiresLinearPlayback = true
        self.controller = controller
        possibleObservation = controller.observe(\.isPictureInPicturePossible, options: [.initial, .new]) {
            [weak self] controller, _ in
            self?.wasPossible = self?.wasPossible == true || controller.isPictureInPicturePossible
            self?.onStateChange?()
        }
        configureAudioSession()
        renderFrame()
        frameTimer = Timer.scheduledTimer(withTimeInterval: 0.10, repeats: true) { [weak self] _ in
            self?.renderFrame()
        }
    }

    var isActive: Bool { controller?.isPictureInPictureActive == true }
    var isPossible: Bool { controller?.isPictureInPicturePossible == true }

    func startFromUserAction() {
        userInitiated = true
        guard let controller, controller.isPictureInPicturePossible else {
            lastError = "picture-in-picture-not-possible"
            onStateChange?()
            return
        }
        controller.startPictureInPicture()
    }

    func stopFromUserAction() {
        controller?.stopPictureInPicture()
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            lastError = "audio-session: \(error.localizedDescription)"
        }
    }

    private func renderFrame() {
        guard isSupported else { return }
        counter += 1
        let width = 640
        let height = 360
        let attributes: [CFString: Any] = [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
            kCVPixelBufferIOSurfacePropertiesKey: [:],
        ]
        var pixelBuffer: CVPixelBuffer?
        guard CVPixelBufferCreate(
            kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
            attributes as CFDictionary, &pixelBuffer
        ) == kCVReturnSuccess, let pixelBuffer else { return }

        CVPixelBufferLockBaseAddress(pixelBuffer, [])
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
        guard let base = CVPixelBufferGetBaseAddress(pixelBuffer),
              let context = CGContext(
                data: base,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue |
                    CGBitmapInfo.byteOrder32Little.rawValue
              ) else { return }

        context.setFillColor(UIColor(red: 0.035, green: 0.05, blue: 0.12, alpha: 1).cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        context.setFillColor(UIColor(red: 0.32, green: 0.38, blue: 0.96, alpha: 1).cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: 18))

        UIGraphicsPushContext(context)
        defer { UIGraphicsPopContext() }
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .left
        ("AGENT · TASK 3" as NSString).draw(
            in: CGRect(x: 42, y: 62, width: 560, height: 48),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 34, weight: .bold),
                .foregroundColor: UIColor.white,
                .paragraphStyle: paragraph,
            ]
        )
        ("等待人工确认 · 后台任务继续" as NSString).draw(
            in: CGRect(x: 42, y: 122, width: 560, height: 38),
            withAttributes: [
                .font: UIFont.systemFont(ofSize: 23, weight: .medium),
                .foregroundColor: UIColor.white.withAlphaComponent(0.72),
            ]
        )
        context.setFillColor(UIColor.white.withAlphaComponent(0.15).cgColor)
        context.fill(CGRect(x: 42, y: 220, width: 556, height: 18))
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(x: 42, y: 220, width: CGFloat((counter * 13) % 556), height: 18))
        (String(format: "FRAME %05d", counter) as NSString).draw(
            in: CGRect(x: 42, y: 264, width: 556, height: 38),
            withAttributes: [
                .font: UIFont.monospacedDigitSystemFont(ofSize: 24, weight: .semibold),
                .foregroundColor: UIColor.white,
            ]
        )

        var formatDescription: CMVideoFormatDescription?
        guard CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescriptionOut: &formatDescription
        ) == noErr, let formatDescription else { return }
        var timing = CMSampleTimingInfo(
            duration: .invalid,
            presentationTimeStamp: .invalid,
            decodeTimeStamp: .invalid
        )
        var sampleBuffer: CMSampleBuffer?
        guard CMSampleBufferCreateReadyWithImageBuffer(
            allocator: kCFAllocatorDefault,
            imageBuffer: pixelBuffer,
            formatDescription: formatDescription,
            sampleTiming: &timing,
            sampleBufferOut: &sampleBuffer
        ) == noErr, let sampleBuffer else { return }
        if let attachments = CMSampleBufferGetSampleAttachmentsArray(
            sampleBuffer,
            createIfNecessary: true
        ), CFArrayGetCount(attachments) > 0 {
            let dictionary = unsafeBitCast(
                CFArrayGetValueAtIndex(attachments, 0),
                to: CFMutableDictionary.self
            )
            CFDictionarySetValue(
                dictionary,
                Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
                Unmanaged.passUnretained(kCFBooleanTrue).toOpaque()
            )
        }
        let renderer = sourceView.displayLayer.sampleBufferRenderer
        if renderer.status == .failed {
            renderer.flush()
        }
        renderer.enqueue(sampleBuffer)
        framesEnqueued += 1
    }

    func pictureInPictureControllerDidStartPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        didStart = true
        onStateChange?()
    }

    func pictureInPictureControllerDidStopPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        didStop = true
        onStateChange?()
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        failedToStartPictureInPictureWithError error: Error
    ) {
        lastError = error.localizedDescription
        onStateChange?()
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
    ) {
        restoreRequested = true
        onRestoreRequested?()
        completionHandler(true)
    }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        setPlaying playing: Bool
    ) {}

    func pictureInPictureControllerTimeRangeForPlayback(
        _ pictureInPictureController: AVPictureInPictureController
    ) -> CMTimeRange {
        CMTimeRange(start: .zero, duration: .positiveInfinity)
    }

    func pictureInPictureControllerIsPlaybackPaused(
        _ pictureInPictureController: AVPictureInPictureController
    ) -> Bool { false }

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        didTransitionToRenderSize newRenderSize: CMVideoDimensions
    ) {}

    func pictureInPictureController(
        _ pictureInPictureController: AVPictureInPictureController,
        skipByInterval skipInterval: CMTime,
        completion: @escaping () -> Void
    ) { completion() }

    deinit {
        frameTimer?.invalidate()
        possibleObservation?.invalidate()
    }
}
