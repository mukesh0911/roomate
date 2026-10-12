import { LANDING_ASSETS } from '@/lib/landingAssets';

export default function HowItWorksSection() {
  const steps = [
    {
      num: '1',
      title: 'Create Your Profile',
      desc: 'Sign up and verify your identity.',
      illustration: LANDING_ASSETS.illustrations.createProfile,
    },
    {
      num: '2',
      title: 'Explore Options',
      desc: 'Browse rooms, PGs or roommates.',
      illustration: LANDING_ASSETS.illustrations.exploreOptions,
    },
    {
      num: '3',
      title: 'Find Your Match',
      desc: 'Connect with people who fit your lifestyle.',
      illustration: LANDING_ASSETS.illustrations.findYourMatch,
    },
    {
      num: '4',
      title: 'Move In Happily',
      desc: 'Start your next chapter!',
      illustration: LANDING_ASSETS.illustrations.moveInHappily,
    },
  ];

  return (
    <section id="how-it-works" className="py-10 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto text-center">
      {/* Eyebrow & Title */}
      <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1.5 sm:mb-3 block">
        GET STARTED IN MINUTES
      </span>

      <h2 className="text-[28px] sm:text-4xl md:text-5xl font-serif font-medium text-[#1E2229] leading-tight mb-2 sm:mb-3 tracking-tight">
        How it works
      </h2>

      <p className="text-[13px] sm:text-base text-gray-600 max-w-md mx-auto mb-6 sm:mb-16 leading-relaxed">
        Finding your next home is simple.
      </p>

      {/* ─── MOBILE VIEW (< md): Clean Vertical Scan List Matching Reference Mockup ─── */}
      <div className="flex flex-col gap-3 md:hidden text-left max-w-sm mx-auto">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-white/70 backdrop-blur-xs p-2.5 rounded-2xl border border-gray-100 shadow-xs">
            {/* Illustration Round Circle */}
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white p-0.5 shadow-xs border border-gray-100 shrink-0">
              <img
                src={step.illustration}
                alt={step.title}
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
                decoding="async"
                width={56}
                height={56}
              />
            </div>

            {/* Step info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-4 h-4 rounded-full bg-[#FF5A36] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-[#1E2229] leading-tight">
                  {step.title}
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 leading-snug pl-6">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── DESKTOP VIEW (>= md): Original 4-Column Horizontal Layout Untouched ─── */}
      <div className="hidden md:block relative max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center relative group">
              {/* Illustration Round Circle */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-white p-1.5 shadow-sm border border-gray-100 flex items-center justify-center mb-5 group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                <img
                  src={step.illustration}
                  alt={step.title}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                  decoding="async"
                  width={128}
                  height={128}
                />
              </div>

              {/* Step Title & Number */}
              <h3 className="text-sm sm:text-base font-bold text-[#1E2229] mb-1.5">
                {step.num}. {step.title}
              </h3>

              {/* Step Description */}
              <p className="text-xs sm:text-sm text-gray-500 max-w-[210px] leading-relaxed">
                {step.desc}
              </p>

              {/* Connecting Dashed Arrow for Desktop */}
              {idx < steps.length - 1 && (
                <div
                  className="hidden lg:flex items-center justify-center absolute top-14 -right-4 w-8 text-gray-300 pointer-events-none z-0"
                  aria-hidden="true"
                >
                  <span className="text-sm tracking-widest text-gray-300">⇢</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
