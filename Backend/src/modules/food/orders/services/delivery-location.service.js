import { FoodZone } from '../../admin/models/zone.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { haversineKm } from './order.helpers.js';

const FALLBACK_MAX_DELIVERY_DISTANCE_KM = 50;

const isPointInPolygon = (lat, lng, polygon = []) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i]?.longitude);
    const yi = Number(polygon[i]?.latitude);
    const xj = Number(polygon[j]?.longitude);
    const yj = Number(polygon[j]?.latitude);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export async function assertDeliveryLocationServiceable({
  restaurantZoneId,
  deliveryCoordinates,
  distanceKm,
} = {}) {
  const coordinates = Array.isArray(deliveryCoordinates)
    ? deliveryCoordinates.map(Number)
    : [];
  const [deliveryLng, deliveryLat] = coordinates;
  if (
    coordinates.length !== 2 ||
    !Number.isFinite(deliveryLng) ||
    !Number.isFinite(deliveryLat)
  ) {
    throw new ValidationError('A valid delivery location is required to place the order.');
  }

  if (restaurantZoneId) {
    const zone = await FoodZone.findById(restaurantZoneId)
      .select('coordinates centerPoint serviceRadius isRadiusEnabled isActive')
      .lean();
    if (!zone || zone.isActive === false) {
      throw new ValidationError('The restaurant service zone is currently unavailable.');
    }

    if (Array.isArray(zone.coordinates) && zone.coordinates.length >= 3) {
      if (!isPointInPolygon(deliveryLat, deliveryLng, zone.coordinates)) {
        throw new ValidationError('Delivery address is outside this restaurant service zone.');
      }
      return;
    }

    if (
      zone.isRadiusEnabled &&
      Number.isFinite(Number(zone.serviceRadius)) &&
      zone.centerPoint
    ) {
      const radiusDistance = haversineKm(
        Number(zone.centerPoint.latitude),
        Number(zone.centerPoint.longitude),
        deliveryLat,
        deliveryLng,
      );
      if (radiusDistance > Number(zone.serviceRadius)) {
        throw new ValidationError('Delivery address is outside this restaurant service zone.');
      }
      return;
    }
  }

  if (
    Number.isFinite(Number(distanceKm)) &&
    Number(distanceKm) > FALLBACK_MAX_DELIVERY_DISTANCE_KM
  ) {
    throw new ValidationError('Delivery address is too far from this restaurant.');
  }
}

