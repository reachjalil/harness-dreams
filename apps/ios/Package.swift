// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "HarnessHealthMobileCore",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "HarnessHealthMobileCore",
            targets: ["HarnessHealthMobileCore"]
        )
    ],
    targets: [
        .target(
            name: "HarnessHealthMobileCore",
            path: "Shared"
        ),
        .testTarget(
            name: "HarnessHealthMobileCoreTests",
            dependencies: ["HarnessHealthMobileCore"],
            path: "Tests/HarnessHealthMobileCoreTests"
        )
    ]
)
