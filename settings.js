// Settings panel. Built and appended to <body> once (as a fixed-position
// overlay, like the gate-info popovers) so it always sits above every
// panel and isn't constrained by the app's grid layout. It slides in
// from the right over the existing screen rather than navigating to a
// separate page - the app has no routing/history to preserve, so a
// panel-over-content overlay keeps things simple while still reading
// like a distinct "settings page".
//
// Theme and Grid Snap Size are both live and persisted (localStorage);
// everything else in the panel is still a placeholder for later.

import { gates, signals, gridSize, setGridSize, simulationSpeed, setSimulationSpeed } from "./state.js";
import { recordHistory } from "./history.js";

const settingsButton = document.getElementById("settingsButton");

const THEME_KEY = "hubert-theme";
const GRID_SIZE_KEY = "hubert-grid-size";
const SIM_SPEED_KEY = "hubert-sim-speed";

// Sizes deliberately stop short of extremes: a two-input gate is 3
// grid cells wide, so anything much smaller starts crowding gates and
// their wires together, and anything much larger just wastes canvas
// space without adding functionality.
const GRID_SIZES = [20, 25, 30];

function buildSettingsPanel() {
    const backdrop = document.createElement("div");
    backdrop.className = "settings-backdrop";

    const panel = document.createElement("div");
    panel.className = "settings-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Settings");

    panel.innerHTML = `
        <div class="settings-panel-header">
            <span class="settings-panel-title">Settings</span>
            <button class="settings-panel-close" aria-label="Close settings">&times;</button>
        </div>
        <div class="settings-panel-body">
            <div class="settings-section">
                <span class="settings-section-label">Appearance</span>
                <button class="settings-option-btn settings-option-btn--theme" id="themeToggleButton">
                    <span class="settings-option-label">Theme</span>
                    <span class="settings-option-value" id="themeToggleValue">Dark</span>
                </button>
                <div class="settings-option-row settings-option-row--grid">
                    <span class="settings-option-label">Grid Snap Size</span>
                    <div class="grid-scale-group" id="gridScaleGroup" role="group" aria-label="Grid snap size">
                        ${GRID_SIZES.map(size => `
                            <button class="grid-scale-btn" type="button" data-size="${size}" aria-pressed="false">${size}px</button>
                        `).join("")}
                    </div>
                </div>
            </div>
            <div class="settings-section">
                <span class="settings-section-label">Circuit</span>
                <button class="settings-option-btn settings-option-btn--speed" id="simSpeedToggleButton">
                    <span class="settings-option-label">Simulation Speed</span>
                    <span class="settings-option-value" id="simSpeedToggleValue">Normal</span>
                </button>
            </div>
            <div class="settings-section">
                <span class="settings-section-label">About</span>
                <button class="settings-option-btn settings-option-btn--shortcuts" id="shortcutsToggleButton" aria-expanded="false" aria-controls="shortcutsPanel">
                    <span class="settings-option-label">Keyboard Shortcuts</span>
                    <svg class="settings-option-chevron" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6,9 L12,15 L18,9" />
                    </svg>
                </button>
                <div class="shortcuts-panel" id="shortcutsPanel" role="region" aria-label="Keyboard shortcuts">
                    <div class="shortcuts-panel-inner">
                        <div class="shortcut-row">
                            <span class="shortcut-keys"><kbd>Ctrl</kbd><span class="shortcut-plus">+</span><kbd>Z</kbd></span>
                            <span class="shortcut-desc">Undo the last action</span>
                        </div>
                        <div class="shortcut-row">
                            <span class="shortcut-keys"><kbd>Ctrl</kbd><span class="shortcut-plus">+</span><kbd>Y</kbd></span>
                            <span class="shortcut-desc">Redo the last undone action</span>
                        </div>
                        <div class="shortcut-row">
                            <span class="shortcut-keys"><kbd>Ctrl</kbd><span class="shortcut-plus">+</span><kbd>Shift</kbd><span class="shortcut-plus">+</span><kbd>Z</kbd></span>
                            <span class="shortcut-desc">Redo (alternate)</span>
                        </div>
                        <div class="shortcut-row">
                            <span class="shortcut-keys"><kbd>Esc</kbd></span>
                            <span class="shortcut-desc">Close open panels, or exit delete mode</span>
                        </div>
                        <div class="shortcuts-panel-note">On macOS, use Cmd in place of Ctrl.</div>
                    </div>
                </div>
                <button class="settings-option-btn settings-option-btn--about" id="aboutToggleButton" aria-expanded="false" aria-controls="aboutPanel">
                    <span class="settings-option-label">About Hubert</span>
                    <svg class="settings-option-chevron" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6,9 L12,15 L18,9" />
                    </svg>
                </button>
                <div class="shortcuts-panel" id="aboutPanel" role="region" aria-label="About Hubert">
                    <div class="shortcuts-panel-inner shortcuts-panel-inner--about">
                        <p class="about-panel-text">Hubert is a browser-based logic gate circuit simulator - Made by me (the goat)</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    return { backdrop, panel };
}

const { backdrop, panel } = buildSettingsPanel();
const closeButton = panel.querySelector(".settings-panel-close");

function isOpen() {
    return panel.classList.contains("is-open");
}

function openSettings() {
    backdrop.classList.add("is-open");
    panel.classList.add("is-open");
    if (settingsButton) settingsButton.setAttribute("aria-expanded", "true");
}

function closeSettings() {
    backdrop.classList.remove("is-open");
    panel.classList.remove("is-open");
    if (settingsButton) settingsButton.setAttribute("aria-expanded", "false");
}

if (settingsButton) {
    settingsButton.addEventListener("click", () => {
        isOpen() ? closeSettings() : openSettings();
    });
}

closeButton.addEventListener("click", closeSettings);
backdrop.addEventListener("click", closeSettings);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeSettings();
});

// ---- Theme (Dark / Light) -------------------------------------------
// A tiny inline script in index.html's <head> already applies the
// stored theme before first paint (to avoid a dark->light flash), so
// this only needs to keep that in sync going forward and update the
// button's label to match.

const themeButton = panel.querySelector("#themeToggleButton");
const themeValue = panel.querySelector("#themeToggleValue");

function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(theme) {
    if (theme === "light") {
        document.documentElement.setAttribute("data-theme", "light");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem(THEME_KEY, theme);
    themeValue.textContent = theme === "light" ? "Light" : "Dark";
}

themeButton.addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
});

// Sync the label with whatever the head script already applied - no
// need to re-apply the attribute, just reflect it in the UI.
themeValue.textContent = currentTheme() === "light" ? "Light" : "Dark";

// ---- Grid Snap Size ---------------------------------------------------
// Every placed gate/signal is sized in CSS purely off --grid-size (see
// style.css), so resizing them on the fly is just a matter of changing
// that one variable - the part that needs real work here is rescaling
// each component's *position* by the same ratio so everything still
// lands on the new grid lines instead of drifting off them.

const gridScaleGroup = panel.querySelector("#gridScaleGroup");
const gridScaleButtons = Array.from(panel.querySelectorAll(".grid-scale-btn"));

function markActiveGridButton(size) {
    gridScaleButtons.forEach(btn => {
        const isActive = Number(btn.dataset.size) === size;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
    });
}

function setGridSizeVar(size) {
    document.documentElement.style.setProperty("--grid-size", `${size}px`);
}

// Repositions every already-placed gate and signal so it lands on the
// same relative grid spot under the new size. Every stored x/y was
// originally a clean multiple of the old grid size (gates, via
// snapToGrid) or a half-cell offset of it (signals, via the
// `(n-1)*gridSize + gridSize/2` formula in signals.js) - scaling both
// by the same ratio reproduces that same formula for the new size
// exactly, no re-snapping/rounding needed.
function rescalePlacedComponents(oldSize, newSize) {
    const ratio = newSize / oldSize;

    gates.forEach(gate => {
        gate.x = Math.round(gate.x * ratio);
        gate.y = Math.round(gate.y * ratio);
        const el = document.getElementById(gate.id);
        if (el) {
            el.style.left = `${gate.x}px`;
            el.style.top = `${gate.y}px`;
        }
    });

    signals.forEach(signal => {
        signal.y = Math.round(signal.y * ratio);
        const el = document.getElementById(signal.id);
        if (el) el.style.top = `${signal.y}px`;
    });
}

function applyGridSize(newSize, { persist = true, rescale = true } = {}) {
    const oldSize = gridSize;
    if (newSize === oldSize) {
        markActiveGridButton(newSize);
        return;
    }

    if (rescale) {
        recordHistory();
        rescalePlacedComponents(oldSize, newSize);
    }

    setGridSize(newSize);
    setGridSizeVar(newSize);
    markActiveGridButton(newSize);
    if (persist) localStorage.setItem(GRID_SIZE_KEY, String(newSize));
}

gridScaleGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".grid-scale-btn");
    if (!btn) return;
    applyGridSize(Number(btn.dataset.size));
});

// Restore a stored grid size on load. Nothing's been placed on the
// canvas yet at this point, so there's nothing to rescale or undo -
// just line the variable and the button state up with what was saved.
const storedGridSize = Number(localStorage.getItem(GRID_SIZE_KEY));
if (GRID_SIZES.includes(storedGridSize)) {
    applyGridSize(storedGridSize, { persist: false, rescale: false });
} else {
    markActiveGridButton(gridSize);
}

// ---- Expand/collapse accordions (Keyboard Shortcuts, About) -----------
// Both expand in place under their own trigger button, the same
// "slide" feel as the settings panel itself sliding in, rather than
// popping up as a separate overlay. Shared setup since the two behave
// identically - only their button/panel elements differ.

function setupAccordion(button, contentPanel) {
    function setOpen(shouldOpen) {
        button.classList.toggle("is-active", shouldOpen);
        button.setAttribute("aria-expanded", String(shouldOpen));

        if (shouldOpen) {
            // max-height can't transition to/from "auto", so measure the
            // content's natural height and transition to that exact
            // pixel value instead - otherwise an arbitrary large
            // max-height would leave a pause at the end of the
            // animation before it "catches".
            contentPanel.style.maxHeight = `${contentPanel.scrollHeight}px`;
        } else {
            contentPanel.style.maxHeight = "0px";
        }
    }

    button.addEventListener("click", () => {
        setOpen(!button.classList.contains("is-active"));
    });
}

setupAccordion(panel.querySelector("#shortcutsToggleButton"), panel.querySelector("#shortcutsPanel"));
setupAccordion(panel.querySelector("#aboutToggleButton"), panel.querySelector("#aboutPanel"));

// ---- Simulation Speed (Normal / Instant) ------------------------------
// Purely a rendering choice, so it's read live off state.js's
// simulationSpeed binding by wires.js's draw loop every frame - nothing
// here needs to trigger a redraw or touch history, unlike grid size
// which actually repositions components.

const simSpeedButton = panel.querySelector("#simSpeedToggleButton");
const simSpeedValue = panel.querySelector("#simSpeedToggleValue");

function applySimSpeed(speed, { persist = true } = {}) {
    setSimulationSpeed(speed);
    simSpeedValue.textContent = speed === "instant" ? "Instant" : "Normal";
    if (persist) localStorage.setItem(SIM_SPEED_KEY, speed);
}

simSpeedButton.addEventListener("click", () => {
    applySimSpeed(simulationSpeed === "instant" ? "normal" : "instant");
});

const storedSimSpeed = localStorage.getItem(SIM_SPEED_KEY);
applySimSpeed(storedSimSpeed === "instant" ? "instant" : "normal", { persist: false });