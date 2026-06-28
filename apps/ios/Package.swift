// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "HarnessDreamsMobileCore",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "HarnessDreamsMobileCore",
            targets: ["HarnessDreamsMobileCore"]
        )
    ],
    targets: [
        .target(
            name: "HarnessDreamsMobileCore",
            path: "Shared"
        ),
        .testTarget(
            name: "HarnessDreamsMobileCoreTests",
            dependencies: ["HarnessDreamsMobileCore"],
            path: "Tests/HarnessDreamsMobileCoreTests"
        )
    ]
)
