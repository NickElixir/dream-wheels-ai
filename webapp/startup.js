(() => {
    const root = document.documentElement;
    const updateLanguage = () => {
        const language = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || navigator.language || "en";
        const russian = language.toLowerCase().startsWith("ru");
        document.querySelector("[data-startup-label]").textContent = russian ? "Открываем приложение…" : "Opening app…";
        document.querySelector("[data-startup-error]").textContent = russian ? "Не удалось открыть приложение" : "Could not open the app";
        document.querySelector("[data-startup-retry]").textContent = russian ? "Повторить" : "Retry";
    };
    updateLanguage();
    let finished = false;
    let runtimeReady = false;
    let surfaceReady = false;
    const fail = () => {
        if (!finished) {
            updateLanguage();
            root.dataset.uiStartup = "error";
        }
    };
    const onSdkLoad = (event) => {
        if (event.target?.tagName === "SCRIPT" && event.target.src?.split("?")[0] === "https://telegram.org/js/telegram-web-app.js") updateLanguage();
    };
    const onError = (event) => {
        const script = event.target;
        if (script?.tagName === "SCRIPT" && script.type === "module") fail();
    };
    const timer = setTimeout(fail, 20000);
    window.addEventListener("error", onError, true);
    window.addEventListener("load", onSdkLoad, true);
    const reveal = () => {
        if (!runtimeReady || !surfaceReady) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener("error", onError, true);
        window.removeEventListener("load", onSdkLoad, true);
        delete root.dataset.uiStartup;
    };
    window.addEventListener("dreamwheels:surfaceready", () => {
        surfaceReady = true;
        reveal();
    }, { once: true });
    window.addEventListener("dreamwheels:runtimeready", () => {
        runtimeReady = true;
        reveal();
    }, { once: true });
})();
