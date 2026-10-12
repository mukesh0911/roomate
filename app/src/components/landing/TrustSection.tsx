import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  MessageCircle,
  CheckCircle2,
  IndianRupee,
  Sparkles,
  HeartHandshake,
  Play
} from 'lucide-react';

export default function TrustSection() {
  const features = [
    {
      title: 'Identity Verification',
      desc: 'Real people, real profiles.',
      icon: ShieldCheck,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Safe & Private Chat',
      desc: 'Your privacy, our priority.',
      icon: MessageCircle,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Verified Listings',
      desc: 'Quality spaces only.',
      icon: CheckCircle2,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      title: 'No Brokerage',
      desc: 'Direct connections.',
      icon: IndianRupee,
      iconBg: 'bg-orange-50 text-[#FF5A36]',
    },
    {
      title: 'Lifestyle Matching',
      desc: 'Find your tribe.',
      icon: Sparkles,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      title: 'Community Support',
      desc: 'Help when you need it.',
      icon: HeartHandshake,
      iconBg: 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <section className="py-10 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-100">
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          {/* Left Column (Editorial Context & CTAs) */}
          <div className="lg:col-span-5 text-left">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1.5 sm:mb-3 block">
              WHY NESTMATE
            </span>

            <h2 className="text-[28px] sm:text-4xl md:text-5xl font-serif font-medium text-[#1E2229] leading-tight mb-3 sm:mb-5 tracking-tight">
              More than a platform,<br />
              <span className="text-[#FF5A36] italic">a community.</span>
            </h2>

            <p className="text-[13px] sm:text-base text-gray-600 mb-6 sm:mb-8 leading-relaxed max-w-md">
              We combine technology, verification and human community to help you find the right
              people and places — not just a room, but a better life.
            </p>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap items-center sm:gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full bg-[#1E2229] hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-xs transition-all text-center"
              >
                <span>Get Started</span>
                <span>→</span>
              </Link>

              <Link
                to="/about"
                className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full border border-gray-200 hover:border-gray-300 bg-white text-xs sm:text-sm font-semibold text-[#1E2229] hover:bg-gray-50 transition-all shadow-xs text-center"
              >
                <Play className="w-3 h-3 fill-[#1E2229] text-[#1E2229]" />
                <span>Our Story</span>
              </Link>
            </div>
          </div>

          {/* Right Column (Feature Grid: 2 columns on mobile matching reference mockup) */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-2 gap-x-3.5 sm:gap-x-8 gap-y-4 sm:gap-y-8">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="flex items-start gap-2.5 sm:gap-4 text-left">
                    <div
                      className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${feat.iconBg} flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-base font-bold text-[#1E2229] leading-snug mb-0.5">
                        {feat.title}
                      </h3>
                      <p className="text-[11px] sm:text-sm text-gray-500 leading-tight sm:leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
