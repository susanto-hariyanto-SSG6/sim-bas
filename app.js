// ============================================================================
// GLOBAL STATE — Single Source of Truth
// ============================================================================
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const STATE = {
    simSeconds:    100800, // MON 04:00  (1 day × 24h + 4h = 28h × 3600s)
    currentFloor:  1,
    bufferEnabled: false,  // +10 min pre/post buffer on schedules
    rooms:         {},     // actual confirmed state  { "101": 0|1, ... }
    desired:       {},     // what schedules currently want
    schedules:     []      // { day, start, end, room }
};

// Initialize 3 floors × 6 rooms
for (let f = 1; f <= 3; f++) {
    for (let r = 1; r <= 6; r++) {
        STATE.rooms[`${f}0${r}`]   = 0;
        STATE.desired[`${f}0${r}`] = 0;
    }
}

// ============================================================================
// AGENT 1 — Time & Ambient Background
//
// Speed tiers (per 100ms tick → sim-seconds added):
//   Slow mode (⏳ active) : +30   → 1 real sec = 5 sim min   (original pace)
//   Working hours 07:30–17:30  : +60   → 1 real sec = 10 sim min  (2× default)
//   Off-hours 00:00–07:30 & 17:30–00:00 : +600  → 1 real sec = 100 sim min (10× working)
//
// Slow mode: pressing ⏳ adds 30 real seconds of slow time; each press stacks.
// Background: linearly interpolated across dark-tone keyframes every tick.
// ============================================================================

// Dark-tone sky gradient keyframes  [hour, topRGB, botRGB]
const SKY = [
    { h:  0, top: [9,  10, 15],  bot: [5,  5,  10]  },  // deep night
    { h:  5, top: [30, 15,  0],  bot: [15,  7,  0]  },  // pre-dawn
    { h:  7, top: [82, 49,  0],  bot: [50, 25,  0]  },  // sunrise  #523100
    { h:  9, top: [ 5, 20, 50],  bot: [ 3, 12, 30]  },  // morning  dark blue
    { h: 14, top: [ 5, 20, 50],  bot: [ 3, 12, 30]  },  // midday   dark blue
    { h: 17, top: [60, 30,  0],  bot: [40, 15,  0]  },  // pre-sunset
    { h: 18, top: [82, 19,  0],  bot: [50, 10,  0]  },  // sunset   #521300
    { h: 20, top: [30,  8,  0],  bot: [15,  4,  0]  },  // dusk
    { h: 22, top: [9,  10, 15],  bot: [ 5,  5, 10]  },  // night
    { h: 24, top: [9,  10, 15],  bot: [ 5,  5, 10]  },  // night (wrap)
];

const BAS_Environment = {
    tickRateMs:    100,
    slowModeMs:    0,      // remaining real-time ms of slow mode
    freezeMs:      5000,   // time frozen for first 5 real seconds on load
    _holdTimer:    null,   // interval while ⏳ button is held

    // Called on mousedown — sets slow duration to 30s and counts down to 5s while held
    startHold: function () {
        this.slowModeMs = 30000;
        this._updateSlowBtn();
        this._holdTimer = setInterval(() => {
            this.slowModeMs = Math.max(5000, this.slowModeMs - 833); // 30→5s in ~3s of hold
            this._updateSlowBtn();
        }, 100);
    },

    // Called on mouseup / mouseleave — commits whatever value was reached
    endHold: function () {
        if (this._holdTimer) { clearInterval(this._holdTimer); this._holdTimer = null; }
        this._updateSlowBtn();
    },

    _updateSlowBtn: function () {
        const btn = document.getElementById('slow-btn');
        if (!btn) return;
        const secs = Math.ceil(this.slowModeMs / 1000);
        btn.textContent = this.slowModeMs > 0 ? `⏳ ${secs}s` : '⏳';
        btn.classList.toggle('active', this.slowModeMs > 0);
    },

    // +12 sim-sec/tick in slow mode = 5× slower than working hours (+60)
    _tickDelta: function (fracHour) {
        if (this.slowModeMs > 0) return 12;
        const isOffHours = fracHour < 7.5 || fracHour >= 17.5;
        return isOffHours ? 600 : 60;
    },

    tick: function () {
        // Freeze on load for 5 real seconds — render but don't advance sim time
        if (this.freezeMs > 0) {
            this.freezeMs = Math.max(0, this.freezeMs - this.tickRateMs);
            const t = this.getFormattedTime();
            document.getElementById('datetime-display').innerText = `${t.day} ${t.padHour}:${t.padMin}`;
            this.updateBackground(t.fracHour);
            return;
        }

        const prev = this.getFormattedTime();

        if (this.slowModeMs > 0) {
            this.slowModeMs = Math.max(0, this.slowModeMs - this.tickRateMs);
            this._updateSlowBtn();
        }

        STATE.simSeconds += this._tickDelta(prev.fracHour);

        const t = this.getFormattedTime();
        document.getElementById('datetime-display').innerText = `${t.day} ${t.padHour}:${t.padMin}`;
        this.updateBackground(t.fracHour);
    },

    getFormattedTime: function () {
        const totalMins  = Math.floor(STATE.simSeconds / 60);
        const totalHours = Math.floor(totalMins / 60);
        const dayIndex   = Math.floor(totalHours / 24) % 7;
        const hour       = totalHours % 24;
        const min        = totalMins  % 60;

        return {
            day:      DAYS[dayIndex],
            hour,
            fracHour: hour + min / 60,
            padHour:  String(hour).padStart(2, '0'),
            padMin:   String(min).padStart(2, '0')
        };
    },

    updateBackground: function (fracHour) {
        let k0 = SKY[0], k1 = SKY[SKY.length - 1];
        for (let i = 0; i < SKY.length - 1; i++) {
            if (fracHour >= SKY[i].h && fracHour < SKY[i + 1].h) {
                k0 = SKY[i]; k1 = SKY[i + 1];
                break;
            }
        }
        const ratio = (fracHour - k0.h) / (k1.h - k0.h);
        const lerp  = (a, b) => Math.round(a + (b - a) * ratio);
        const rgb   = c => `rgb(${c[0]},${c[1]},${c[2]})`;
        const top = k0.top.map((v, i) => lerp(v, k1.top[i]));
        const bot = k0.bot.map((v, i) => lerp(v, k1.bot[i]));
        document.body.style.background = `linear-gradient(160deg, ${rgb(top)}, ${rgb(bot)})`;
    },

    initDisplay: function () {
        const t = this.getFormattedTime();
        document.getElementById('datetime-display').innerText = `${t.day} ${t.padHour}:${t.padMin}`;
        this.updateBackground(t.fracHour);
    }
};

// ============================================================================
// AGENT 2 — Room Grid & Mini-State Ribbon
// ============================================================================
const BAS_UI = {
    changeFloor: function (floorNum) {
        STATE.currentFloor = floorNum;
        for (let f = 1; f <= 3; f++) {
            document.getElementById(`mini-floor-${f}`)
                    .classList.toggle('floor-active', f === floorNum);
        }
        this.renderGrid();
    },

    renderGrid: function () {
        const grid = document.getElementById('canvas-grid');
        grid.innerHTML = '';

        // Row 1: odd room numbers (1,3,5) | Row 2: even (2,4,6)
        [[1, 3, 5], [2, 4, 6]].forEach(row => {
            row.forEach(roomNum => {
                const roomId = `${STATE.currentFloor}0${roomNum}`;
                const on     = STATE.rooms[roomId];
                const block  = document.createElement('div');
                block.className = `room-block ${on ? 'on' : 'off'}`;
                block.innerHTML = `<div>Room ${roomId}</div>
                                   <div style="font-size:0.9rem">${on ? 'ACTIVE' : 'VACANT'}</div>`;
                grid.appendChild(block);
            });
        });

        this.renderMiniState();
    },

    renderMiniState: function () {
        for (let f = 1; f <= 3; f++) {
            const container = document.querySelector(`#mini-floor-${f} .mini-floor`);
            container.innerHTML = '';
            for (let r = 1; r <= 6; r++) {
                const dot = document.createElement('div');
                dot.className = `mini-room ${STATE.rooms[`${f}0${r}`] ? 'on' : ''}`;
                container.appendChild(dot);
            }
        }
    }
};

// ============================================================================
// AGENT 2.5 — Debug Log
// ============================================================================
const BAS_Log = {
    maxLines: 80,

    add: function (msg, type = 'info') {
        const t   = BAS_Environment.getFormattedTime();
        const el  = document.getElementById('debug-log');
        if (!el) return;

        const row = document.createElement('div');
        row.className   = `log-line log-${type}`;
        row.textContent = `[${t.padHour}:${t.padMin}] ${msg}`;
        el.appendChild(row);

        while (el.children.length > this.maxLines) el.removeChild(el.firstChild);
        el.scrollTop = el.scrollHeight;
    }
};

// ============================================================================
// AGENT 3 — Business Logic & Core Reconciliation Loop
// ============================================================================
const BAS_API = {
    initSchedules: function () {
        // 30 hardcoded schedules spread across all floors, days, and time slots
        // Designed so multiple rooms are active simultaneously and transitions are frequent
        const fixed = [
            // MON — full day spread across all floors
            { day: "MON", start:  7, end:  9, room: "101" },
            { day: "MON", start:  7, end:  9, room: "203" },
            { day: "MON", start:  9, end: 11, room: "102" },
            { day: "MON", start:  9, end: 11, room: "305" },
            { day: "MON", start: 11, end: 13, room: "201" },
            { day: "MON", start: 13, end: 15, room: "104" },
            // TUE — heavier morning load
            { day: "TUE", start:  8, end: 10, room: "101" },
            { day: "TUE", start:  8, end: 10, room: "302" },
            { day: "TUE", start:  8, end: 10, room: "206" },
            { day: "TUE", start: 10, end: 12, room: "103" },
            { day: "TUE", start: 13, end: 15, room: "204" },
            { day: "TUE", start: 15, end: 17, room: "301" },
            // WED — midday busy
            { day: "WED", start:  9, end: 11, room: "205" },
            { day: "WED", start: 11, end: 13, room: "101" },
            { day: "WED", start: 11, end: 13, room: "304" },
            { day: "WED", start: 13, end: 15, room: "102" },
            { day: "WED", start: 13, end: 15, room: "202" },
            { day: "WED", start: 15, end: 17, room: "306" },
            // THU — afternoon heavy
            { day: "THU", start:  8, end: 10, room: "303" },
            { day: "THU", start: 10, end: 12, room: "105" },
            { day: "THU", start: 10, end: 12, room: "201" },
            { day: "THU", start: 14, end: 16, room: "106" },
            { day: "THU", start: 14, end: 16, room: "302" },
            { day: "THU", start: 16, end: 18, room: "204" },
            // FRI — short day
            { day: "FRI", start:  8, end: 10, room: "101" },
            { day: "FRI", start:  8, end: 10, room: "205" },
            { day: "FRI", start: 10, end: 12, room: "303" },
            { day: "FRI", start: 12, end: 14, room: "102" },
            // SAT — light load
            { day: "SAT", start:  9, end: 11, room: "201" },
            { day: "SAT", start:  9, end: 11, room: "104" },
        ];

        fixed.forEach(s => STATE.schedules.push(s));
        this.printSchedules();
    },

    adjustTime: function (secs) {
        STATE.simSeconds = Math.max(0, STATE.simSeconds + secs);
    },

    manualSetLight: function (value) {
        const roomId = document.getElementById('override-room').value.trim();
        if (STATE.rooms[roomId] === undefined) {
            BAS_Log.add(`⚠ unknown room ${roomId}`, 'error');
            return;
        }
        STATE.rooms[roomId] = value;
        BAS_Log.add(`⚡ manual ${roomId} → ${value ? 'ON' : 'OFF'}`, value ? 'success' : 'info');
        BAS_UI.renderGrid();
    },

    cancelClass: function (index) {
        STATE.schedules.splice(index, 1);
        this.printSchedules();
    },

    printSchedules: function () {
        const container = document.getElementById('active-schedules');
        container.innerHTML = '<strong>Schedules:</strong><br>';
        STATE.schedules.forEach((sch, idx) => {
            container.innerHTML +=
                `<div style="margin-bottom:3px;">📅 ${sch.day} ${sch.start}–${sch.end} R:${sch.room} ` +
                `<span style="color:#fc8181;cursor:pointer;" onclick="BAS_API.cancelClass(${idx})">[x]</span></div>`;
        });
    },

    toggleBuffer: function (enabled) {
        STATE.bufferEnabled = enabled;
        BAS_Log.add(`⚙ buffer ${enabled ? 'ON (+10 min pre/post)' : 'OFF'}`, 'info');
    },

    // Simulated API call — 5% random failure rate
    setLight: function (roomId, value, isRetry) {
        const label  = value ? 'ON' : 'OFF';
        const prefix = isRetry ? '↺ retry' : '→ call';
        BAS_Log.add(`${prefix} light ${roomId} ${label}`);

        if (Math.random() < 0.05) {
            BAS_Log.add(`✗ light ${roomId} ${label} — failed`, 'error');
            return false;
        }

        STATE.rooms[roomId] = value;
        BAS_Log.add(`✓ light ${roomId} → ${value}`, 'success');
        return true;
    },

    // Core reconciliation: compute desired state, diff vs actual, call API for changes
    coreLoop: function () {
        BAS_Environment.tick();

        const t = BAS_Environment.getFormattedTime();

        // Compute what schedules want right now (with optional 10-min buffer)
        const desired = {};
        const buf = STATE.bufferEnabled ? (10 / 60) : 0;  // fractional hours
        for (let key in STATE.rooms) desired[key] = 0;
        STATE.schedules.forEach(s => {
            if (s.day === t.day && t.fracHour >= (s.start - buf) && t.fracHour < (s.end + buf)) {
                if (desired[s.room] !== undefined) desired[s.room] = 1;
            }
        });

        // For every room where actual ≠ desired, call API
        // isRetry = true when desired hasn't changed since last tick (prev call failed)
        for (let roomId in desired) {
            if (desired[roomId] !== STATE.rooms[roomId]) {
                const isRetry = (STATE.desired[roomId] === desired[roomId]);
                this.setLight(roomId, desired[roomId], isRetry);
            }
        }

        STATE.desired = desired;
        BAS_UI.renderGrid();
    }
};

// ============================================================================
// INIT — Always starts at SUN 00:00
// ============================================================================
BAS_Environment.initDisplay();
BAS_API.initSchedules();
BAS_UI.changeFloor(1);

setInterval(() => BAS_API.coreLoop(), BAS_Environment.tickRateMs);
