import React from 'react';

interface CircularGaugeProps {
  value: number;
  label: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function CircularGauge({ value, label, unit = '%', size = 'md' }: CircularGaugeProps) {
  const getColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStrokeColor = (value: number) => {
    if (value >= 70) return '#10b981';
    if (value >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const sizeClasses = {
    sm: { svg: 'w-24 h-24', text: 'text-lg', label: 'text-xs' },
    md: { svg: 'w-32 h-32', text: 'text-2xl', label: 'text-sm' },
    lg: { svg: 'w-40 h-40', text: 'text-3xl', label: 'text-base' }
  };

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <svg className={sizeClasses[size].svg} viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getStrokeColor(value)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${sizeClasses[size].text} font-bold ${getColor(value)}`}>
            {value}{unit}
          </span>
        </div>
      </div>
      <span className={`${sizeClasses[size].label} font-medium text-gray-700 text-center`}>
        {label}
      </span>
    </div>
  );
}