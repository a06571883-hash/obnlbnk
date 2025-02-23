import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Home, CreditCard, Activity, User, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export default function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: CreditCard, label: "Cards", path: "/cards" },
    { icon: Activity, label: "Activity", path: "/activity" },
    { icon: Image, label: "NFT", path: "/nft" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t z-50">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path} className="relative py-1 px-3 rounded-lg">
            <div
              className={cn(
                "flex flex-col items-center transition-colors",
                location === item.path
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </div>
            {location === item.path && (
              <motion.div
                layoutId="bottomNav"
                className="absolute inset-0 bg-primary/10 rounded-lg"
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                }}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}