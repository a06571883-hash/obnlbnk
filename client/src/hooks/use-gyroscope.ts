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
    // Проверяем, поддерживается ли гироскоп
    if (typeof window === 'undefined' || !window.DeviceOrientationEvent) return;

    const requestPermission = async () => {
      // Для iOS устройств требуется запрос разрешения
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          setPermission(permissionState);
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        } catch (error) {
          console.error('Error requesting device orientation permission:', error);
        }
      } else {
        // Для Android и других устройств разрешение не требуется
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;

      // Ограничиваем значения для более плавной анимации
      const beta = Math.max(-45, Math.min(45, event.beta));
      const gamma = Math.max(-45, Math.min(45, event.gamma));

      setRotation({
        beta: beta * 0.5, // Уменьшаем чувствительность
        gamma: gamma * 0.5
      });
    };

    requestPermission();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  return rotation;
}