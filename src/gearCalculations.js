// Shared AGMA/Shigley factor methods used by the original gear optimizer and Shifter mode.
export const getJ = (N) => {
  if (N < 17) return 0.245;
  if (N > 100) return 0.485;
  return Math.min(0.485, 0.32 * Math.log(N) - 0.154);
};

export const getI = (phi_deg, mG) => {
  const phi = phi_deg * Math.PI / 180;
  return (Math.sin(phi) * Math.cos(phi)) / 2 * (mG / (mG + 1));
};

export const getKv = (V_ms, Qv = 6) => {
  const B = 0.25 * Math.pow(12 - Qv, 2 / 3);
  const A = 50 + 56 * (1 - B);
  const V_ftmin = V_ms * 196.85;
  return Math.pow((A + Math.sqrt(200 * V_ftmin)) / A, B);
};

export const getKs = (F_mm, m_mm, J) => {
  const F_in = F_mm / 25.4;
  const Pd = 25.4 / m_mm;
  const Y = Math.PI * J;
  return Math.max(1.0, 1.192 * Math.pow((F_in * Math.sqrt(Y)) / Pd, 0.0535));
};

export const getKm = (F_mm, d_p_mm) => {
  const F_in = F_mm / 25.4;
  const d_in = d_p_mm / 25.4;
  const Cmc = 1.0;
  const Ce = 1.0;
  const ratio = F_in / (10 * d_in);
  let Cpf;
  if (F_in <= 1) Cpf = ratio - 0.025;
  else if (F_in <= 17) Cpf = ratio - 0.0375 + 0.0125 * F_in;
  else Cpf = ratio - 0.1109 + 0.0207 * F_in - 0.000228 * F_in * F_in;
  Cpf = Math.max(0, Cpf);
  const Cpm = (F_in / d_in <= 0.175) ? 1.0 : 1.1;
  let Cma;
  if (F_in <= 6) Cma = 0.0675 + 0.0128 * F_in - 0.926e-3 * F_in * F_in;
  else Cma = 0.00360 + 0.0102 * F_in - 0.822e-4 * F_in * F_in;
  Cma = Math.max(0.01, Cma);
  return 1 + Cmc * (Cpf * Cpm + Cma * Ce);
};

export const KB = 1.0;
export const Cp = 191.0;

export const MATERIALS = {
  "Grade 1 Steel (HB 180)": { sigma_b: 241, sigma_c: 793, HB: 180 },
  "Grade 1 Steel (HB 300)": { sigma_b: 290, sigma_c: 993, HB: 300 },
  "Grade 2 Steel (HB 300)": { sigma_b: 310, sigma_c: 1069, HB: 300 },
  "Grade 2 Steel (HB 360)": { sigma_b: 345, sigma_c: 1172, HB: 360 },
  "Carburized & Hardened (Grade 1)": { sigma_b: 380, sigma_c: 1380, HB: 600 },
  "Carburized & Hardened (Grade 2)": { sigma_b: 450, sigma_c: 1550, HB: 600 },
};

export const getKL = (cycles) => {
  if (cycles <= 1e4) return 2.70;
  if (cycles <= 3e6) return Math.max(1.0, 1.6756 * Math.pow(cycles, -0.0323));
  return Math.max(0.785, 1.3558 * Math.pow(cycles, -0.0178));
};

const KR_TABLE = { 0.9: 0.85, 0.99: 1.00, 0.999: 1.25, 0.9999: 1.50 };
export const getKR = (rel) => KR_TABLE[rel] ?? 1.0;
export const KT = 1.0;
