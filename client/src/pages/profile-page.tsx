import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Shield,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Globe,
  Volume2,
  MessageSquare,
  Key
} from "lucide-react";
import AnimatedBackground from "@/components/animated-background";
import { useToast } from "@/hooks/use-toast";
import { SeedPhraseDisplay } from "@/components/seed-phrase";

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [language, setLanguage] = useState("ru");
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Load initial settings
  useEffect(() => {
    setNotifications(localStorage.getItem('notifications') === 'true');
    setSoundEnabled(localStorage.getItem('soundEnabled') === 'true');
    setLanguage(localStorage.getItem('language') || 'ru');
    const theme = localStorage.getItem('theme') || 'dark';
    setIsDarkMode(theme === 'dark');
  }, []);

  const updateSetting = async (key: string, value: any) => {
    try {
      switch(key) {
        case 'theme':
          const newTheme = value ? 'dark' : 'light';
          localStorage.setItem('theme', newTheme);
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(newTheme);
          setIsDarkMode(value);
          toast({
            title: value ? "Тёмная тема включена" : "Светлая тема включена",
            description: value ? "Приложение переключено на тёмную тему" : "Приложение переключено на светлую тему"
          });
          break;

        case 'notifications':
          if (value && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              localStorage.setItem('notifications', 'true');
              setNotifications(true);
              toast({
                title: "Уведомления включены",
                description: "Вы будете получать уведомления о важных событиях"
              });
            } else {
              localStorage.setItem('notifications', 'false');
              setNotifications(false);
              toast({
                title: "Ошибка",
                description: "Необходимо разрешить уведомления в браузере",
                variant: "destructive"
              });
            }
          } else {
            localStorage.setItem('notifications', 'false');
            setNotifications(false);
          }
          break;

        case 'language':
          localStorage.setItem('language', value);
          setLanguage(value);
          document.documentElement.setAttribute('lang', value);
          toast({
            title: value === 'ru' ? "Язык изменен" : "Language changed",
            description: value === 'ru' ? "Приложение теперь на русском языке" : "Application is now in English"
          });
          break;

        case 'soundEnabled':
          localStorage.setItem('soundEnabled', value.toString());
          setSoundEnabled(value);
          toast({
            title: value ? "Звуки включены" : "Звуки выключены",
            description: value ? "Звуковые эффекты активированы" : "Звуковые эффекты отключены"
          });
          break;
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить настройки",
        variant: "destructive"
      });
    }
  };

  const menuItems = [
    {
      icon: Settings,
      title: "Настройки",
      description: "Персонализация и предпочтения",
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                {isDarkMode ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
                <Label>Тема приложения</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Переключение между тёмной и светлой темой
              </p>
            </div>
            <Switch
              checked={isDarkMode}
              onCheckedChange={(checked) => updateSetting('theme', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Язык</Label>
            <select
              className="w-full p-2 rounded-md border bg-background"
              value={language}
              onChange={(e) => updateSetting('language', e.target.value)}
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Звуки</Label>
              <p className="text-sm text-muted-foreground">
                Звуковые эффекты в приложении
              </p>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={(checked) => updateSetting('soundEnabled', checked)}
            />
          </div>
        </div>
      )
    },
    {
      icon: Key,
      title: "Криптовалюты и Seed-фразы",
      description: "Управление криптокошельком и ключами восстановления",
      content: <SeedPhraseDisplay />
    },
    {
      icon: Shield,
      title: "Безопасность",
      description: "Настройки безопасности и аутентификации",
      content: (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Текущий пароль</Label>
            <Input type="password" placeholder="••••••••" />
          </div>

          <div className="space-y-2">
            <Label>Новый пароль</Label>
            <Input type="password" placeholder="••••••••" />
          </div>

          <div className="space-y-2">
            <Label>Подтвердите пароль</Label>
            <Input type="password" placeholder="••••••••" />
          </div>

          <Button className="w-full">Обновить пароль</Button>
        </div>
      )
    },
    {
      icon: Bell,
      title: "Уведомления",
      description: "Управление уведомлениями",
      content: (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push-уведомления</Label>
              <p className="text-sm text-muted-foreground">
                Получать push-уведомления
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={(checked) => updateSetting('notifications', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Email для уведомлений</Label>
            <Input type="email" placeholder="email@example.com" />
          </div>

          <div className="space-y-2">
            <Label>Типы уведомлений</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="transactions" defaultChecked />
                <label htmlFor="transactions">Транзакции</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="security" defaultChecked />
                <label htmlFor="security">Безопасность</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="news" defaultChecked />
                <label htmlFor="news">Новости и обновления</label>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      icon: HelpCircle,
      title: "Помощь",
      description: "Поддержка и информация",
      content: (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-medium">Связаться с поддержкой</h3>
            <p className="text-sm text-muted-foreground">
              Наша поддержка доступна 24/7 в Telegram
            </p>
            <Button
              className="w-full mt-2"
              onClick={() => window.open('https://t.me/OOO_BNAL_BANK', '_blank')}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Написать в Telegram
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Часто задаваемые вопросы</h3>
            <div className="space-y-2">
              <details className="cursor-pointer">
                <summary className="font-medium text-sm">Как пополнить счёт?</summary>
                <p className="text-sm text-muted-foreground mt-2">
                  Для пополнения счета выберите карту и нажмите кнопку "Пополнить".
                </p>
              </details>
              <details className="cursor-pointer">
                <summary className="font-medium text-sm">Как вывести средства?</summary>
                <p className="text-sm text-muted-foreground mt-2">
                  Для вывода средств обратитесь в поддержку через Telegram.
                </p>
              </details>
              <details className="cursor-pointer">
                <summary className="font-medium text-sm">Как работает криптокошелек?</summary>
                <p className="text-sm text-muted-foreground mt-2">
                  Криптокошелек поддерживает основные криптовалюты. Для операций используйте адреса в деталях карты.
                </p>
              </details>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <AnimatedBackground />

      <div className="bg-primary text-primary-foreground p-4 relative">
        <h1 className="text-xl font-bold mb-1">Профиль</h1>
        <p className="text-sm text-primary-foreground/80">Управление настройками аккаунта</p>
      </div>

      <div className="p-4 -mt-4 relative">
        <Card className="mb-6 backdrop-blur-sm bg-background/80">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-semibold text-primary">
                  {user?.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{user?.username}</h2>
                <p className="text-sm text-muted-foreground">Участник с 2025</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {menuItems.map((item) => (
            <Dialog key={item.title}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent transition-colors backdrop-blur-sm bg-background/80">
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>

              <DialogContent className="max-h-[95vh] overflow-y-auto w-[95vw] max-w-md p-4 pt-10 rounded-t-lg">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-base">{item.title}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {item.description}
                  </DialogDescription>
                </DialogHeader>
                {item.content}
              </DialogContent>
            </Dialog>
          ))}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}