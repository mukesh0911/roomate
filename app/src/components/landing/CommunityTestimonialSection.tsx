import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { LANDING_ASSETS } from '@/lib/landingAssets';

export default function CommunityTestimonialSection() {
  const [activeIdx, setActiveIdx] = useState(0);

  const testimonials = [
    {
      quote: '“I found not just a room, but people who feel like home.”',
      author: 'Riya S.',
      location: 'Moved to Bangalore',
      avatar: LANDING_ASSETS.avatars.riya,
    },
    {
      quote: '“Moving across cities was intimidating until NestMate connected me with the most wonderful roommates.”',
      author: 'Arjun K.',
      location: 'Moved to Mumbai',
      avatar: LANDING_ASSETS.avatars.arjun,
    },
    {
      quote: '“Zero brokerage, verified profiles, and genuinely like-minded roommates. It felt seamless.”',
      author: 'Sneha M.',
      location: 'Moved to Chennai',
      avatar: LANDING_ASSETS.avatars.sneha,
    },
  ];

  const current = testimonials[activeIdx];

  const handlePrev = () => {
    setActiveIdx((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="py-10 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      <div className="relative w-full rounded-3xl sm:rounded-[36px] bg-[#F7EFE8]/70 border border-[#EADBCE] p-5 sm:p-10 lg:p-12 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          {/* Left Column: Quote, User & Rating */}
          <div className="lg:col-span-5 text-left flex flex-col justify-between">
            {/* Quote Icon */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center font-serif text-xl sm:text-2xl font-bold mb-3 sm:mb-5 shrink-0">
              “
            </div>

            {/* Main Testimonial Quote */}
            <blockquote className="text-xl sm:text-3xl lg:text-[32px] font-serif font-medium text-[#1E2229] leading-snug tracking-tight mb-5 sm:mb-8">
              {current.quote}
            </blockquote>

            {/* Author info & controls */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={current.avatar}
                    alt={current.author}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-[#1E2229] leading-tight">
                      {current.author}
                    </div>
                    <div className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5">
                      {current.location}
                    </div>
                  </div>
                </div>

                {/* Arrow Navigation */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-600 hover:text-[#FF5A36] hover:border-[#FF5A36] transition-colors cursor-pointer"
                    aria-label="Previous story"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-gray-200/80 flex items-center justify-center text-gray-600 hover:text-[#FF5A36] hover:border-[#FF5A36] transition-colors cursor-pointer"
                    aria-label="Next story"
                  >
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>

              {/* 5 Stars */}
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400" />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Roommates Photo + Tilted Polaroid + Handwritten Note */}
          <div className="lg:col-span-7 relative min-h-[220px] sm:min-h-[340px] mt-4 lg:mt-0 flex items-center justify-center">
            {/* Main Couch Photo */}
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg aspect-[16/10] w-full max-w-[520px]">
              <img
                src={LANDING_ASSETS.photos.roommatesCouch}
                alt="Roommates laughing on couch"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Overlapping Tilted Polaroid Photo */}
            <div className="absolute -bottom-2 right-1 sm:bottom-2 sm:right-6 bg-white p-2 pb-5 sm:p-2.5 sm:pb-6 rounded-xl shadow-2xl border border-gray-100 transform rotate-6 hover:rotate-3 transition-transform duration-300 w-36 sm:w-56 z-10">
              <div className="overflow-hidden rounded-lg aspect-[4/3] bg-gray-100 mb-1.5 sm:mb-2">
                <img
                  src={LANDING_ASSETS.photos.rooftopFriends}
                  alt="Friends gathering on rooftop"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Handwritten Note pointing to polaroid */}
            <div className="absolute top-1 right-2 sm:top-2 sm:right-8 pointer-events-none select-none z-20">
              <div className="font-script text-base sm:text-2xl text-[#1E2229] leading-tight transform -rotate-6">
                Different People<br />
                Same Vibe <span className="text-[#FF5A36]">♡</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
