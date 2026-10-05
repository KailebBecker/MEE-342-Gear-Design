import test from "node:test";
import assert from "node:assert/strict";
import { getGearAnimationTiming, getGearMeshPhaseDegrees, getShiftRotationAngles } from "./gearAnimation.js";

test("gear animation uses opposite directions and tooth-ratio speed", () => {
  const timing = getGearAnimationTiming(5, 1);
  const driverSpeed = 1 / timing.driverDurationSeconds;
  const drivenSpeed = 1 / timing.drivenDurationSeconds;

  assert.equal(timing.driverDirection, "normal");
  assert.equal(timing.drivenDirection, "reverse");
  assert.equal(driverSpeed / drivenSpeed, 5);
  assert.equal(timing.drivenDurationSeconds, 5 * timing.driverDurationSeconds);
});

test("speed presets scale animation duration without changing relative gear speed", () => {
  const slow = getGearAnimationTiming(5, 0.5);
  const fast = getGearAnimationTiming(5, 2);

  assert.equal(slow.driverDurationSeconds, 16);
  assert.equal(fast.driverDurationSeconds, 4);
  assert.equal(slow.drivenDurationSeconds / slow.driverDurationSeconds, 5);
  assert.equal(fast.drivenDurationSeconds / fast.driverDurationSeconds, 5);
});

test("single-shift rotation follows confirmed driver turns and inverse gear ratio", () => {
  const angles = getShiftRotationAngles(1.5, 5);
  assert.equal(angles.driverDegrees, 540);
  assert.equal(angles.drivenDegrees, -108);
  assert.equal(angles.driverDegrees / angles.drivenDegrees, -5);
});

test("initial external gear phase places driver tooth at the driven gear gap", () => {
  const pinionTeeth = 15;
  const gearTeeth = 75;
  const driverPitch = 360 / pinionTeeth;
  const drivenPitch = 360 / gearTeeth;
  const driverToothCenter = -90 + driverPitch * 0.35 + getGearMeshPhaseDegrees(pinionTeeth, "driver");
  const drivenGapCenter = -90 + drivenPitch * 0.85 + getGearMeshPhaseDegrees(gearTeeth, "driven");

  assert.ok(Math.abs(driverToothCenter) < 1e-10);
  assert.ok(Math.abs(drivenGapCenter - 180) < 1e-10);
});
