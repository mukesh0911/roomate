import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { MapPin } from 'lucide-react';

interface CityItem {
  name: string;
  count: string;
  image: string;
  state: string;
}

const POPULAR_CITIES: CityItem[] = [
  {
    name: 'Delhi',
    count: 'Explore listings',
    state: 'Delhi NCR',
    image: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Mumbai',
    count: 'Explore listings',
    state: 'Maharashtra',
    image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Bengaluru',
    count: 'Explore listings',
    state: 'Karnataka',
    image: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Pune',
    count: 'Explore listings',
    state: 'Maharashtra',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Gurgaon',
    count: 'Explore listings',
    state: 'Haryana',
    image: 'https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Noida',
    count: 'Explore listings',
    state: 'Uttar Pradesh',
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Hyderabad',
    count: 'Explore listings',
    state: 'Telangana',
    image: 'https://images.unsplash.com/photo-1605649487212-47bdab064df8?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Kolkata',
    count: 'Explore listings',
    state: 'West Bengal',
    image: 'https://images.unsplash.com/photo-1558431382-27e303142255?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Chennai',
    count: 'Explore listings',
    state: 'Tamil Nadu',
    image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Ahmedabad',
    count: 'Explore listings',
    state: 'Gujarat',
    image: 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Chandigarh',
    count: 'Explore listings',
    state: 'Punjab',
    image: 'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Jaipur',
    count: 'Explore listings',
    state: 'Rajasthan',
    image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80',
  },
];

export default function PopularCitiesSection() {
  const navigate = useNavigate();
  const { updateFilters } = useStore();

  const handleCitySelect = (cityName: string) => {
    updateFilters({ city: cityName });
    navigate(`/explore?city=${encodeURIComponent(cityName)}&tab=rooms`);
  };

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 text-left">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1.5 block">
            EXPLORE BY DESTINATION
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1E2229] tracking-tight">
            Popular Cities for Flatmates & Shared Rooms
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Explore rooms, flats, and roommates by city.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/explore?tab=rooms')}
          className="mt-3 sm:mt-0 text-xs font-semibold text-[#FF5A36] hover:text-[#E54E2B] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
        >
          View all cities →
        </button>
      </div>

      {/* Grid of 12 Cities matching FlatMate (1).png */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {POPULAR_CITIES.map((city) => (
          <div
            key={city.name}
            role="link" tabIndex={0}
            onKeyDown={(event) => { if(event.key === "Enter")handleCitySelect(city.name); }}
            onClick={() => handleCitySelect(city.name)}
            className="group relative rounded-2xl overflow-hidden aspect-[4/5] bg-gray-100 cursor-pointer shadow-xs hover:shadow-lg transition-all duration-300 border border-black/5"
          >
            {/* Background Image */}
            <img
              src={city.image}
              alt={`${city.name} city view`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

            {/* Content */}
            <div className="absolute inset-x-0 bottom-0 p-3 text-left flex flex-col justify-end">
              <div className="flex items-center gap-1 text-[10px] text-white/70 font-medium mb-0.5">
                <MapPin className="w-2.5 h-2.5 text-[#FF5A36]" />
                <span>{city.state}</span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                {city.name}
              </h3>
              <p className="text-[11px] text-white/80 font-normal mt-0.5">
                {city.count}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
