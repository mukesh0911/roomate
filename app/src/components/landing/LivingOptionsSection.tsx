import { useNavigate } from 'react-router-dom';
import { LANDING_ASSETS } from '@/lib/landingAssets';
import { useStore } from '@/store/useStore';

export default function LivingOptionsSection() {
  const navigate = useNavigate();
  const { updateFilters } = useStore();

  const options = [
    {
      title: 'Private Rooms',
      desc: 'Your own space, your rules.',
      image: LANDING_ASSETS.photos.privateRoom,
      filter: { flatType: ['Private Room', '1BHK', 'Studio'] },
      destination: '/explore?tab=rooms&type=Private+room',
    },
    {
      title: 'Shared Rooms',
      desc: 'Affordable and social.',
      image: LANDING_ASSETS.photos.sharedRoom,
      filter: { flatType: ['Shared Room', '2BHK', '3BHK'] },
      destination: '/explore?tab=rooms&type=Shared+room',
    },
    {
      title: 'PGs & Hostels',
      desc: 'Managed stays, hassle-free.',
      image: LANDING_ASSETS.photos.pgHostel,
      filter: { flatType: ['PG', 'Hostel'] },
      destination: '/explore?tab=pg',
    },
    {
      title: 'Coliving Spaces',
      desc: 'Live, work and belong.',
      image: LANDING_ASSETS.photos.colivingSpace,
      filter: { flatType: ['Coliving', 'PG', 'Shared Room'] },
      destination: '/explore?tab=pg&propertyType=coliving',
    },
  ];

  const handleCardClick = (option: typeof options[0]) => {
    updateFilters(option.filter);
    navigate(option.destination);
  };

  return (
    <section className="py-8 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      {/* Mobile Section Header (matches reference mockup) */}
      <div className="flex items-end justify-between mb-3.5 md:hidden text-left">
        <div>
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1 block">
            EXPLORE OPTIONS
          </span>
          <h2 className="text-xl font-serif font-medium text-[#1E2229] tracking-tight">
            Explore by category
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/explore?tab=rooms')}
          className="text-xs font-semibold text-[#FF5A36] hover:underline cursor-pointer pb-0.5 shrink-0"
        >
          See all →
        </button>
      </div>

      {/* MOBILE: 2x2 Grid of Category Cards (Exact match to reference mockup) */}
      <div className="grid grid-cols-2 gap-2.5 md:hidden">
        {options.map((opt, idx) => (
          <div
            key={idx}
            onClick={() => handleCardClick(opt)}
            className="group bg-white rounded-2xl p-2 shadow-xs border border-gray-100 transition-all duration-300 cursor-pointer flex flex-col text-left"
          >
            {/* Image container */}
            <div className="rounded-xl overflow-hidden aspect-[4/3] w-full bg-gray-100 mb-2">
              <img
                src={opt.image}
                alt={opt.title}
                loading="lazy"
                decoding="async"
                width={300}
                height={225}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Card info & arrow button */}
            <div className="px-1 pb-0.5 flex items-center justify-between">
              <div className="min-w-0 pr-1">
                <h3 className="text-xs font-bold text-[#1E2229] leading-tight truncate">
                  {opt.title}
                </h3>
                <p className="text-[10px] text-gray-500 leading-tight truncate mt-0.5">
                  {opt.desc}
                </p>
              </div>

              {/* Arrow circle button */}
              <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-600 shrink-0">
                <span className="text-[10px] leading-none">↗</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP (>= md): Original 4-col grid untouched */}
      <div className="hidden md:grid md:grid-cols-4 gap-5">
        {options.map((opt, idx) => (
          <div
            key={idx}
            onClick={() => handleCardClick(opt)}
            className="group bg-white rounded-2xl p-2.5 shadow-sm hover:shadow-md border border-gray-100 transition-all duration-300 cursor-pointer flex flex-col"
          >
            {/* Image container */}
            <div className="rounded-xl overflow-hidden aspect-[4/3] w-full bg-gray-100 mb-3">
              <img
                src={opt.image}
                alt={opt.title}
                loading="lazy"
                decoding="async"
                width={400}
                height={300}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Card info & arrow button */}
            <div className="px-1.5 pb-1 flex items-center justify-between">
              <div className="text-left min-w-0 pr-2">
                <h3 className="text-base font-bold text-[#1E2229] leading-snug truncate">
                  {opt.title}
                </h3>
                <p className="text-xs text-gray-500 leading-tight truncate mt-0.5">
                  {opt.desc}
                </p>
              </div>

              {/* Arrow circle button */}
              <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-600 group-hover:bg-[#FF5A36] group-hover:text-white group-hover:border-[#FF5A36] transition-colors shrink-0">
                <span className="text-sm leading-none">→</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
