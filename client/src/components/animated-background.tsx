import { motion } from "framer-motion";
import { Bitcoin, DollarSign, CreditCard } from "lucide-react";

const floatingItems = [
  { Icon: Bitcoin, color: "text-yellow-500", size: 24 },
  { Icon: DollarSign, color: "text-green-500", size: 28 },
  { Icon: CreditCard, color: "text-blue-500", size: 32 },
];

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-blue-900/50">
      {Array.from({ length: 15 }).map((_, index) => {
        const item = floatingItems[index % floatingItems.length];

        return (
          <motion.div
            key={index}
            className={`absolute ${item.color}`}
            initial={{
              x: Math.random() * window.innerWidth,
              y: -50,
              rotate: 0,
              opacity: 0,
            }}
            animate={{
              y: window.innerHeight + 50,
              rotate: 360,
              opacity: [0, 0.5, 0],
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
            <item.Icon size={item.size} />
          </motion.div>
        );
      })}
    </div>
  );
}