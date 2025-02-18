import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Settings, 
  Shield, 
  Bell, 
  HelpCircle, 
  LogOut,
  ChevronRight
} from "lucide-react";

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();

  const menuItems = [
    {
      icon: Settings,
      title: "Settings",
      description: "App preferences and account settings",
      path: "/settings"
    },
    {
      icon: Shield,
      title: "Security",
      description: "Password and authentication settings",
      path: "/security"
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Manage your notification preferences",
      path: "/notifications"
    },
    {
      icon: HelpCircle,
      title: "Help & Support",
      description: "Get help with using the app",
      path: "/help"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground p-8">
        <h1 className="text-2xl font-bold mb-2">Profile</h1>
        <p className="text-primary-foreground/80">Manage your account settings</p>
      </div>

      <div className="p-4 -mt-4">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-semibold text-primary">
                  {user?.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{user?.username}</h2>
                <p className="text-sm text-muted-foreground">Member since 2024</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {menuItems.map((item) => (
            <Card key={item.title} className="cursor-pointer hover:bg-accent transition-colors">
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
          ))}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
