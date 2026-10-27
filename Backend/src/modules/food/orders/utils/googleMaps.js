import { config } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';

async function fetchOsrmPolyline(origin, destination) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=polyline&steps=false`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return '';
        const data = await response.json();
        return typeof data?.routes?.[0]?.geometry === 'string'
            ? data.routes[0].geometry
            : '';
    } catch (error) {
        logger.warn(`OSRM polyline fallback failed: ${error.message}`);
        return '';
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Fetches an encoded polyline from Google Directions API.
 * This should be called ONLY ONCE per order assignment to save costs.
 * @param {Object} origin - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @returns {Promise<string>} - Encoded polyline points
 */
export async function fetchPolyline(origin, destination) {
    const apiKey = config.googleMapsApiKey;
    if (!apiKey) {
        logger.warn('Google Maps API key missing. Using OSRM polyline fallback.');
        return fetchOsrmPolyline(origin, destination);
    }

    let timeout;
    try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 5000);
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = `${destination.lat},${destination.lng}`;
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${apiKey}`;

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();

        if (data.status === 'OK' && data.routes?.length > 0) {
            return data.routes[0].overview_polyline?.points || '';
        } else {
            logger.warn(`Google Directions API returned status: ${data.status}. Message: ${data.error_message || 'No routes found'}`);
        }
    } catch (err) {
        logger.error(`Error fetching polyline from Google: ${err.message}`);
    } finally {
        if (timeout) clearTimeout(timeout);
    }

    return fetchOsrmPolyline(origin, destination);
}
