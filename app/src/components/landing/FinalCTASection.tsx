import { Link } from 'react-router-dom';
import { LANDING_ASSETS } from '@/lib/landingAssets';

export default function FinalCTASection() {
  return (
    <section className="py-10 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      <div className="relative rounded-3xl sm:rounded-[36px] overflow-hidden shadow-xl border border-[#F2DAC9] min-h-[340px] sm:min-h-[380px] flex items-center">
        {/* Background Image: Friends at sunset */}
        <img
          src={LANDING_ASSETS.photos.ctaCityWindow}
          alt="Friends overlooking city skyline at sunset"
          loading="lazy"
          decoding="async"
          width={800}
          height={380}
          className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
        />

        {/* Warm Sunset/Peach Gradient Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, #F9EBE0 0%, rgba(249, 235, 224, 0.95) 45%, rgba(249, 235, 224, 0.4) 75%, transparent 100%)`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 p-6 sm:p-12 lg:p-16 max-w-xl text-left">
          <h2 className="text-[28px] sm:text-4xl md:text-5xl font-serif font-medium text-[#1E2229] leading-tight mb-2 sm:mb-3 tracking-tight">
            Ready to find<br className="sm:hidden" /> your people?
          </h2>

          <p className="text-[13px] sm:text-base text-gray-600 mb-5 sm:mb-8 leading-relaxed max-w-xs sm:max-w-md">
            Join thousands who are already living better with NestMate.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto max-w-xs sm:max-w-none">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-[13px] sm:text-sm font-semibold shadow-md shadow-orange-900/10 transition-all cursor-pointer text-center min-h-[44px]"
            >
              <span>Get Started</span>
              <span>→</span>
            </Link>

            <Link
              to="/explore?tab=rooms"
              className="inline-flex items-center justify-center px-6 sm:px-7 py-3 rounded-full bg-white/95 border border-gray-200 text-[#1E2229] hover:border-gray-300 text-[13px] sm:text-sm font-semibold hover:bg-gray-50/80 transition-all shadow-xs cursor-pointer text-center min-h-[44px]"
            >
              Explore Listings
            </Link>
          </div>
        </div>

        {/* Right: Handwritten Script Sticker (Visible on mobile & desktop) */}
        <div className="absolute right-4 sm:right-12 top-5 sm:top-8 text-right select-none pointer-events-none z-10">
          <span className="font-script text-xs sm:text-2xl md:text-3xl text-slate-800 leading-tight block transform -rotate-3">
            New City
          </span>
          <span className="font-script text-xs sm:text-2xl md:text-3xl text-slate-800 leading-tight block transform -rotate-1">
            Same You
          </span>
          <span className="font-script text-xs sm:text-2xl md:text-3xl text-slate-800 leading-tight block transform rotate-2">
            Just Brighter <span className="text-[#FF5A36]">♡</span>
          </span>
        </div>
      </div>
    </section>
  );
}
