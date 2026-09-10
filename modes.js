// Visual-only mode switcher for the top bar. Free Build is the default
// active mode since it's what the canvas already does; Learn and
// Challenge don't do anything behaviorally yet - this just tracks and
// displays which one is currently selected. The settings button lives
// in settings.js, since it opens the settings side panel.

const modeButtons = document.querySelectorAll(".mode-btn");

modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        // Learn and Challenge are locked (not built yet - see the
        // .is-locked markup/styling in index.html/style.css), so a
        // click on either of them is a no-op rather than switching mode.
        if (btn.classList.contains("is-locked")) return;

        modeButtons.forEach(b => {
            b.classList.remove("is-active");
            b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
    });
});