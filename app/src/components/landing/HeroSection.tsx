import { LANDING_ASSETS } from '@/lib/landingAssets';
import HeroSearchModule from './HeroSearchModule';

export default function HeroSection() {
  const socialAvatars = [
    LANDING_ASSETS.avatars.riya,
    LANDING_ASSETS.avatars.arjun,
    LANDING_ASSETS.avatars.sneha,
  ];

  return (
    <section className="relative min-h-[640px] lg:min-h-[720px] pt-20 sm:pt-28 lg:pt-32 pb-10 sm:pb-16 flex items-center overflow-hidden">

      {/* ─── Premium Background System ────────────────────────────────── */}

      {/* Base: warm mesh gradient — ivory → champagne → soft blush */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 15% 0%,   #F5EDE0 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 90% 100%, #F2E8DF 0%, transparent 55%),
            radial-gradient(ellipse 50% 50% at 50% 50%,  #F8F4EE 0%, transparent 100%),
            #FBFBFC
          `,
        }}
      />

      {/* Fine dot-grid texture — adds premium tactility without pattern */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.028] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, #1E2229 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
        }}
      />

      {/* Warm coral glow — top right, very soft */}
      <div
        className="absolute -z-10 pointer-events-none"
        style={{
          top: '-10%',
          right: '8%',
          width: '480px',
          height: '480px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(229,80,26,0.07) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Warm amber glow — bottom left, very soft */}
      <div
        className="absolute -z-10 pointer-events-none"
        style={{
          bottom: '0%',
          left: '-5%',
          width: '420px',
          height: '420px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,183,77,0.06) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Decorative top-right arc line — architectural accent */}
      <svg
        className="absolute top-0 right-0 -z-10 pointer-events-none opacity-[0.06]"
        width="420"
        height="420"
        viewBox="0 0 420 420"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="420" cy="0" r="300" stroke="#1E2229" strokeWidth="1" />
        <circle cx="420" cy="0" r="220" stroke="#1E2229" strokeWidth="0.8" />
        <circle cx="420" cy="0" r="150" stroke="#FF5A36" strokeWidth="0.6" />
      </svg>

      {/* Decorative bottom-left arc line — mirror balance */}
      <svg
        className="absolute bottom-0 left-0 -z-10 pointer-events-none opacity-[0.04]"
        width="300"
        height="300"
        viewBox="0 0 300 300"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="0" cy="300" r="200" stroke="#1E2229" strokeWidth="1" />
        <circle cx="0" cy="300" r="130" stroke="#1E2229" strokeWidth="0.7" />
      </svg>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* ─── MOBILE VIEW (< lg): Matches Reference Mockup Exactly ─── */}
        <div className="lg:hidden flex flex-col text-left">
          {/* Eyebrow */}
          <div className="mb-2">
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#FF5A36]/80 uppercase">
              A HOME FOR A BRIGHTER YOU
            </span>
          </div>

          {/* Heading + Script side-by-side row */}
          <div className="flex items-start justify-between gap-2.5 mb-2.5">
            <h1 className="text-[34px] sm:text-4xl font-serif font-medium leading-[1.12] tracking-tight text-[#1E2229]">
              <span className="block">Find your</span>
              <span className="block">people.</span>
              <span className="italic font-normal text-[#FF5A36] block mt-0.5">
                Find your place.
              </span>
            </h1>

            {/* Handwritten script note aligned to right of heading */}
            <div className="pt-0.5 text-right shrink-0 select-none pointer-events-none">
              <span className="font-script text-[13px] xs:text-sm sm:text-lg text-[#1E2229] leading-tight block transform -rotate-3">
                Same city
              </span>
              <span className="font-script text-[13px] xs:text-sm sm:text-lg text-[#1E2229] leading-tight block transform -rotate-1">
                New stories
              </span>
              <span className="font-script text-[13px] xs:text-sm sm:text-lg text-[#1E2229] leading-tight block transform rotate-2">
                Better you <span className="text-[#FF5A36]">♡</span>
              </span>
            </div>
          </div>

          {/* Supporting Copy */}
          <p className="text-[13px] sm:text-sm text-gray-600/90 mb-4 leading-[1.6] max-w-[340px]">
            Verified roommates, rooms and PGs in cities across India. Live safer, smarter and be part of a like-minded community.
          </p>

          {/* Hero Visual on Mobile: sitting right above the search card */}
          <div className="relative rounded-2xl overflow-hidden aspect-[16/11] sm:aspect-[16/10] shadow-md border border-white/60 mb-3.5">
            <img
              src={LANDING_ASSETS.photos.heroWomanMobile}
              srcSet={`${LANDING_ASSETS.photos.heroWomanMobile} 600w, ${LANDING_ASSETS.photos.heroWoman} 896w`}
              sizes="(max-width: 640px) 100vw, 600px"
              alt="Young woman smiling and working in modern sunlit living room"
              className="w-full h-full object-cover object-center"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={600}
              height={412}
            />

            {/* Soft gradient bottom overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

            {/* Stamp sticker on window / top right */}
            <div className="absolute top-3 right-3 pointer-events-none select-none">
              <div className="border border-slate-700/30 rounded-full px-2.5 py-1 bg-white/60 backdrop-blur-xs text-center transform rotate-6 shadow-xs">
                <span className="font-script text-[11px] font-bold text-slate-800 block leading-tight">Good people</span>
                <span className="font-script text-[11px] font-bold text-slate-800 block leading-tight">Better days <span className="text-[#FF5A36]">♡</span></span>
              </div>
            </div>
          </div>

          {/* Hero Search Box on Mobile */}
          <HeroSearchModule />
        </div>

        {/* ─── DESKTOP VIEW (>= lg): Untouched Original Layout ─── */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column (Editorial Content & Search) */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center text-left">
            {/* Eyebrow */}
            <div className="mb-3 sm:mb-4">
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-gray-400 uppercase">
                A HOME FOR A BRIGHTER YOU
              </span>
            </div>

            {/* Headline */}
            <div className="relative mb-4 sm:mb-5">
              <h1 className="text-5xl md:text-6xl xl:text-[70px] leading-[1.08] tracking-tight text-[#1E2229]">
                <span className="font-serif block font-medium">Find your</span>
                <span className="font-serif block font-medium">people.</span>
                <span className="font-serif italic font-normal text-[#FF5A36] block">
                  Find your place.
                </span>
              </h1>

              {/* Desktop handwritten script note */}
              <div className="absolute right-0 sm:right-6 top-4 sm:top-8 text-left pointer-events-none select-none">
                <span className="font-script text-2xl text-[#1E2229] leading-tight block transform -rotate-3">
                  Same city
                </span>
                <span className="font-script text-2xl text-[#1E2229] leading-tight block transform -rotate-1">
                  New stories
                </span>
                <span className="font-script text-2xl text-[#1E2229] leading-tight block transform rotate-2">
                  Better you <span className="text-[#FF5A36]">♡</span>
                </span>
              </div>
            </div>

            {/* Supporting Copy */}
            <p className="text-base text-gray-600 max-w-lg mb-7 leading-relaxed">
              Verified roommates, rooms and PGs in cities across India. Live safer, smarter and be part of a like-minded community.
            </p>

            {/* Hero Search Box */}
            <HeroSearchModule />
          </div>

          {/* Right Column (Hero Woman Visual & Social Proof) */}
          <div className="lg:col-span-6 xl:col-span-5 relative mt-6 lg:mt-0 w-full min-w-0">
            <div className="relative mx-auto w-full max-w-[480px] lg:max-w-none">
              {/* Main Image Container */}
              <div className="relative rounded-[36px] lg:rounded-[40px] overflow-hidden shadow-2xl shadow-slate-900/10 border border-white/60 aspect-[3/4] lg:aspect-[4/5]">
                <img
                  src={LANDING_ASSETS.photos.heroWoman}
                  alt="Young woman smiling and working in modern sunlit living room"
                  className="w-full h-full object-cover object-center"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  width={896}
                  height={1120}
                />


                {/* Soft gradient bottom overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

                {/* Stamp sticker on window / top right */}
                <div className="absolute top-6 right-6 pointer-events-none select-none">
                  <div className="border border-slate-700/30 rounded-full px-4 py-2 bg-white/50 backdrop-blur-xs text-center transform rotate-6 shadow-xs">
                    <span className="font-script text-base font-bold text-slate-800 block leading-tight">Good People</span>
                    <span className="font-script text-base font-bold text-slate-800 block leading-tight">Better Homes <span className="text-[#FF5A36]">♡</span></span>
                  </div>
                </div>

                {/* Floating Social Proof Card */}
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl py-2.5 px-4 shadow-xl border border-white/80 flex items-center gap-3 max-w-[calc(100%-1.5rem)]">
                  <div className="flex -space-x-2 shrink-0">
                    {socialAvatars.slice(0, 3).map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt="NestMate community member"
                        className="w-7 h-7 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                  </div>

                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold text-[#1E2229] leading-tight">
                      10K+
                    </div>
                    <div className="text-[10px] text-gray-500 font-medium leading-tight truncate">
                      people found their home
                    </div>
                  </div>

                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs shrink-0">
                    →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
