# Copilot Instructions — BAS Simulation Fleet

## Project Overview

This is a **single-file, zero-dependency** Building Automation System (BAS) simulator. The entire application lives in `index.html` — HTML structure, CSS styles, and JavaScript logic are all inline.

## Architecture

The JavaScript is split into three namespace objects that simulate a multi-agent system:

| Object | Role |
|---|---|
| `BAS_Environment` | Time simulation engine + ambient background lighting |
| `BAS_UI` | Room grid renderer + mini-state ribbon at bottom |
| `BAS_API` | Schedule management, manual bookings, and the **core reconciliation loop** |

**Global state** (`STATE`) is the single source of truth, shared across all three objects:
```js
STATE = {
  simSeconds,   // Raw simulation clock in seconds
  currentFloor, // 1–3
  rooms,        // { "101": 0|1, "102": 0|1, ... } — off/on
  schedules     // Array of { day, start, end, room }
}
```

## Key Conventions

### Room ID Format
Rooms are keyed as `"{floor}0{roomNum}"` — always a 3-character string. Floor 2, Room 4 → `"204"`. The grid has 3 floors × 6 rooms each.

### Simulation Time
- **Day (00:00–18:00):** 1 real second = 5 sim minutes (100ms tick → +30 sim-seconds)
- **Night (18:00–00:00):** 1 real second = 30 sim minutes (100ms tick → +180 sim-seconds)
- `BAS_Environment.tick()` checks the hour *before* advancing to determine tick size
- Adjust `STATE.simSeconds` directly (or via `BAS_API.adjustTime(secs)`) to jump to a specific time

### Core Execution Loop
`BAS_API.coreExecutionLoop()` runs every tick. Order of operations:
1. Advance `BAS_Environment.updateNature()` (time + background)
2. **Reset all rooms to 0 (off)**
3. Re-evaluate `STATE.schedules` against current time — flip matching rooms to 1 (on)
4. Re-render UI via `BAS_UI.renderGrid()`

Any feature that changes room state should feed through `STATE.schedules`, not patch `STATE.rooms` directly — the loop resets rooms each tick.

### Schedule Object Shape
```js
{ day: "MON", start: 8, end: 10, room: "101" }
```
`day` is one of `["SUN","MON","TUE","WED","THU","FRI","SAT"]`. Hours are integers (0–23). A room is lit when `current.hour >= start && current.hour < end`.

### Ambient Background
`BAS_Environment.updateBackground(fracHour)` linearly interpolates between dark-tone RGB keyframes in the `SKY` array (defined at the top of `app.js`) every tick — no CSS transitions involved. To adjust colors, edit the `SKY` keyframe array. The gradient uses `fracHour` (e.g. `7.5` for 07:30) so transitions are perfectly continuous.

Dark-tone palette: sunrise `#523100`, day dark-blue `rgb(5,20,50)`, sunset `#521300`, night `#090a0f`.

## Running the App

Open `index.html` directly in a browser — no build step, no server required.
