const scriptLoadPromises = new Map();

/**
 * Load an external script once and reuse the same promise across callers.
 * @param {string} src - Script URL/path.
 * @param {string|null} globalName - Optional global symbol expected on window.
 */
export async function loadScriptOnce(src, globalName = null) {
    if (globalName && typeof window[globalName] !== 'undefined') {
        return window[globalName];
    }

    if (scriptLoadPromises.has(src)) {
        return scriptLoadPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;

        script.onload = () => {
            if (globalName && typeof window[globalName] === 'undefined') {
                reject(new Error(`Script loaded but window.${globalName} is missing: ${src}`));
                return;
            }
            resolve(globalName ? window[globalName] : true);
        };

        script.onerror = () => {
            reject(new Error(`Failed to load script: ${src}`));
        };

        document.head.appendChild(script);
    });

    scriptLoadPromises.set(src, promise);

    try {
        return await promise;
    } catch (error) {
        scriptLoadPromises.delete(src);
        throw error;
    }
}
