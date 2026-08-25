# RapidResQ

A Flutter prototype for mobile emergency-assistance workflows.

## Overview

RapidResQ explores how a mobile app can help a user capture context, access location-aware assistance, and reach useful resources quickly. The repository includes Flutter targets for mobile, web, and desktop.

## Current capabilities

The project dependencies support:

- Device location through Geolocator
- Image capture or selection with Image Picker
- HTTP-based service integration
- External links and calling flows through URL Launcher
- Local preferences for lightweight on-device state

## Technology

- Flutter and Dart
- Geolocator
- Image Picker
- HTTP
- URL Launcher
- Shared Preferences

## Getting started

### Prerequisites

- Flutter SDK compatible with Dart 3.10
- A supported device, emulator, or browser
- Platform permissions configured for location and media access

### Run locally

1. Clone the repository.
2. Install dependencies:

   ```bash
   flutter pub get
   ```

3. Launch the app:

   ```bash
   flutter run
   ```

## Project structure

- `lib/` — Flutter application source
- `test/` — automated tests
- `android/` and `ios/` — mobile platform configuration
- `web/`, `windows/`, `macos/`, and `linux/` — additional Flutter targets
- `firestore.rules` and `firebase.json` — Firebase configuration

## Quality checks

```bash
flutter analyze
flutter test
```

## Safety note

RapidResQ is a software project and is not a replacement for official emergency services. In an emergency, contact the appropriate local authority directly.

## Status

This project is in development. Service endpoints, Firebase configuration, and platform permission settings may be required before every workflow is available.
