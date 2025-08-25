// Полная типизация Telegram WebApp API
interface TelegramWebApp {
  initData: string;
  colorScheme: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  sendData: (data: any) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  setBackgroundColor: (color: string) => void;
  backgroundColor?: string;
  initDataUnsafe?: any;
  version?: string;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  showPopup: (params: any, callback: (id: string) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    setParams: (params: any) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

// Объявляем глобальный тип только если его еще нет
declare global {
  interface Window {
    TelegramWebApp?: TelegramWebApp;
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Проверяет, запущено ли приложение в Telegram WebApp
 * @returns {boolean} true, если приложение запущено в Telegram WebApp
 */
export const isTelegramWebApp = (): boolean => {
  // Для тестирования мы можем использовать URL параметр ?telegram=1
  if (typeof window !== 'undefined' && window.location.search.includes('telegram=1')) {
    console.log('Telegram WebApp эмуляция включена через URL параметр');
    return true;
  }
  
  return typeof window !== 'undefined' && 
         window.Telegram !== undefined && 
         window.Telegram.WebApp !== undefined;
};

/**
 * Получает параметры Telegram WebApp
 * @returns {any} Объект с параметрами или null, если не запущено в Telegram
 */
export const getTelegramWebAppParams = (): any => {
  if (!isTelegramWebApp()) return null;
  
  // Для режима эмуляции возвращаем мок-данные
  if (window.location.search.includes('telegram=1')) {
    return {
      colorScheme: 'light',
      isExpanded: true,
      viewportHeight: window.innerHeight,
      viewportStableHeight: window.innerHeight, 
      initDataRaw: 'emulation_mode'
    };
  }
  
  try {
    // В реальном режиме Telegram получаем данные из WebApp API
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return null;
    
    return {
      colorScheme: webApp.colorScheme || 'light',
      isExpanded: webApp.isExpanded || false,
      viewportHeight: webApp.viewportHeight || window.innerHeight,
      viewportStableHeight: webApp.viewportStableHeight || window.innerHeight,
      initDataRaw: webApp.initData || ''
    };
  } catch (error) {
    console.error('Ошибка при получении параметров Telegram WebApp:', error);
    return null;
  }
};

/**
 * Отображает уведомление в Telegram WebApp
 * @param {string} message Текст уведомления
 */
export const showTelegramAlert = (message: string): void => {
  if (!isTelegramWebApp()) return;
  
  // В режиме эмуляции используем стандартный alert
  if (window.location.search.includes('telegram=1')) {
    alert(message);
    return;
  }
  
  try {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.showAlert(message);
    } else {
      alert(message);
    }
  } catch (error) {
    console.error('Ошибка при отображении уведомления Telegram:', error);
    // Запасной вариант на случай ошибки
    alert(message);
  }
};

/**
 * Инициализирует Telegram WebApp
 */
export const initTelegramWebApp = (): void => {
  if (!isTelegramWebApp()) return;
  
  // В режиме эмуляции просто логируем событие
  if (window.location.search.includes('telegram=1')) {
    console.log('Telegram WebApp эмуляция инициализирована');
    return;
  }
  
  try {
    // Сообщаем Telegram, что WebApp готов
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    
    webApp.ready();
    
    // Расширяем WebApp на весь экран
    if (!webApp.isExpanded) {
      webApp.expand();
    }
    
    console.log('Telegram WebApp инициализирован');
  } catch (error) {
    console.error('Ошибка при инициализации Telegram WebApp:', error);
  }
};

export default {
  isTelegramWebApp,
  getTelegramWebAppParams,
  showTelegramAlert,
  initTelegramWebApp
};