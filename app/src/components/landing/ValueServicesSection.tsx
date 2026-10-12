import { FileText, Smartphone, ShieldCheck, CreditCard, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ValueServicesSection() {
  const navigate = useNavigate();

  const services = [
    {
      id: 'agreement',
      title: 'Online Rent Agreement',
      subtitle: 'Draft legal agreements with digital e-stamp and biometric verification delivered to your doorstep.',
      badge: 'Instant & Legal',
      icon: FileText,
      iconBg: 'bg-orange-50 text-[#FF5A36]',
      action: 'Draft Agreement',
      onClick: () => navigate('/explore?tab=rooms'),
    },
    {
      id: 'mobile-app',
      title: 'Mobile App Experience',
      subtitle: 'Real-time roommate chats, push notifications for instant matches, and easy listing management.',
      badge: 'iOS & Android',
      icon: Smartphone,
      iconBg: 'bg-blue-50 text-blue-600',
      action: 'Download App',
      onClick: () => navigate('/explore?tab=rooms'),
    },
    {
      id: 'premium',
      title: 'Zero Brokerage Stays',
      subtitle: 'Handpicked verified flats and private rooms directly from friendly owners and vetted roommates.',
      badge: 'Zero Commission',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50 text-emerald-600',
      action: 'Browse Verified',
      onClick: () => navigate('/explore?tab=rooms'),
    },
    {
      id: 'deposit',
      title: 'Deposit & Rent Security',
      subtitle: 'Secure rent protection with transparent payment receipts and landlord verification guarantee.',
      badge: 'Protected',
      icon: CreditCard,
      iconBg: 'bg-purple-50 text-purple-600',
      action: 'Learn More',
      onClick: () => navigate('/explore?tab=rooms'),
    },
  ];

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      <div className="text-left mb-8">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1.5 block">
          EVERYTHING YOU NEED
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1E2229] tracking-tight">
          Services designed for seamless shared living
        </h2>
        <p className="text-sm text-gray-500 mt-1 max-w-xl">
          From verified discovery to legal agreements and rent management, we make renting effortless.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div
              key={service.id}
              className="group bg-white rounded-2xl p-5 border border-gray-100/90 shadow-xs hover:shadow-md hover:border-orange-200/80 transition-all duration-300 flex flex-col justify-between text-left relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl ${service.iconBg} flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                    {service.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#1E2229] mb-1.5 group-hover:text-[#FF5A36] transition-colors">
                  {service.title}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-6">
                  {service.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={service.onClick}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-gray-50 hover:bg-[#FFF2EB] text-[#1E2229] hover:text-[#FF5A36] text-xs font-semibold border border-gray-100/80 transition-all duration-200 cursor-pointer"
              >
                <span>{service.action}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
