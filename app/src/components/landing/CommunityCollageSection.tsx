import { LANDING_ASSETS } from '@/lib/landingAssets';

export default function CommunityCollageSection() {
  const memberAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80',
  ];

  return (
    <section id="community" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
        {/* Left Column: Story Content & Community Proof */}
        <div className="lg:col-span-5 text-left">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-3 block">
            REAL PEOPLE. REAL STORIES.
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-[#1E2229] leading-tight mb-5 tracking-tight">
            More than a platform,<br />
            a community
          </h2>

          <p className="text-sm sm:text-base text-slate-600 mb-8 leading-relaxed">
            Meet people from different cities, backgrounds and walks of life — all under one roof.
            Whether you are relocating for your career or starting university, NestMate helps you
            find roommates who share your values and lifestyle rhythm.
          </p>

          {/* Happy Members Avatar Stack */}
          <div className="flex items-center gap-3.5 pt-2">
            <div className="flex -space-x-2.5">
              {memberAvatars.map((src, idx) => (
                <img
                  key={idx}
                  src={src}
                  alt="NestMate community member"
                  className="w-9 h-9 rounded-full border-2 border-white object-cover shadow-xs"
                />
              ))}
            </div>

            <div className="text-left">
              <div className="text-sm font-extrabold text-[#1E2229] leading-tight">
                10,000+
              </div>
              <div className="text-xs text-slate-500 font-medium leading-tight">
                Happy members
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: CSS Polaroid Photo Collage */}
        <div className="lg:col-span-7 relative min-h-[340px] sm:min-h-[460px] flex items-center justify-center w-full max-w-full overflow-hidden sm:overflow-visible">
          <div className="relative w-full max-w-[340px] sm:max-w-[560px] h-[320px] sm:h-[420px]">
            {/* Polaroid 1: Friends in living room (tilted left -6deg) */}
            <div className="absolute top-3 left-0 sm:left-4 z-10 w-36 sm:w-56 bg-white p-2 sm:p-3 pb-5 sm:pb-8 shadow-xl rounded-lg transform -rotate-6 hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden rounded bg-slate-100">
                <img
                  src={LANDING_ASSETS.photos.friendsLivingRoom}
                  alt="Friends laughing together in cozy living room"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Polaroid 2: Friends gathering around table (center / slight tilt +2deg) */}
            <div className="absolute top-8 left-20 sm:left-44 z-20 w-36 sm:w-56 bg-white p-2 sm:p-3 pb-5 sm:pb-8 shadow-2xl rounded-lg transform rotate-2 hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden rounded bg-slate-100">
                <img
                  src={LANDING_ASSETS.photos.friendsGathering}
                  alt="Friends sharing a meal and conversation"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Sticky Note: Pastel Peach Note with Handwritten Script */}
            <div className="absolute bottom-3 left-24 sm:left-60 z-25 w-32 sm:w-48 bg-[#FFE5D8] p-3 sm:p-5 shadow-lg rounded-md transform -rotate-3 hover:rotate-0 transition-all select-none">
              <div className="font-script text-base sm:text-xl text-slate-800 leading-snug">
                Different Places,
                <br />
                Same Feeling
                <br />
                Home <span className="text-[#FF5A36]">♡</span>
              </div>
            </div>

            {/* Polaroid 3: Rooftop friends (tilted right +6deg) */}
            <div className="absolute top-2 right-0 sm:right-2 z-10 w-36 sm:w-56 bg-white p-2 sm:p-3 pb-5 sm:pb-8 shadow-xl rounded-lg transform rotate-6 hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden rounded bg-slate-100">
                <img
                  src={LANDING_ASSETS.photos.rooftopFriends}
                  alt="Friends celebrating sunset on rooftop terrace"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Plant Leaf Accent Decoration */}
            <div className="absolute -bottom-2 -right-1 z-30 pointer-events-none select-none text-3xl sm:text-5xl opacity-80">
              🌿
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
