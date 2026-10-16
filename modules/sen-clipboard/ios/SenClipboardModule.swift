import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

public class SenClipboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SenClipboard")

    // iOS has no sensitive flag. Local only keeps it off Universal Clipboard, and the expiry clears it.
    AsyncFunction("setSensitiveStringAsync") { (text: String) in
      UIPasteboard.general.setItems(
        [[UTType.plainText.identifier: text]],
        options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(120)]
      )
    }.runOnQueue(.main)
  }
}
