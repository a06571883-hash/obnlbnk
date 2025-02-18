
import { useState, useEffect } from 'react';

interface GyroscopeData {
  beta: number;
  gamma: number;
}

export function useGyroscope() {
  const [rotation, setRotation] = useState<GyroscopeData | null>(null);

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      setRotation({
        beta: event.beta,
        gamma: event.gamma
      });
    };

    if (typeof window !== 'undefined' && typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation, true);

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      };
    }
  }, []);

  return rotation;
}
