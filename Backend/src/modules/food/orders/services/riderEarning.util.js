/**
 * Rider payout for one delivery, from the admin's distance-slab rules.
 *
 * How a slab is read:
 *   basePayout      - a flat amount for the trip, taken from the slab that covers the
 *                     start of the trip (normally the "0 - x km" slab). Counted once.
 *   commissionPerKm - charged only on the kilometres that actually fall inside that
 *                     slab, i.e. from the slab's own minDistance upwards.
 *
 * So with "0-3 km: base 20, per-km 0" and "3+ km: base 0, per-km 6":
 *   1.4 km -> 20            (entirely inside the flat slab)
 *   3.0 km -> 20            (slab 2 has not started yet)
 *   5.0 km -> 20 + 2*6 = 32 (flat slab + 2 km inside slab 2)
 *
 * A per-km value on the first slab is charged from 0 km, so a flat "₹20 for 0-3 km"
 * must have its per-km left at 0 - otherwise 1.4 km pays 20 + 1.4 * perKm.
 */
export function computeRiderEarningFromRules(distanceKm, rules) {
    const d = Number(distanceKm);
    if (!Number.isFinite(d) || d <= 0) return 0;

    const list = Array.isArray(rules) ? rules.filter(Boolean) : [];
    if (!list.length) return 0;

    const sorted = [...list].sort(
        (a, b) => (Number(a.minDistance) || 0) - (Number(b.minDistance) || 0),
    );

    // The flat part of the trip comes from the slab that covers its start. Normally that is
    // the "0 - x km" slab; if the admin has no slab starting at 0, fall back to the lowest
    // slab there is, so a missing 0-slab never silently pays the rider nothing.
    const baseRule = sorted.find((r) => Number(r.minDistance || 0) === 0) || sorted[0];
    let earning = Math.max(0, Number(baseRule?.basePayout) || 0);

    for (const r of sorted) {
        const perKm = Number(r.commissionPerKm || 0);
        if (!Number.isFinite(perKm) || perKm <= 0) continue;

        const min = Number(r.minDistance || 0);
        const max = r.maxDistance == null ? null : Number(r.maxDistance);
        if (d <= min) continue;

        const upper = max == null || !Number.isFinite(max) ? d : Math.min(d, max);
        const kmInSlab = Math.max(0, upper - min);
        if (kmInSlab > 0) earning += kmInSlab * perKm;
    }

    if (!Number.isFinite(earning) || earning <= 0) return 0;
    return Math.round(earning);
}

export default computeRiderEarningFromRules;
