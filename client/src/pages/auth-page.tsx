import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, newUserRegistrationSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Shield, Globe, Wallet, MessageSquare } from "lucide-react";
import { LogoFull } from "@/components/logo";
import AnimatedBackground from "@/components/animated-background";
import { useEffect } from 'react';
import { playSoundIfEnabled } from "@/lib/sound-service";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const auth = useAuth();

  useEffect(() => {
    if (auth.user) {
      navigate("/");
    }
  }, [auth.user, navigate]);

  return (
    <div className="relative min-h-screen grid lg:grid-cols-2">
      <AnimatedBackground />

      <div className="relative flex items-center justify-center p-8">
        <Card className="w-full max-w-md backdrop-blur-sm bg-background/80 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex justify-center mb-8">
              <LogoFull />
            </div>

            <Tabs defaultValue="login" className="animate-in fade-in-50">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Вход</TabsTrigger>
                <TabsTrigger value="register">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <LoginForm />
              </TabsContent>

              <TabsContent value="register">
                <RegisterForm />
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Забыли данные для входа? Напишите в поддержку для восстановления данных. Регулятор предоставит вам ваш пароль.
              </p>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => window.open('https://t.me/OOO_BNAL_BANK', '_blank')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Написать в Telegram
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex relative flex-col justify-center p-12 bg-primary text-primary-foreground overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto">
          <LogoFull className="mb-8 w-48" />
          <h1 className="text-4xl font-bold mb-6">OOO BNAL BANK</h1>
          <p className="text-xl mb-12 text-primary-foreground/90">
            Ваш надёжный партнёр в мире современных финансовых технологий
          </p>

          <div className="space-y-8">
            <Feature
              icon={Shield}
              title="Безопасность на высшем уровне"
              description="Все транзакции защищены современными методами шифрования"
            />
            <Feature
              icon={Globe}
              title="Поддержка криптовалют"
              description="Полная интеграция с основными криптовалютами"
            />
            <Feature
              icon={Wallet}
              title="Мультивалютные операции"
              description="Поддержка основных мировых валют и мгновенные переводы"
            />
          </div>

          <div className="mt-12 text-primary-foreground/80">
            <p>Поддержка 24/7</p>
            <p>Telegram: @OOO_BNAL_BANK</p>
          </div>
        </div>

        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm" />
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="p-2 rounded-lg bg-primary-foreground/10 backdrop-blur-sm">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="font-semibold text-lg group-hover:text-white transition-colors">{title}</h3>
        <p className="text-primary-foreground/80">{description}</p>
      </div>
    </div>
  );
}

function LoginForm() {
  const { loginMutation } = useAuth();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      is_regulator: false,
      regulator_balance: "0"
    },
  });

  const onSubmit = async (data: any) => {
    try {
      loginMutation.mutate(data, {
        onSuccess: () => {
          playSoundIfEnabled('success');
        },
        onError: () => {
          playSoundIfEnabled('error');
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      playSoundIfEnabled('error');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        {loginMutation.isError && (
          <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">
            Ошибка авторизации: неправильное имя пользователя или пароль
          </div>
        )}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя пользователя</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  className="bg-background/50" 
                  placeholder="Введите имя пользователя"
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  {...field} 
                  className="bg-background/50" 
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={loginMutation.isPending || form.formState.isSubmitting}
        >
          {(loginMutation.isPending || form.formState.isSubmitting) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Войти
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm({
    resolver: zodResolver(newUserRegistrationSchema), 
    defaultValues: {
      username: "",
      password: "",
      is_regulator: false,
      regulator_balance: "0",
      nft_generation_count: 0
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await registerMutation.mutateAsync(data, {
        onSuccess: () => {
          sessionStorage.setItem('isNewRegistration', 'true');
          playSoundIfEnabled('success');
        },
        onError: (error: any) => {
          const errorMessage = error.response?.data?.message || "Registration failed";
          form.setError('root', { message: errorMessage });
          playSoundIfEnabled('error');
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      playSoundIfEnabled('error');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="bg-primary/5 rounded-lg p-3 mb-4 text-xs text-muted-foreground border border-primary/10">
          <h3 className="font-semibold text-sm mb-1 text-primary">Правила регистрации:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Имя пользователя: 3-20 символов, только латинские буквы, цифры и знак подчеркивания (_)</li>
            <li>Пароль: минимум 6 символов, обязательна хотя бы одна заглавная буква и одна цифра</li>
          </ul>
        </div>

        {form.formState.errors.root && (
          <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">
            {form.formState.errors.root.message}
          </div>
        )}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя пользователя</FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  className="bg-background/50" 
                  placeholder="Введите имя пользователя"
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  {...field} 
                  className="bg-background/50" 
                  placeholder="Введите пароль"
                  autoComplete="new-password"
                />
              </FormControl>
              <FormMessage className="text-red-500" />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={registerMutation.isPending || form.formState.isSubmitting}
        >
          {(registerMutation.isPending || form.formState.isSubmitting) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Зарегистрироваться
        </Button>
      </form>
    </Form>
  );
}
