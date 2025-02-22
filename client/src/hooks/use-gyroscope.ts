import { useState, useEffect } from 'react';

interface GyroscopeData {
  beta: number;
  gamma: number;
}

type PermissionState = 'granted' | 'denied' | 'prompt';

export function useGyroscope() {
  const [rotation, setRotation] = useState<GyroscopeData | null>(null);
  const [permission, setPermission] = useState<PermissionState>('prompt');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;

    let animationFrameId: number;
    let lastUpdate = 0;
    const minUpdateInterval = 16; // ~60fps

    const requestPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          setPermission(permissionState);
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (error) {
          console.error('Error requesting device orientation permission:', error);
        }
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdate < minUpdateInterval) return;
      lastUpdate = now;

      if (event.beta === null || event.gamma === null) return;

      // Ограничиваем значения для более плавной анимации
      const beta = Math.max(-45, Math.min(45, event.beta));
      const gamma = Math.max(-45, Math.min(45, event.gamma));

      // Используем requestAnimationFrame для плавной анимации
      animationFrameId = requestAnimationFrame(() => {
        setRotation({
          beta: beta * 0.7, // Увеличиваем чувствительность
          gamma: gamma * 0.7
        });
      });
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return rotation;
}