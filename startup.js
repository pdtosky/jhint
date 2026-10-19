(function () {
  "use strict";

  const messages = {
    loading: "\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud574 \ub85c\uadf8\uc778\uacfc \ucd5c\uc2e0 \ub370\uc774\ud130\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.",
    error: "\uc11c\ubc84\uc5d0 \uc5f0\uacb0\ud558\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uac70\ub098 \ub2e4\uc2dc \uc5f0\uacb0\ud558\uae30\ub97c \ub20c\ub7ec \uc0c8\ub85c\uace0\uce68\ud574 \uc8fc\uc138\uc694.",
    delayed: "\uc11c\ubc84 \uc5f0\uacb0\uc774 \uc9c0\uc5f0\ub418\uace0 \uc788\uc2b5\ub2c8\ub2e4. \uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud558\uac70\ub098 \ub2e4\uc2dc \uc5f0\uacb0\ud558\uae30\ub97c \ub20c\ub7ec \uc0c8\ub85c\uace0\uce68\ud574 \uc8fc\uc138\uc694."
  };
  let currentState = "";
  let timeoutId = null;
  let attempt = 0;

  function clearWatchdog() {
    attempt += 1;
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    timeoutId = null;
  }

  function display(status, text) {
    currentState = status;
    document.body.classList.toggle("app-loading", status !== "ready");
    const screen = document.getElementById("appStartupScreen");
    const message = document.getElementById("appStartupMessage");
    if (screen) screen.hidden = status === "ready";
    if (message) message.textContent = text;
  }

  function setState(status) {
    if (status !== "ready" && status !== "loading" && status !== "error") return;
    // A repeated signal is not a new attempt; only ready or a full reload can exit an error.
    if (status === "loading" && (currentState === "loading" || currentState === "error")) return;

    clearWatchdog();
    display(status, status === "error" ? messages.error : messages.loading);
    if (status !== "loading") return;

    const watchdogAttempt = attempt;
    timeoutId = window.setTimeout(function () {
      // A canceled callback may already be queued, including one from an older attempt.
      if (currentState !== "loading" || attempt !== watchdogAttempt) return;
      clearWatchdog();
      display("error", messages.delayed);
    }, 30000);
  }

  function setStage(label) {
    if (currentState !== "loading" || typeof label !== "string" || !label.trim()) return;
    const message = document.getElementById("appStartupMessage");
    if (message) message.textContent = label;
  }

  window.ProductionStartup = { setState, setStage };
  setState("loading");
})();
