import React, { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';

// Predefined districts for selection (same as AddReview)
export const DISTRICTS = [
  'Gwalior',
  'Bhind',
  'Morena',
  'Hoshangabad',
  'Bhopal',
  'Indore'
];

interface LocationSelectorProps {
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
}

export default function LocationSelector({ selectedDistrict, setSelectedDistrict }: LocationSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <MapPin className="h-5 w-5 text-blue-600" />
        <span>District Selection</span>
      </h3>

      <div className="space-y-4">
        {/* District Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-left flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div>
              <span className="font-medium text-gray-900">
                {selectedDistrict || 'Select a district'}
              </span>
              <p className="text-sm text-gray-500">Choose your monitoring district</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {DISTRICTS.map((district) => (
                <button
                  key={district}
                  onClick={() => {
                    setSelectedDistrict(district);
                    setShowDropdown(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedDistrict === district ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  <span className="font-medium text-gray-900">{district}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected District Info */}
        {selectedDistrict && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Selected District</p>
                <p className="text-sm text-blue-700">{selectedDistrict}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}