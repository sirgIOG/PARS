/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Calculate ETA in minutes based on distance
 * Average ambulance speed: 60 km/h in traffic, 80 km/h on highway
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} averageSpeed - Average speed in km/h (default: 60)
 * @returns {number} ETA in minutes
 */
export const calculateETA = (distanceKm, averageSpeed = 60) => {
    if (!distanceKm || distanceKm < 0) return 0;
    const timeInHours = distanceKm / averageSpeed;
    const timeInMinutes = Math.ceil(timeInHours * 60);
    return Math.max(1, timeInMinutes); // Minimum 1 minute
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
        return `${(distanceKm * 1000).toFixed(0)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
};

/**
 * Get current user location using Geolocation API
 * @returns {Promise} Promise resolving to {lat, lng}
 */
export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                reject(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    });
};

/**
 * Watch user location continuously
 * @param {function} callback - Function to call with location updates
 * @returns {number} Watch ID for stopping later
 */
export const watchLocation = (callback) => {
    if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return null;
    }

    return navigator.geolocation.watchPosition(
        (position) => {
            callback({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date()
            });
        },
        (error) => {
            console.error('Error watching location:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
};

/**
 * Stop watching location
 * @param {number} watchId - Watch ID returned from watchLocation
 */
export const stopWatchingLocation = (watchId) => {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
    }
};

// Default RVITM-area hospital location (used as a fallback only;
// real hospital coords come from the assigned hospital record).
export const HOSPITAL_LOCATION = {
    lat: 12.9116,
    lng: 77.5006,
    name: "RVITM Reference Hospital"
};

// RVITM Bangalore reference center — used as default map center
export const RVITM_CENTER = {
    lat: 12.9116,
    lng: 77.5006,
    name: "RVITM Bengaluru"
};
