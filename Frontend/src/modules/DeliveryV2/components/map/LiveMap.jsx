import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  GoogleMap, 
  Marker, 
  DirectionsService, 
  Polygon,
  Polyline,
  useJsApiLoader,
  OverlayView
} from '@react-google-maps/api';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { zoneAPI } from '@food/api';
import { useGoogleMapsApiKey } from '@food/utils/googleMapsApiKey';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  inset: 0
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: true,
  fullscreenControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] }
  ]
};
const LIBRARIES = ['places', 'geometry'];

const MapLoadingPlaceholder = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const LiveMapCanvas = ({ googleMapsApiKey, onMapClick, onMapLoad, onPathReceived, onPolylineReceived, zoom = 12, isSimMode = false }) => {
  const { riderLocation, activeOrder, tripStatus } = useDeliveryStore();

  const { isLoaded, loadError } = useJsApiLoader(
    {
      id: 'delivery-live-map',
      googleMapsApiKey,
      libraries: LIBRARIES,
    },
    [googleMapsApiKey],
  );

  const [directions, setDirections] = useState(null);
  const [fallbackRoutePath, setFallbackRoutePath] = useState([]);
  const [baselineDirections, setBaselineDirections] = useState(null);
  const [baselineFailed, setBaselineFailed] = useState(false);
  const [map, setMapInternal] = useState(null);
  const [zones, setZones] = useState([]);
  const [lastDirectionsAt, setLastDirectionsAt] = useState(0);
  const fallbackRequestRef = useRef({ key: '', at: 0, inFlight: false });

  const handleMapLoad = (mapInstance) => {
    mapInstance.setOptions({
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: true, // Enabled for front-view navigation
      fullscreenControl: false,
      tilt: 45, // 3D Perspective
    });
    setMapInternal(mapInstance);
    if (onMapLoad) {
      setTimeout(() => {
        onMapLoad(mapInstance);
      }, 0);
    }
  };

  useEffect(() => {
    setLastDirectionsAt(0);
    setDirections(null);
    setFallbackRoutePath([]);
    setBaselineDirections(null);
    setBaselineFailed(false);
  }, [tripStatus, activeOrder?._id]);

  const parsePoint = useCallback((raw) => {
    if (!raw) return null;
    const lat = parseFloat(raw.lat ?? raw.latitude);
    const lng = parseFloat(raw.lng ?? raw.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
  }, []);

  const toLatLng = useCallback((p) => {
    if (!p || !window.google?.maps?.LatLng) return null;
    try {
      if (p instanceof window.google.maps.LatLng) return p;
      const lat = typeof p.lat === 'function' ? p.lat() : (p.lat ?? p.latitude);
      const lng = typeof p.lng === 'function' ? p.lng() : (p.lng ?? p.longitude);
      return new window.google.maps.LatLng(lat, lng);
    } catch {
      return null;
    }
  }, []);

  const restaurantPoint = useMemo(() => parsePoint(activeOrder?.restaurantLocation), [activeOrder?.restaurantLocation, parsePoint]);
  const customerPoint = useMemo(() => parsePoint(activeOrder?.customerLocation), [activeOrder?.customerLocation, parsePoint]);

  const targetLocation = useMemo(() => {
    if (!activeOrder) return null;
    let rawLoc = null;
    if (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') {
      rawLoc = activeOrder.restaurantLocation;
    } else if (tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') {
      rawLoc = activeOrder.customerLocation;
    }
    if (!rawLoc) return null;
    return parsePoint(rawLoc);
  }, [activeOrder, tripStatus, parsePoint]);

  const parsedRiderLocation = useMemo(() => {
    if (!riderLocation) return null;
    const lat = parseFloat(riderLocation.lat || riderLocation.latitude);
    const lng = parseFloat(riderLocation.lng || riderLocation.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng, heading: parseFloat(riderLocation.heading || 0) } : null;
  }, [riderLocation]);

  const fullRoutePath = useMemo(() => {
    const googlePath = directions?.routes?.[0]?.overview_path;
    return googlePath?.length ? googlePath : fallbackRoutePath;
  }, [directions, fallbackRoutePath]);

  useEffect(() => { if (map) map.setZoom(zoom); }, [zoom, map]);

  const isOffCurrentRoute = useMemo(() => {
    if (!fullRoutePath.length || !parsedRiderLocation || !window.google?.maps?.geometry) return false;
    const fullPath = fullRoutePath;
    if (!fullPath?.length) return false;

    const riderLatLng = new window.google.maps.LatLng(
      parsedRiderLocation.lat,
      parsedRiderLocation.lng,
    );
    let minDistance = Infinity;
    for (let i = 0; i < fullPath.length; i += 1) {
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
        riderLatLng,
        toLatLng(fullPath[i]),
      );
      if (distance < minDistance) minDistance = distance;
    }
    return minDistance > 100;
  }, [fullRoutePath, parsedRiderLocation, toLatLng]);

  const shouldUpdateRoute = useMemo(() => {
    if (isSimMode && directions) return false;
    const now = Date.now();
    if (!directions && lastDirectionsAt === 0) return true;
    if (isOffCurrentRoute) return true;

    let throttleMs = 20000;
    if (parsedRiderLocation && targetLocation && window.google) {
      try {
        const p1 = new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng);
        const p2 = new window.google.maps.LatLng(targetLocation.lat, targetLocation.lng);
        const dist = window.google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        if (dist > 2000) throttleMs = 60000;
        else if (dist > 500) throttleMs = 20000;
        else throttleMs = 5000;
      } catch (e) {}
    }
    return (now - lastDirectionsAt) >= throttleMs;
  }, [lastDirectionsAt, directions, parsedRiderLocation, targetLocation, isOffCurrentRoute, isSimMode]);

  useEffect(() => {
    if (!fullRoutePath.length || !onPathReceived) return;
    const simplePath = fullRoutePath.map(p => ({
      lat: typeof p.lat === 'function' ? p.lat() : (p.lat ?? p.latitude),
      lng: typeof p.lng === 'function' ? p.lng() : (p.lng ?? p.longitude)
    }));
    setTimeout(() => onPathReceived(simplePath), 0);
  }, [fullRoutePath, onPathReceived]);

  const loadFallbackRoute = useCallback(async () => {
    if (!parsedRiderLocation || !targetLocation) return;

    // Keep navigation usable even when Google Directions is disabled/rejected.
    // A direct line is shown immediately, then replaced by an OSRM road route.
    const directPath = [parsedRiderLocation, targetLocation];
    setFallbackRoutePath((currentPath) =>
      currentPath.length >= 2 ? currentPath : directPath,
    );

    const requestKey = [
      parsedRiderLocation.lat.toFixed(3),
      parsedRiderLocation.lng.toFixed(3),
      targetLocation.lat.toFixed(5),
      targetLocation.lng.toFixed(5),
    ].join(':');
    const now = Date.now();
    const previousRequest = fallbackRequestRef.current;
    if (
      (previousRequest.inFlight && previousRequest.key === requestKey) ||
      (previousRequest.key === requestKey && now - previousRequest.at < 15000)
    ) {
      return;
    }
    fallbackRequestRef.current = { key: requestKey, at: now, inFlight: true };

    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 8000);
      const coordinates = `${parsedRiderLocation.lng},${parsedRiderLocation.lat};${targetLocation.lng},${targetLocation.lat}`;
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,
        { signal: controller.signal },
      );
      window.clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Fallback route HTTP ${response.status}`);
      const payload = await response.json();
      const routeCoordinates = payload?.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) return;

      const roadPath = routeCoordinates
        .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      if (roadPath.length < 2) return;
      if (fallbackRequestRef.current.key !== requestKey) return;

      setFallbackRoutePath(roadPath);
      const encoded = window.google?.maps?.geometry?.encoding?.encodePath?.(roadPath);
      if (encoded && onPolylineReceived) onPolylineReceived(encoded);
    } catch (error) {
      console.warn('[LiveMap] Road route unavailable; using direct route line.', error);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (fallbackRequestRef.current.key === requestKey) {
        fallbackRequestRef.current.inFlight = false;
      }
    }
  }, [parsedRiderLocation, targetLocation, onPolylineReceived]);

  // Some Android WebViews never invoke the Google Directions callback when the
  // API request is blocked. Start the independent fallback immediately so the
  // rider always sees at least a direct route line, then a road route when OSRM responds.
  useEffect(() => {
    if (!parsedRiderLocation || !targetLocation || directions) return;
    void loadFallbackRoute();
  }, [parsedRiderLocation, targetLocation, directions, loadFallbackRoute]);

  const directionsCallback = useCallback((result, status) => {
    // Always update lastDirectionsAt to prevent infinite loop on failure
    setLastDirectionsAt(Date.now());
    if (status === 'OK' && result) {
      setDirections(result);
      setFallbackRoutePath([]);
      const rawPolyline = result.routes?.[0]?.overview_polyline;
      const encodedPolyline =
        typeof rawPolyline === 'string' ? rawPolyline : rawPolyline?.points || '';
      if (encodedPolyline && onPolylineReceived) {
        setTimeout(() => {
          onPolylineReceived(encodedPolyline);
        }, 0);
      }
    } else {
      setDirections(null);
      loadFallbackRoute();
    }
  }, [onPolylineReceived, loadFallbackRoute]);

  const baselineDirectionsCallback = useCallback((result, status) => {
    if (status === 'OK' && result) {
      setBaselineDirections(result);
    } else {
      setBaselineFailed(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await zoneAPI.getPublicZones();
        if (response?.data?.success && response.data.data?.zones) {
          const formattedZones = response.data.data.zones.map(zone => ({
            ...zone,
            paths: (zone.coordinates || []).map(coord => ({ lat: coord.latitude, lng: coord.longitude }))
          })).filter(z => z.paths.length >= 3);
          setZones(formattedZones);
        }
      } catch (err) {}
    })();
  }, []);

  const restaurantMarkerUrl = useMemo(() => {
    if (!activeOrder) return 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
    return activeOrder.restaurantImage || activeOrder.restaurant?.logo || activeOrder.restaurant?.profileImage || 'https://cdn-icons-png.flaticon.com/512/3170/3170733.png';
  }, [activeOrder]);

  const customerMarkerUrl = useMemo(() => {
    if (!activeOrder) return 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
    return activeOrder.customerImage || activeOrder.user?.logo || activeOrder.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png';
  }, [activeOrder]);

  const lastCenteredPosRef = useRef(null);
  const lastBoundsUpdateRef = useRef(0);
  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const hasAnchors = restaurantPoint || customerPoint;
    if (!hasAnchors && !parsedRiderLocation) return;

    const now = Date.now();
    if (now - lastBoundsUpdateRef.current < 12000) return;
    lastBoundsUpdateRef.current = now;

    if (!hasAnchors && parsedRiderLocation) {
      map.panTo(parsedRiderLocation);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      if (restaurantPoint) bounds.extend(restaurantPoint);
      if (customerPoint) bounds.extend(customerPoint);
      if (parsedRiderLocation) bounds.extend(parsedRiderLocation);

      map.fitBounds(bounds, { top: 70, right: 70, bottom: 120, left: 70 });
    }

    if (parsedRiderLocation) {
      lastCenteredPosRef.current = parsedRiderLocation;
    }
  }, [map, parsedRiderLocation, restaurantPoint, customerPoint]);

  const { remainingPath, traveledPath } = useMemo(() => {
    if (!fullRoutePath.length || !parsedRiderLocation || !window.google?.maps) return { remainingPath: [], traveledPath: [] };
    
    const fullPath = fullRoutePath;
    if (!fullPath || fullPath.length === 0) return { remainingPath: [], traveledPath: [] };

    let closestIndex = 0;
    let minDistance = Infinity;
    const riderLatLng = new window.google.maps.LatLng(parsedRiderLocation.lat, parsedRiderLocation.lng);

    for (let i = 0; i < fullPath.length; i++) {
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(riderLatLng, toLatLng(fullPath[i]));
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    let startIndex = closestIndex;
    if (closestIndex < fullPath.length - 1) {
      const distToCurrent = window.google.maps.geometry.spherical.computeDistanceBetween(riderLatLng, toLatLng(fullPath[closestIndex]));
      const distToNext = window.google.maps.geometry.spherical.computeDistanceBetween(riderLatLng, toLatLng(fullPath[closestIndex + 1]));
      const segmentLen = window.google.maps.geometry.spherical.computeDistanceBetween(toLatLng(fullPath[closestIndex]), toLatLng(fullPath[closestIndex + 1]));
      
      if (distToNext < segmentLen && distToNext < distToCurrent) {
        startIndex = closestIndex + 1;
      }
    }

    const riderPoint = { lat: parsedRiderLocation.lat, lng: parsedRiderLocation.lng };
    const toObj = (p) => ({
      lat: typeof p.lat === 'function' ? p.lat() : p.lat,
      lng: typeof p.lng === 'function' ? p.lng() : p.lng
    });

    const traveled = fullPath.slice(0, startIndex).map(toObj);
    traveled.push(riderPoint);

    const remaining = [riderPoint, ...fullPath.slice(startIndex).map(toObj)];

    return { remainingPath: remaining, traveledPath: traveled };
  }, [fullRoutePath, parsedRiderLocation, toLatLng]);

  if (loadError) return <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-red-500 font-bold">Map Load Error</div>;
  if (!isLoaded) return <MapLoadingPlaceholder />;

  const directionsServiceOptions = (parsedRiderLocation && targetLocation) ? {
    origin: parsedRiderLocation,
    destination: targetLocation,
    travelMode: 'DRIVING',
  } : null;

  const baselineServiceOptions = (restaurantPoint && customerPoint) ? {
    origin: restaurantPoint,
    destination: customerPoint,
    travelMode: 'DRIVING',
  } : null;

  const defaultCenter = { lat: 22.7196, lng: 75.8577 }; // Center on Indore as fallback

  return (
    <div className="absolute inset-0 z-0 text-gray-900 overflow-hidden flex flex-col">
      <GoogleMap
        onLoad={handleMapLoad}
        mapContainerStyle={mapContainerStyle}
        center={parsedRiderLocation || targetLocation || defaultCenter}
        zoom={zoom}
        heading={parsedRiderLocation?.heading || 0}
        tilt={45}
        onClick={(e) => onMapClick?.(e.latLng.lat(), e.latLng.lng())}
        options={mapOptions}
      >
        {directionsServiceOptions && shouldUpdateRoute && (
          <DirectionsService options={directionsServiceOptions} callback={directionsCallback} />
        )}

        {baselineServiceOptions && !baselineDirections && !baselineFailed && (
          <DirectionsService options={baselineServiceOptions} callback={baselineDirectionsCallback} />
        )}

        {traveledPath.length > 0 && (
          <Polyline 
            path={traveledPath} 
            options={{ 
              strokeColor: '#9ca3af', 
              strokeOpacity: 0.5, 
              strokeWeight: 4, 
              zIndex: 10,
              icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                offset: '0',
                repeat: '10px'
              }]
            }} 
          />
        )}

        {remainingPath.length > 0 && (
          <Polyline 
            path={remainingPath} 
            options={{ 
              strokeColor: '#3b82f6', 
              strokeOpacity: 0.9, 
              strokeWeight: 8, 
              zIndex: 12 
            }} 
          />
        )}

        {parsedRiderLocation && (
          <OverlayView position={parsedRiderLocation} mapPaneName={OverlayView.MARKER_LAYER}>
            <div style={{ transform: `translate(-50%, -50%) rotate(${parsedRiderLocation.heading || 0}deg)`, transition: 'transform 0.5s linear' }} className="relative w-[72px] h-[72px]">
              <img src="/MapRider.png" alt="Rider" className="w-full h-full object-contain" />
            </div>
          </OverlayView>
        )}

        {restaurantPoint && (
          <Marker
            position={restaurantPoint}
            icon={{
              url: restaurantMarkerUrl,
              scaledSize: (typeof window !== 'undefined' && window.google?.maps?.Size) ? new window.google.maps.Size(44, 44) : undefined,
              anchor: (typeof window !== 'undefined' && window.google?.maps?.Point) ? new window.google.maps.Point(22, 22) : undefined
            }}
          />
        )}

        {customerPoint && (
          <Marker
            position={customerPoint}
            icon={{
              url: customerMarkerUrl,
              scaledSize: (typeof window !== 'undefined' && window.google?.maps?.Size) ? new window.google.maps.Size(44, 44) : undefined,
              anchor: (typeof window !== 'undefined' && window.google?.maps?.Point) ? new window.google.maps.Point(22, 22) : undefined
            }}
          />
        )}

        {zones.map((zone) => (
          <Polygon key={zone._id} paths={zone.paths} options={{ fillColor: "#22c55e", fillOpacity: 0.03, strokeColor: "#22c55e", strokeOpacity: 0.1, strokeWeight: 1, zIndex: 1 }} />
        ))}
      </GoogleMap>

    </div>
  );
};

export const LiveMap = (props) => {
  const googleMapsApiKey = useGoogleMapsApiKey();

  // Never initialize the Google loader with a placeholder key. On slower/new
  // devices that permanently cached a failed loader and Directions never ran.
  if (!googleMapsApiKey) return <MapLoadingPlaceholder />;

  return <LiveMapCanvas {...props} googleMapsApiKey={googleMapsApiKey} />;
};

export default LiveMap;
