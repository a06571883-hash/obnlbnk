import { motion } from "framer-motion";
import { Bitcoin, DollarSign, CreditCard, Wallet, Shield } from "lucide-react";
import { useEffect, useState } from "react";

const floatingItems = [
  { Icon: Bitcoin, color: "text-yellow-500", size: 24 },
  { Icon: DollarSign, color: "text-green-500", size: 28 },
  { Icon: CreditCard, color: "text-blue-500", size: 32 },
  { Icon: Wallet, color: "text-purple-500", size: 26 },
  { Icon: Shield, color: "text-cyan-500", size: 30 },
];

export default function AnimatedBackground() {
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-50">
      {/* Базовый фон, реагирующий на тему */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted transition-colors duration-300" />

      {/* Матричная сетка */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:14px_24px] opacity-[0.08]" />

      {/* Анимированные градиентные линии */}
      <div className="absolute inset-0">
        {Array.from({ length: 8 }).map((_, index) => (
          <motion.div
            key={`line-${index}`}
            className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            initial={{ 
              top: Math.random() * 100 + "%",
              x: -2000,
              opacity: 0,
              scaleY: 1
            }}
            animate={{ 
              x: 2000,
              opacity: [0, 1, 0],
              scaleY: [1, 2, 1]
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: index * 1.5,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Плавающие иконки */}
      {Array.from({ length: 20 }).map((_, index) => {
        const item = floatingItems[index % floatingItems.length];
        const depth = Math.random() * 2 + 1;

        return (
          <motion.div
            key={`float-${index}`}
            className={`absolute ${item.color} opacity-[0.15] dark:opacity-[0.08]`}
            style={{
              left: `${Math.random() * 100}%`,
              scale: 1 / depth,
              zIndex: Math.floor(depth)
            }}
            initial={{
              y: -50,
              rotate: 0,
              opacity: 0,
            }}
            animate={{
              y: windowHeight + 50,
              rotate: 360,
              opacity: [0, 0.15 / depth, 0],
            }}
            transition={{
              duration: 7 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear"
            }}
          >
            <item.Icon size={item.size} className="filter blur-[0.5px]" />
          </motion.div>
        );
      })}

      {/* Светящиеся частицы */}
      {Array.from({ length: 15 }).map((_, index) => (
        <motion.div
          key={`particle-${index}`}
          className="absolute w-1 h-1 bg-primary/30 rounded-full filter blur-sm"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 0),
            y: -10,
            scale: 0,
          }}
          animate={{
            y: windowHeight + 10,
            scale: [0, 1.5, 0],
            opacity: [0, 0.3, 0]
          }}
          transition={{
            duration: 4 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "linear"
          }}
        />
      ))}

      {/* Легкий эффект размытия для глубины */}
      <div className="absolute inset-0 backdrop-blur-[0.5px]" />
    </div>
  );
}