/**
 * Default orbit / FOV preset for VAJBUJ and MYSEN entry (shared kernel hook).
 */
export function computeMusicShowcaseCameraResetValues(config) {
    const z0 = config.initialZoom;
    return {
        animationMode: 'repulsion',
        isCinematic: false,
        isFreeCam: false,
        controlsEnabled: false,
        cameraAngle: 0,
        cameraVerticalAngle: 0,
        cameraRadius: z0,
        targetCameraAngle: 0,
        targetCameraVerticalAngle: 0,
        targetCameraRadius: z0,
        focusX: 0,
        focusY: 0,
        focusZ: 0,
        cameraFov: 45
    };
}
