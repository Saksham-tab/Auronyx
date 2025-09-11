import { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import WaterQualityCard from './components/WaterQualityCard';
import LocationSelector from './components/LocationSelector';
import AISummary from './components/AISummary';
import IoTMonitoring from './components/IoTMonitoring';
import AddReview from './components/AddReview';
import ComparisonSection from './components/ComparisonSection';
import Chatbot from './components/Chatbot';
import RAGAnalysis from './components/RAGAnalysis';
import IoTAnalysis from './components/IoTAnalysis';
import Footer from './components/Footer';

function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Bhopal');

  // Fallback quality scores for Indian cities (will be replaced by AI analysis)
  const getQualityScore = (district: string) => {
    const scores: Record<string, number> = {
      'Bhopal': 45,        // Fallback - AI will provide actual score
      'Indore': 55,        // Fallback - AI will provide actual score  
      'Gwalior': 50,       // Fallback - AI will provide actual score
      'Hoshangabad': 40,   // Fallback - AI will provide actual score
      'Bhind': 35,         // Fallback - AI will provide actual score
      'Morena': 45         // Fallback - AI will provide actual score
    };
    return scores[district] || 50; // Default fallback
  };

  const qualityScore = getQualityScore(selectedDistrict);

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <div>
            <Hero setActiveSection={setActiveSection} />
            
            {/* Quick Overview Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Water Quality at a Glance
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Get instant insights from community reviews and real-time IoT sensor data
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <LocationSelector 
                    selectedDistrict={selectedDistrict} 
                    setSelectedDistrict={setSelectedDistrict} 
                  />
                </div>
                <div className="lg:col-span-2">
                  <WaterQualityCard 
                    qualityScore={qualityScore} 
                    location={selectedDistrict} 
                  />
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'dashboard':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Review-Based Water Quality Dashboard</h1>
              <p className="text-lg text-gray-600">Crowdsourced data with AI-powered insights</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <LocationSelector 
                  selectedDistrict={selectedDistrict} 
                  setSelectedDistrict={setSelectedDistrict} 
                />
                <WaterQualityCard 
                  qualityScore={qualityScore} 
                  location={selectedDistrict} 
                />
              </div>
              
              <div className="lg:col-span-2">
                <AISummary 
                  location={selectedDistrict} 
                  qualityScore={qualityScore} 
                />
              </div>
            </div>
          </div>
        );
      
      case 'monitoring':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Real-Time IoT Monitoring</h1>
              <p className="text-lg text-gray-600">Live sensor data from ESP32 devices</p>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              <div className="xl:col-span-1">
                <LocationSelector 
                  selectedDistrict={selectedDistrict} 
                  setSelectedDistrict={setSelectedDistrict} 
                />
              </div>
              
              <div className="xl:col-span-3">
                <IoTMonitoring selectedLocation={{ id: '1', name: selectedDistrict }} />
                
                {/* AI-Powered IoT Analysis */}
                <div className="mt-8">
                  <IoTAnalysis 
                    selectedLocation={{ id: '1', name: selectedDistrict }}
                    sensorData={{
                      temperature: 23.5,
                      turbidity: 2.1,
                      tds: 150,
                      hardness: 65
                    }}
                  />
                </div>
                
                {/* Comparison Section */}
                <div className="mt-8">
                  <ComparisonSection 
                    qualityScore={qualityScore} 
                    location={selectedDistrict} 
                  />
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'add-review':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Your Experience</h1>
              <p className="text-lg text-gray-600">Help your community by reviewing water quality in your area</p>
            </div>
            
            <AddReview />
          </div>
        );
      
      case 'ai-analysis':
        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI-Powered Analysis</h1>
              <p className="text-lg text-gray-600">Advanced AI analysis of water quality data and community reviews</p>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              <div className="xl:col-span-1">
                <LocationSelector 
                  selectedDistrict={selectedDistrict} 
                  setSelectedDistrict={setSelectedDistrict} 
                />
              </div>
              
              <div className="xl:col-span-3 space-y-8">
                {/* RAG-Powered Review Analysis */}
                <RAGAnalysis selectedLocation={{ id: '1', name: selectedDistrict }} />
                
                {/* AI-Powered IoT Analysis */}
                <IoTAnalysis 
                  selectedLocation={{ id: '1', name: selectedDistrict }}
                  sensorData={{
                    temperature: 23.5,
                    turbidity: 2.1,
                    tds: 150,
                    hardness: 65
                  }}
                />
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main>
        {renderContent()}
      </main>
      
      <Footer />
      <Chatbot selectedLocation={{ id: '1', name: selectedDistrict }} />
    </div>
  );
}

export default App;