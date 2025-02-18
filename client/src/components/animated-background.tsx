import { motion } from "framer-motion";
import { Bitcoin, DollarSign, CreditCard } from "lucide-react";

const floatingItems = [
  { Icon: Bitcoin, color: "text-yellow-500", size: 24 },
  { Icon: DollarSign, color: "text-green-500", size: 28 },
  { Icon: CreditCard, color: "text-blue-500", size: 32 },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
      {/* Сетка матрицы */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:14px_24px]" />

      {/* Светящиеся линии */}
      <div className="absolute inset-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <motion.div
            key={`line-${index}`}
            className="absolute h-[1px] w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
            initial={{ 
              top: Math.random() * 100 + "%",
              x: -2000,
              opacity: 0 
            }}
            animate={{ 
              x: 2000,
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              delay: index * 2,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Плавающие элементы */}
      {Array.from({ length: 25 }).map((_, index) => {
        const item = floatingItems[index % floatingItems.length];

        return (
          <motion.div
            key={`float-${index}`}
            className={`absolute ${item.color} filter blur-[0.5px]`}
            initial={{
              x: Math.random() * window.innerWidth,
              y: -50,
              rotate: 0,
              opacity: 0,
            }}
            animate={{
              y: window.innerHeight + 50,
              rotate: 360,
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: 7 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "linear",
            }}
            style={{
              left: `${Math.random() * 100}%`,
            }}
          >
            <item.Icon size={item.size} className="drop-shadow-lg" />
          </motion.div>
        );
      })}

      {/* Светящиеся частицы */}
      {Array.from({ length: 20 }).map((_, index) => (
        <motion.div
          key={`particle-${index}`}
          className="absolute w-1 h-1 bg-primary/30 rounded-full filter blur-sm"
          initial={{
            x: Math.random() * window.innerWidth,
            y: -10,
            scale: 0,
          }}
          animate={{
            y: window.innerHeight + 10,
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 5 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}