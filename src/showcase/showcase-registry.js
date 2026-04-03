/**
 * Kernel hooks for multi-showcase orchestration.
 * Register blockers from script.js after mode state exists (no cyclic imports).
 */

const vajbujAutoBlockers = [];
const particleMouseSimBlockers = [];

/**
 * When any registered function returns true, VAJBUJ idle auto-start is suppressed.
 * @param {() => boolean} fn
 */
export function registerVajbujAutoBlocker(fn) {
    vajbujAutoBlockers.push(fn);
}

/**
 * When any registered function returns true, particle sim uses a far sim target (no mouse follow).
 * @param {() => boolean} fn
 */
export function registerParticleMouseSimBlocker(fn) {
    particleMouseSimBlockers.push(fn);
}

export function isVajbujAutoStartBlocked() {
    for (let i = 0; i < vajbujAutoBlockers.length; i++) {
        try {
            if (vajbujAutoBlockers[i]()) return true;
        } catch {
            /* ignore broken getters */
        }
    }
    return false;
}

export function isParticleMouseSimSuppressed() {
    for (let i = 0; i < particleMouseSimBlockers.length; i++) {
        try {
            if (particleMouseSimBlockers[i]()) return true;
        } catch {
            /* ignore */
        }
    }
    return false;
}
