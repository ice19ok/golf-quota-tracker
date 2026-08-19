export type QuotaPoints = {
  ace: number;
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  doubleBogey: number;
};

export const DEFAULT_QUOTA_POINTS: QuotaPoints = {
  ace: 10,
  eagle: 5,
  birdie: 4,
  par: 3,
  bogey: 2,
  doubleBogey: 1,
};

/*
 * LOAD QUOTA SETTINGS
 *
 * These are the settings saved by:
 * /settings/quota
 */
export function loadQuotaPoints(): QuotaPoints {
  if (typeof window === "undefined") {
    return DEFAULT_QUOTA_POINTS;
  }

  try {
    const saved =
      localStorage.getItem("quotaPoints");

    if (!saved) {
      return DEFAULT_QUOTA_POINTS;
    }

    const parsed = JSON.parse(saved);

    return {
      ace:
        typeof parsed.ace === "number"
          ? parsed.ace
          : DEFAULT_QUOTA_POINTS.ace,

      eagle:
        typeof parsed.eagle === "number"
          ? parsed.eagle
          : DEFAULT_QUOTA_POINTS.eagle,

      birdie:
        typeof parsed.birdie === "number"
          ? parsed.birdie
          : DEFAULT_QUOTA_POINTS.birdie,

      par:
        typeof parsed.par === "number"
          ? parsed.par
          : DEFAULT_QUOTA_POINTS.par,

      bogey:
        typeof parsed.bogey === "number"
          ? parsed.bogey
          : DEFAULT_QUOTA_POINTS.bogey,

      doubleBogey:
        typeof parsed.doubleBogey === "number"
          ? parsed.doubleBogey
          : DEFAULT_QUOTA_POINTS.doubleBogey,
    };
  } catch (error) {
    console.error(
      "Could not load quota settings:",
      error
    );

    return DEFAULT_QUOTA_POINTS;
  }
}

/*
 * CALCULATE POINTS FOR ONE HOLE
 *
 * IMPORTANT:
 *
 * Ace              = Ace setting
 * Eagle (-2)       = Eagle setting
 * Birdie (-1)      = Birdie setting
 * Par (0)          = Par setting
 * Bogey (+1)       = Bogey setting
 * Double Bogey +2  = Double Bogey setting
 * Triple +3        = ZERO
 * Quad +4          = ZERO
 * Worse            = ZERO
 */
export function calculateHolePoints(
  score: number,
  par: number,
  quotaPoints: QuotaPoints
): number {
  if (
    !Number.isFinite(score) ||
    !Number.isFinite(par)
  ) {
    return 0;
  }

  /*
   * ACE
   */
  if (score === 1) {
    return quotaPoints.ace;
  }

  const difference = score - par;

  /*
   * EAGLE
   * Exactly 2 under par.
   */
  if (difference === -2) {
    return quotaPoints.eagle;
  }

  /*
   * BIRDIE
   */
  if (difference === -1) {
    return quotaPoints.birdie;
  }

  /*
   * PAR
   */
  if (difference === 0) {
    return quotaPoints.par;
  }

  /*
   * BOGEY
   */
  if (difference === 1) {
    return quotaPoints.bogey;
  }

  /*
   * DOUBLE BOGEY
   */
  if (difference === 2) {
    return quotaPoints.doubleBogey;
  }

  /*
   * TRIPLE BOGEY OR WORSE
   *
   * THIS MUST BE ZERO.
   */
  return 0;
}

/*
 * CALCULATE ALL PLAYER POINTS
 */
export function calculatePlayerQuotaPoints(
  scores: Record<string, number | "">,
  playerId: string,
  pars: Record<number, number>,
  holes: number,
  quotaPoints: QuotaPoints
): number {
  let total = 0;

  for (let hole = 1; hole <= holes; hole++) {
    const key = `${playerId}-${hole}`;

    const score = scores[key];

    if (
      score === "" ||
      score === undefined
    ) {
      continue;
    }

    const par = pars[hole] ?? 4;

    total += calculateHolePoints(
      Number(score),
      par,
      quotaPoints
    );
  }

  return total;
}