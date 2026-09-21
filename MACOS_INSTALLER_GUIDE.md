# Systemika Studio 1.1 — macOS Installer Build Guide

This guide is for a person who can use ordinary Mac applications but is **not a programmer**. You do not need to understand the Systemika source code. The source package contains an automated builder named `BUILD_MACOS_INSTALLER.command` that performs the technical build steps for you.

These instructions correspond to **Systemika Studio 1.1**. The builder reads the version directly from `package.json`, so the generated installer filenames and macOS application metadata will also be `1.1.0`.

## What this procedure creates

The builder creates:

- `Systemika Studio.app` — the Mac application;
- `Systemika-Studio-1.1.0-macOS-Universal.dmg` — the normal installer disk image to give to students;
- `Systemika-Studio-1.1.0-macOS-Universal.zip` — a compressed copy of the app, useful as a backup distribution format;
- `SHA256SUMS.txt` — checksums that can be used to verify that the distributed files were not changed or corrupted.

The application is **Universal**: the same build supports both modern Apple Silicon Macs (M1/M2/M3/M4 and later) and older Intel Macs.

The finished application does **not** require Node.js, Go, Xcode, or programming tools on students' Macs. Those tools are needed only on the one Mac used to create the installer.

## Important browser requirement for students

The macOS launcher starts Systemika Studio locally and opens it in an application-style browser window. For full project-folder and saved-run functionality, students should have **Google Chrome, Microsoft Edge, or Chromium** installed.

If none of those browsers is installed, the launcher can fall back to the Mac's default browser for a newly started session. Safari can run the application, but Systemika's project-folder and persistent run-management features are more limited there. For student distribution, installing Chrome, Edge, or Chromium is therefore recommended.

## Part 1 — Prepare the build Mac

You need:

1. A Mac running macOS 11 or newer.
2. An internet connection while installing the build tools.
3. The complete **Systemika Studio 1.1 source package**, extracted to a folder such as `Systemika-Studio-1.1.0-Source`.
4. Apple Command Line Tools.
5. The Go programming language.

You do **not** need the full Xcode application unless you want it for other reasons.

### Step 1: Put the Systemika source folder somewhere simple

Download or copy the Systemika Studio source ZIP to the Mac. Double-click the ZIP to extract it.

Move the extracted folder somewhere easy to find, for example:

`Downloads/Systemika-Studio-1.1.0-Source`

Do not try to run the builder while the source is still inside the ZIP file.

### Step 2: Install Apple Command Line Tools

Open **Terminal**. You can find it with Spotlight by pressing `Command + Space`, typing `Terminal`, and pressing Return.

In Terminal, type:

```sh
xcode-select --install
```

Press Return.

macOS should display an Apple installation window. Choose **Install** and wait until it finishes.

If macOS says the command line tools are already installed, that is fine; continue to the next step.

### Step 3: Install Go

Open the official Go download page in a browser:

https://go.dev/dl/

Download the current stable **macOS installer package (`.pkg`)** appropriate for the build Mac:

- Apple Silicon Mac: choose the **ARM64** macOS package.
- Intel Mac: choose the **x86-64 / AMD64** macOS package.

Double-click the downloaded `.pkg` file and follow the normal installer steps.

When installation finishes, close Terminal and open a new Terminal window. Type:

```sh
go version
```

Press Return. You should see a line beginning with `go version`.

If you see `command not found`, restart the Mac once and try `go version` again.

## Part 2 — Build the installer

### Step 4: Find the build file

Open the extracted Systemika Studio source folder in Finder.

Find:

`BUILD_MACOS_INSTALLER.command`

### Step 5: Run the builder

Double-click `BUILD_MACOS_INSTALLER.command`.

A Terminal window will open. The builder will automatically:

1. check that it is running on macOS;
2. check Apple Command Line Tools;
3. check Go;
4. compile an Intel Mac launcher;
5. compile an Apple Silicon launcher;
6. combine them into one Universal Mac application;
7. copy the Systemika Studio application files into the `.app` bundle;
8. apply a local ad-hoc signature unless you supplied an Apple Developer ID certificate;
9. create a ZIP archive;
10. create the DMG installer image;
11. verify the application and DMG;
12. generate SHA-256 checksums.

The first build can take a little longer because Go performs its first compilation setup. No source-code editing is required.

If macOS refuses to open the `.command` file because it came from the internet, use this method:

1. Control-click or right-click `BUILD_MACOS_INSTALLER.command`.
2. Choose **Open**.
3. Confirm **Open** in the security dialog.

### Step 6: Locate the finished files

After a successful build, open this folder inside the Systemika source folder:

`release/macos/`

You should see:

```text
Systemika Studio.app
Systemika-Studio-1.1.0-macOS-Universal.dmg
Systemika-Studio-1.1.0-macOS-Universal.zip
SHA256SUMS.txt
```

The `.dmg` file is the normal file to distribute to students and public Mac users. If the Terminal window reports **“Systemika Studio macOS build finished successfully.”**, the automated build completed without an error.

## Part 3 — Test the DMG before distributing it

Do not distribute a newly built installer without testing it at least once.

### Step 7: Install from the DMG exactly as a student would

1. Double-click `Systemika-Studio-1.1.0-macOS-Universal.dmg`.
2. A Finder window opens showing **Systemika Studio.app** and an **Applications** shortcut.
3. Drag **Systemika Studio.app** onto **Applications**.
4. Eject the Systemika Studio disk image.
5. Open the **Applications** folder.
6. Launch **Systemika Studio**.

For the unsigned/ad-hoc build, macOS Gatekeeper may prevent an ordinary double-click the first time. In that case:

1. Control-click or right-click **Systemika Studio** in Applications.
2. Choose **Open**.
3. Choose **Open** again in the security dialog.

This exception normally needs to be approved only once for that copy of the application.

### Step 8: Perform a short functional test

Before distribution, verify at least these actions:

- Systemika Studio opens.
- A new model can be created.
- A Stock and Flow can be placed.
- A model can be saved as an `.ssd` file.
- The model can be simulated.
- A Time Plot can be created.
- A Histogram can be created for one run.
- A second run can be created and compared.
- The application closes normally.

For full saved-run testing, use Chrome, Edge, or Chromium.

## Part 4 — Unsigned versus signed/notarized distribution

### The simple classroom build

If you simply double-click `BUILD_MACOS_INSTALLER.command`, the builder creates an **ad-hoc signed** application. This is sufficient for local testing and can be used in a controlled classroom if students are given the right-click **Open** instructions above.

However, macOS may display security warnings because the app has not been signed with an Apple Developer ID and notarized by Apple.

### Recommended for broad public distribution

For public distribution, the best user experience is to **Developer ID sign and notarize** the application. This normally requires a paid Apple Developer Program membership.

If you do not have an Apple Developer account, you can still build the DMG. The difference is only the Gatekeeper experience for the end user.

## Part 5 — Optional: Developer ID signing and notarization

This section is only needed if the person building Systemika has access to an Apple Developer Program account.

### Step 9: Install a Developer ID Application certificate

The Apple Developer account holder should create/install a **Developer ID Application** certificate in the Mac's Keychain. Xcode or Apple's Developer website can be used to manage certificates.

To see available signing identities, run:

```sh
security find-identity -v -p codesigning
```

Look for a line similar to:

```text
Developer ID Application: Your Name or Organization (TEAMID)
```

Copy that identity exactly.

### Step 10: Save notarization credentials once

Apple's current command-line notarization tool is `notarytool`. Store credentials in the Keychain once with:

```sh
xcrun notarytool store-credentials "SystemikaNotary" \
  --apple-id "YOUR-APPLE-ID" \
  --team-id "YOUR-TEAM-ID" \
  --password "YOUR-APP-SPECIFIC-PASSWORD"
```

Use an Apple app-specific password, not the normal Apple account password.

### Step 11: Build, sign, and notarize in one command

Open Terminal in the Systemika source folder and run:

```sh
SYSTEMIKA_SIGN_IDENTITY="Developer ID Application: Your Name or Organization (TEAMID)" \
SYSTEMIKA_NOTARY_PROFILE="SystemikaNotary" \
./BUILD_MACOS_INSTALLER.command
```

Replace the signing identity with the exact identity shown on the build Mac.

With both variables supplied, the builder will:

- sign the `.app` with the Developer ID certificate;
- enable Apple's hardened runtime;
- sign the DMG;
- submit the DMG to Apple for notarization;
- wait for Apple's result;
- staple the notarization ticket to the DMG;
- validate the stapled ticket.

If notarization succeeds, the resulting DMG is the preferred file for public distribution.

## Part 6 — Verify that the application is Universal

The builder verifies this automatically, but you can check manually.

In Terminal, from the Systemika source folder, run:

```sh
lipo -archs "release/macos/Systemika Studio.app/Contents/MacOS/Systemika Studio"
```

The result should contain both:

```text
x86_64 arm64
```

The order does not matter.

## Part 7 — What to send to students

For normal Mac installation, send students only:

`Systemika-Studio-1.1.0-macOS-Universal.dmg`

They do **not** need the source folder, Go, Xcode, Node.js, or npm.

If the DMG is not Developer ID signed/notarized, also give students the first-launch instruction:

> After copying Systemika Studio to Applications, Control-click Systemika Studio, choose Open, then confirm Open.

Also recommend Chrome, Edge, or Chromium for full Systemika project/run functionality.

The `.zip` file is an optional backup distribution format. `SHA256SUMS.txt` can be published alongside the download so users can verify integrity.

## Part 8 — Troubleshooting

### The builder says: `This builder must be run on macOS`

A macOS `.app` and `.dmg` should be finalized on a Mac. Copy the complete source folder to a Mac and run the builder there.

### `xcode-select: error` or command line tools are missing

Run:

```sh
xcode-select --install
```

Complete the Apple installer, then run the Systemika builder again.

### `Go is not installed` or `go: command not found`

Install Go from https://go.dev/dl/, close and reopen Terminal, then check:

```sh
go version
```

### Double-clicking the `.command` file does nothing or macOS blocks it

Control-click the file, choose **Open**, then confirm **Open**.

If necessary, open Terminal, drag the `.command` file from Finder into the Terminal window, and press Return.

### The build stops during `lipo`, `codesign`, or `hdiutil`

Those commands are supplied by macOS/Apple developer tools. Run:

```sh
xcode-select -p
```

If it reports an error, install/reinstall Apple Command Line Tools with `xcode-select --install`.

### The finished app opens Safari instead of an application-style window

Install Google Chrome, Microsoft Edge, or Chromium. The Systemika launcher looks for those browsers and uses their application-window mode when available.

### A student sees a message that Apple cannot verify the developer

For an unsigned/ad-hoc classroom build, Control-click the app in Applications and choose **Open**. For broad public distribution without that extra step, use Developer ID signing and Apple notarization as described above.

### Notarization fails

Read the error printed by `notarytool`. Common causes are an incorrect Team ID, an app-specific password that has expired, or a Developer ID certificate that is not valid on the build Mac.

You can list stored signing identities with:

```sh
security find-identity -v -p codesigning
```

## Build result summary

For a lay user, the entire normal process is:

1. Extract the Systemika source ZIP on a Mac.
2. Install Apple Command Line Tools once.
3. Install Go once.
4. Double-click `BUILD_MACOS_INSTALLER.command`.
5. Take the finished DMG from `release/macos/`.
6. Test it on a Mac.
7. Distribute the DMG to students.

No programming or source-code modification is required.

## Building on GitHub without owning a Mac

The source package includes `.github/workflows/build-macos.yml`. This allows GitHub Actions to run the existing `BUILD_MACOS_INSTALLER.command` on a hosted Mac, so the macOS installer can be produced from Windows or Linux without changing the source package for each release.

For a new release:

1. Update the Systemika source and the version in `package.json` as usual.
2. Commit and push the source to GitHub.
3. Open the repository on GitHub and select **Actions**.
4. Select **Build macOS Installer**.
5. Select **Run workflow**.
6. When the workflow finishes, download the **Systemika-Studio-macOS** artifact.

The artifact contains the Universal macOS DMG, the Universal ZIP, and `SHA256SUMS.txt`. The existing builder reads the version from `package.json`, so the installer filename updates automatically when the package version changes.

The default GitHub build uses the builder's ad-hoc signing mode. Apple Developer ID signing and notarization require the corresponding Apple credentials to be configured separately as GitHub secrets and are not enabled by this default workflow.
