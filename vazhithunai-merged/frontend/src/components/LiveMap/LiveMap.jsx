/**
 * LiveMap.jsx
 * Feature: Live Tracking
 * Renders the locked "Optimal Route" polyline plus the driver's live GPS
 * marker. Swap the <svg> mini-map below for a real Google Maps / Mapbox GL
 * <div> mount once an API key is wired in — the data shape (polyline +
 * position) stays the same either way, so only this component changes.
 */

import { useEffect, useState } from 'react';
import { getLockedRoute } from '../../services/api';
import { useLiveLocation } from '../../hooks/useLiveLocation';
import './LiveMap.css';

function projectToSvg(points, width, height, padding = 20) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  return points.map((p) => {
    const x = padding + ((p.lng - minLng) / (maxLng - minLng || 1)) * (width - 2 * padding);
    const y = height - padding - ((p.lat - minLat) / (maxLat - minLat || 1)) * (height - 2 * padding);
    return { x, y };
  });
}

export default function LiveMap({ rideId }) {
  const [route, setRoute] = useState(null);
  const { position, deviationFlagged } = useLiveLocation(rideId);

  useEffect(() => {
    if (!rideId) return;
    getLockedRoute(rideId).then(setRoute).catch(() => setRoute(null));
  }, [rideId]);

  if (!route) {
    return <div className="live-map live-map--empty">Waiting for route lock…</div>;
  }

  const width = 360;
  const height = 240;
  const routeSvgPoints = projectToSvg(route.polyline, width, height);
  const pathD = routeSvgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const driverSvgPoint = position
    ? projectToSvg([...route.polyline, position], width, height).pop()
    : null;

  return (
    <div className="live-map">
      <svg viewBox={`0 0 ${width} ${height}`} className="live-map__svg">
        <path d={pathD} className="live-map__route" />
        <circle
          cx={routeSvgPoints[0].x}
          cy={routeSvgPoints[0].y}
          r="6"
          className="live-map__pin live-map__pin--origin"
        />
        <circle
          cx={routeSvgPoints[routeSvgPoints.length - 1].x}
          cy={routeSvgPoints[routeSvgPoints.length - 1].y}
          r="6"
          className="live-map__pin live-map__pin--dest"
        />
        {driverSvgPoint && (
          <circle
            cx={driverSvgPoint.x}
            cy={driverSvgPoint.y}
            r="7"
            className={`live-map__driver ${deviationFlagged ? 'live-map__driver--alert' : ''}`}
          />
        )}
      </svg>

      <div className="live-map__meta">
        <span>Optimal route locked · {route.distanceKm} km</span>
        {deviationFlagged && (
          <span className="live-map__deviation-badge">Route deviation detected</span>
        )}
      </div>
    </div>
  );
}
