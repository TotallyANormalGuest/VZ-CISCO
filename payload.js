(async function() {
    const SYSTEM_CONFIG = {
        identifier: "VZ-ELITE-INDUSTRIAL",
        build: "8.2.2-MODERN",
        source: 'https://raw.githubusercontent.com/testacckn5/VZ/refs/heads/main/definitions.json',
        mirror: 'https://api.allorigins.win/raw?url=https://raw.githubusercontent.com/testacckn5/VZ/refs/heads/main/definitions.json',
        interval: 2000
    };

    let LAST_SYNC_TIME = "INITIALIZING";
    let LAST_FILE_SOURCE = "STANDBY";
    let CURRENT_HASH = "";

    // Modern Industrial Logger
    const log = (level, message, color = "#ffffff") => {
        const timestamp = new Date().toLocaleTimeString('en-GB');
        const styles = {
            CRITICAL: "background: #3d0000; color: #ff4d4d; border-left: 4px solid #ff4d4d;",
            SYSTEM: "background: #1a1a1a; color: #00d9ff; border-left: 4px solid #00d9ff;",
            NETWORK: "background: #1a1a1a; color: #ffffff; border-left: 4px solid #ffffff;",
            UPDATE: "background: #ffffff; color: #000000; font-weight: 900; border-radius: 2px;"
        };
        console.log(`%c [${timestamp}] [${level}] ${message} `, styles[level] || "color: #888;");
    };

    const isOnline = () => navigator.onLine;

    const syncDefinitions = async () => {
        if (!isOnline()) return (await chrome.storage.local.get(['vz_persistent_cache'])).vz_persistent_cache;

        const endpoints = [SYSTEM_CONFIG.source, SYSTEM_CONFIG.mirror];
        for (let url of endpoints) {
            try {
                const response = await fetch(url + '?v=' + Date.now());
                if (response.ok) {
                    const rawData = await response.json();
                    if (rawData && rawData.targets) {
                        const dataHash = JSON.stringify(rawData.targets);
                        if (dataHash !== CURRENT_HASH) {
                            CURRENT_HASH = dataHash;
                            LAST_SYNC_TIME = rawData.manifest?.updated_at || new Date().toLocaleTimeString();
                            LAST_FILE_SOURCE = url.includes('github') ? "REMOTE_CLOUD" : "REMOTE_MIRROR";
                            log("UPDATE", `DEPLOYMENT RECEIVED: BUILD ${rawData.manifest?.version}`);
                            await chrome.storage.local.set({ 'vz_persistent_cache': rawData });
                        }
                        return rawData;
                    }
                }
            } catch (err) { continue; }
        }
        return (await chrome.storage.local.get(['vz_persistent_cache'])).vz_persistent_cache;
    };

    const refreshUI = (extensions, targets) => {
        if (!extensions) return;

        const namePattern = new RegExp(targets.broad_search || targets.names, 'i');
        const report = extensions.map(ext => {
            const isMatch = (targets.critical_ids && targets.critical_ids.includes(ext.id)) || 
                            namePattern.test(ext.name) || 
                            (targets.stealth_names && targets.stealth_names.includes(ext.name));
            return {
                "NODE_IDENTIFIER": ext.name.substring(0, 22).toUpperCase(),
                "ENFORCEMENT": ext.enabled ? "ACTIVE" : "SUPPRESSED",
                "SECURITY_LEVEL": isMatch ? "RESTRICTED" : "AUTHORIZED"
            };
        });

        console.clear();
        log("SYSTEM", `CORE_STATUS: ${SYSTEM_CONFIG.identifier} // REL_${SYSTEM_CONFIG.build}`);
        
        if (console.table) {
            console.table(report);
        }

        // Modern Footer
        console.log(
            `%c SYNCHRONIZED: ${LAST_SYNC_TIME} %c ${LAST_FILE_SOURCE} `,
            "background: #00d9ff; color: #000; font-weight: bold; padding: 2px;",
            "background: #333; color: #fff; padding: 2px;"
        );
    };

    const runCycle = async () => {
        if (typeof chrome.management === 'undefined') {
            log("CRITICAL", "API_ERROR: MANAGEMENT_ACCESS_DENIED");
            return;
        }

        const fullData = await syncDefinitions();
        if (!fullData || !fullData.targets) return;

        chrome.management.getAll((extList) => {
            refreshUI(extList, fullData.targets);
            extList.forEach(ext => {
                const targets = fullData.targets;
                const namePattern = new RegExp(targets.broad_search || targets.names, 'i');
                const isTarget = (targets.critical_ids && targets.critical_ids.includes(ext.id)) || 
                                 namePattern.test(ext.name) || 
                                 (targets.stealth_names && targets.stealth_names.includes(ext.name));

                if (isTarget && ext.id !== chrome.runtime.id && ext.enabled) {
                    chrome.management.setEnabled(ext.id, false, () => {
                        if (chrome.runtime.lastError) log("CRITICAL", `ADMIN_HARD_LOCK: ${ext.name.toUpperCase()}`);
                    });
                }
            });
        });
    };

    // Initialize with Modern Aesthetic
    log("SYSTEM", "INITIALIZING SECURE PROTOCOL...");
    runCycle();
    setInterval(runCycle, SYSTEM_CONFIG.interval);
})();
