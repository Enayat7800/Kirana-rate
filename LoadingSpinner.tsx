
import React, { useState, useEffect } from 'react';

const messages = [
  "Scanning product details...",
  "Searching current market rates...",
  "Comparing official brand prices...",
  "Estimating weight and quantity...",
  "Checking local Kirana trends...",
  "Fetching real-time data from BigBasket & Blinkit..."
];

const LoadingSpinner: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-gray-100 dark:border-slate-700 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-gray-800 dark:text-gray-100 animate-pulse">{messages[msgIndex]}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">This might take a few seconds...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;