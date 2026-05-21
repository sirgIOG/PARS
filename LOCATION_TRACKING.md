# Real-Time Ambulance Location Tracking & ETA System

## Overview
The system now includes real-time ambulance location tracking with automatic ETA calculation to the hospital destination.

## Features

### 1. **Ambulance Location Tracking (AmbulancePage)**
- **Start/Stop Tracking Button**: Paramedic can initiate GPS location tracking
- **Real-time Location Updates**: Location is sent to server via WebSocket every 5 seconds
- **Display Current Coordinates**: Shows latitude and longitude in decimal format
- **Tracking Status Indicator**: Visual indicator showing if tracking is active

### 2. **ETA Calculation (HospitalPage)**
- **Distance Calculation**: Uses Haversine formula to calculate real distance between ambulance and hospital
- **ETA in Minutes**: Calculates estimated arrival time based on:
  - Current distance from hospital
  - Average ambulance speed (default: 60 km/h in traffic)
  - Formula: ETA = (Distance / Speed) * 60 minutes
- **Live Updates**: ETA updates automatically as ambulance location changes

### 3. **Hospital Dashboard Display**
- **Ambulance Details Card**: Shows driver name, phone, ambulance ID, number plate
- **Live Distance**: Current distance from hospital in km or meters
- **ETA Highlight**: Prominent display of estimated arrival time in minutes
- **Coordinate Display**: Precise lat/lng for verification

## Technical Implementation

### Frontend Components

#### `locationUtils.js`
Utility functions for location calculations:
- `calculateDistance(lat1, lon1, lat2, lon2)`: Haversine formula implementation
- `calculateETA(distanceKm, avgSpeed)`: ETA calculation
- `getCurrentLocation()`: Get user's current position via Geolocation API
- `watchLocation(callback)`: Continuously track location updates
- `formatDistance(distanceKm)`: Format distance for display

#### `AmbulancePage.jsx`
- State: `currentLocation`, `isTrackingLocation`, `locationWatchId`
- Functions:
  - `startLocationTracking()`: Initiate GPS and WebSocket broadcasts
  - `stopLocationTracking()`: Stop GPS watching
- Socket events emitted: `ambulanceLocation`

#### `HospitalPage.jsx`
- State: `ambulanceLocations` (map of ambulance IDs to coordinates)
- Functions: `getAmbulanceETA()` - calculates ETA for each ambulance
- Socket events received: `ambulanceLocationUpdate`

### Backend Components

#### `socket.js`
- Maintains `ambulanceLocations` Map in memory
- Events:
  - `ambulanceLocation`: Receives and broadcasts location updates
  - `ambulanceLocationUpdate`: Emitted to all hospital dashboards
  - `getAmbulanceLocations`: Returns all active ambulance locations

### WebSocket Events

#### Emitted from Ambulance:
```javascript
socket.emit('ambulanceLocation', {
    ambulanceId: '5f7d3c1a9c8b0e2a5f1d3c1a',
    lat: 28.7041,
    lng: 77.1025,
    timestamp: new Date()
});
```

#### Received at Hospital:
```javascript
socket.on('ambulanceLocationUpdate', {
    ambulanceId: '5f7d3c1a9c8b0e2a5f1d3c1a',
    lat: 28.7041,
    lng: 77.1025,
    timestamp: new Date()
});
```

## Default Hospital Location
```javascript
{
    lat: 28.7041,
    lng: 77.1025,
    name: "Central Hospital"
}
```
Currently set to Delhi, India. Can be configured per hospital.

## Location Permission Requirements
- Browser must request location permission from user
- User must grant "Allow" permission for location access
- HTTPS required in production (Geolocation API requirement)
- Localhost works in development

## ETA Accuracy
The ETA calculation assumes:
- Straight-line distance (great-circle distance)
- Average 60 km/h speed (including traffic)
- No traffic incidents or delays
- For production, consider integrating with Google Maps Distance Matrix API for real-time traffic data

## Distance Format
- < 1 km: Displayed in meters (e.g., "450m")
- >= 1 km: Displayed in kilometers (e.g., "2.3km")

## Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 13.3+)
- Internet Explorer: Not supported

## Future Enhancements
1. Google Maps/Leaflet integration for visual map display
2. Traffic-aware ETA using real-time APIs
3. Multiple hospital locations with routing
4. Historical location tracking for audit
5. Push notifications when ambulance is 5 mins away
6. Real-time speed display
7. Route optimization
