export function getGearAnimationTiming(ratio, speedMultiplier = 1, driverRevolutionSeconds = 8) {
  const driverDurationSeconds = driverRevolutionSeconds / speedMultiplier;
  return {
    driverDurationSeconds,
    drivenDurationSeconds: driverDurationSeconds * ratio,
    driverDirection: "normal",
    drivenDirection: "reverse",
  };
}

export function getShiftRotationAngles(loadedDriverRevolutions, ratio) {
  const driverDegrees = loadedDriverRevolutions * 360;
  return {
    driverDegrees,
    drivenDegrees: -driverDegrees / ratio,
  };
}

export function getGearMeshPhaseDegrees(teeth, gear) {
  return gear === "driver" ? 90 - 126 / teeth : 270 - 306 / teeth;
}
