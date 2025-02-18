import { useState, useEffect } from 'react';

interface GyroscopeData {
  beta: number;  // x-axis rotation (-180 to 180)
  gamma: number; // y-axis rotation (-90 to 90)
}

export function useGyroscope() {
  const [rotation, setRotation] = useState<GyroscopeData>({ beta: 0, gamma: 0 });

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      // Normalize values to create smooth animation
      const normalizedBeta = Math.min(Math.max(event.beta, -45), 45) / 3;
      const normalizedGamma = Math.min(Math.max(event.gamma, -45), 45) / 3;

      setRotation({
        beta: normalizedBeta,
        gamma: normalizedGamma
      });
    };

    // Add event listener without permission check for now
    // since DeviceOrientationEvent.requestPermission is not widely supported
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return rotation;
}