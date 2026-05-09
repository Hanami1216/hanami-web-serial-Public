# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A pure static web application for controlling professional audio hardware (EQ equalizer, PA power, volume) via Web Serial API and Web Bluetooth API. No build tools, no package manager, no server-side code. All pages are self-contained HTML with inline CSS and JS.

## Development

- **No build step** — these are static HTML/CSS/JS files. Open any `.html` file in Chrome/Edge to test locally.
- **No tests** — there is no test framework.
- **Browser requirement**: Chrome 89+ or Edge 89+ (Web Serial API / Web Bluetooth API). HTTPS is required for the Serial/Bluetooth APIs.
- **Deployment**: Vercel static hosting (see `vercel.json`).

## File architecture

| File | Purpose |
|---|---|
| `index.html` | Landing page, browser compatibility check, links to the serial control app |
| `串口控制.html` | Main serial EQ control UI: serial connection, 10-band EQ sliders, PA/volume controls, real-time data read |
| `蓝牙控制.html` | Standalone Bluetooth (BLE) test/debug page: scan, connect, GATT service/characteristic exploration |
| `app.js` | Shared JS loaded by `串口控制.html`: serial comms, binary protocol framing/CRC, EQ mapping, all UI logic |

## `app.js` architecture (~1134 lines, vanilla JS)

**Parameter layer** (`ParamRange`, `EQMapping`): Value ranges and display-to-wire mapping (dB values 0–24 on the wire for display range -12 to +12).

**Serial comms layer** (`port`, `reader`, `receiveBuffer`): Web Serial API wrapper. `readData()` runs a read loop accumulating bytes into `receiveBuffer`. `sendFrame()` writes with configurable retries.

**Protocol layer** (`buildFrame`, `parseReceivedFrame`, `calculateCRC`, `processBuffer`):
- Custom binary protocol: `[frame header 1B] [data length 1B] [command 1B] [params nB] [CRC 1B]`
- Frame header is `0xAA`. Command types are defined in the `CMD` enum.
- CRC is a simple sum of bytes modulo 256.
- EQ values span 10 bands, each 1 byte (0–24), packed sequentially in params.

**UI layer** (`initializeApp`, `initEqBands`, `setupSliderPair`, `updateUIWithReceivedData`): DOM caching, slider-input sync, EQ preset application, button event wiring.

## Key conventions

- Comments and some functions were AI-generated (noted at the top of files).
- Chinese UI strings throughout (target audience is Chinese-speaking audio professionals).
- EQ frequency bands: 31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz.
- The `CMD` enum and frame header `0xAA` must match the firmware protocol on the audio hardware side.
