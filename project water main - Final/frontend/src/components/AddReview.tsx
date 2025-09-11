import React, { useState } from 'react';
import { Star, MapPin, Send, ChevronDown } from 'lucide-react';

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  date: string;
}

// Predefined districts for selection
export const DISTRICTS = [
  'Gwalior',
  'Bhind',
  'Morena',
  'Hoshangabad',
  'Bhopal',
  'Indore'
];

export default function AddReview() {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    rating: 0,
    comment: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([
    {
      id: '1',
      name: 'John D.',
      location: 'Downtown Area',
      rating: 4,
      comment: 'Water quality is generally good, but sometimes has a chlorine taste.',
      date: '2025-01-08'
    },
    {
      id: '2',
      name: 'Sarah M.',
      location: 'Residential District',
      rating: 5,
      comment: 'Excellent water quality! Clean and tastes great.',
      date: '2025-01-07'
    },
    {
      id: '3',
      name: 'Mike R.',
      location: 'Industrial Zone',
      rating: 2,
      comment: 'Water often has a metallic taste and appears cloudy.',
      date: '2025-01-06'
    }
  ]);

  // Helper: convert location string to dummy coordinates (for demo)
  function getCoordinatesFromLocation(_location: string): [number, number] {
    // In real app, use geocoding API. For now, return fixed coords.
    return [77.5946, 12.9716]; // Bangalore
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (formData.location && formData.rating > 0 && formData.comment) {
      setLoading(true);
      try {
        // Prepare payload for backend (matching validation schema)
        const coordinates = getCoordinatesFromLocation(formData.location);
        const payload = {
          location: {
            type: 'Point',
            coordinates,
            address: {
              district: formData.location
            }
          },
          reviewData: {
            overallRating: formData.rating,
            taste: { 
              rating: formData.rating, 
              description: formData.comment 
            },
            additionalComments: formData.comment,
            healthEffects: ['none']
          }
        };
        // Optionally add name if provided
        // Name is not part of backend schema; keep it client-side only
        // if (formData.name) payload.reviewData.name = formData.name;
        // Send POST request (no authentication required)
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to submit review');
        }
        const data = await res.json();
        setSuccess('Review submitted successfully!');
        // Add to local reviews list for instant feedback
        setReviews([
          {
            id: data.data?.id || Date.now().toString(),
            name: formData.name || 'Anonymous',
            location: formData.location,
            rating: formData.rating,
            comment: formData.comment,
            date: new Date().toISOString().split('T')[0]
          },
          ...reviews
        ]);
        setFormData({ name: '', location: '', rating: 0, comment: '' });
      } catch (err: any) {
        setError(err.message || 'Failed to submit review');
      } finally {
        setLoading(false);
      }
    } else {
      setError('Please fill all required fields.');
    }
  };

  const StarRating = ({ rating, onRatingChange, interactive = false }: {
    rating: number;
    onRatingChange?: (rating: number) => void;
    interactive?: boolean;
  }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-6 w-6 ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive ? () => onRatingChange?.(star) : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Add Review Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
          <Send className="h-6 w-6 text-blue-600" />
          <span>Share Your Water Quality Experience</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name (Optional)
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select District *
              </label>
              <div className="relative">
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-3 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none bg-white"
                  required
                >
                  <option value="">Select a district</option>
                  {DISTRICTS.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Water Quality Rating *
            </label>
            <StarRating
              rating={formData.rating}
              onRatingChange={(rating) => setFormData({ ...formData, rating })}
              interactive={true}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Review *
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Share your experience with water quality in this area..."
              required
            />
          </div>

          {error && <div className="text-red-600 font-medium">{error}</div>}
          {success && <div className="text-green-600 font-medium">{success}</div>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2"
            disabled={loading}
          >
            <Send className="h-5 w-5" />
            <span>{loading ? 'Submitting...' : 'Submit Review'}</span>
          </button>
        </form>
      </div>

      {/* Recent Reviews */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Reviews</h3>
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{review.name || 'Anonymous'}</h4>
                  <p className="text-sm text-gray-600 flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{review.location}</span>
                  </p>
                </div>
                <div className="text-right">
                  <StarRating rating={review.rating} />
                  <p className="text-sm text-gray-500 mt-1">{review.date}</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed">{review.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}