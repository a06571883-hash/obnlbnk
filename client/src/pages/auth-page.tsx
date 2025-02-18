import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, Shield, Globe, Wallet } from "lucide-react";
import { LogoFull } from "@/components/logo";
import AnimatedBackground from "@/components/animated-background";
import { useEffect, useState } from 'react'; // Added import for useState and useEffect


export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const auth = useAuth();
  //const { toast } = useToast();  // Removed as useToast is not imported or used
  const [, navigate] = useLocation();

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
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex relative flex-col justify-center p-12 bg-primary text-primary-foreground overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto">
          <LogoFull className="mb-8 w-48" />
          <h1 className="text-4xl font-bold mb-6">BNAL Bank</h1>
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
            <p>Telegram: @KA7777AA</p>
          </div>
        </div>

        {/* Декоративный фоновый элемент */}
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
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя пользователя</FormLabel>
              <FormControl>
                <Input {...field} className="bg-background/50" />
              </FormControl>
              <FormMessage />
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
                <Input type="password" {...field} className="bg-background/50" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Войти
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const { registerMutation } = useAuth();
  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Имя пользователя</FormLabel>
              <FormControl>
                <Input {...field} className="bg-background/50" />
              </FormControl>
              <FormMessage />
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
                <Input type="password" {...field} className="bg-background/50" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Зарегистрироваться
        </Button>
      </form>
    </Form>
  );
}