import { useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'How do I find verified roommates without paying any brokerage fee?',
    answer:
      'NestMate is a 100% direct peer-to-peer and owner-to-tenant platform. All profiles and room listings undergo identity and phone verification. You can filter by lifestyle, food preferences, smoking/drinking habits, and workplace location to connect directly with roommates without intermediary broker commissions.',
  },
  {
    question: 'How does NestMate ensure safety and privacy for female seekers?',
    answer:
      'We provide dedicated filters for "Female Flatmates Only", private contact hiding, and in-app secure chat. Users can chat and verify mutual compatibility before sharing phone numbers or scheduling physical visits. Only verified members can initiate connection requests.',
  },
  {
    question: 'How does phone number privacy and direct messaging work?',
    answer:
      'You can chat safely inside NestMate without revealing your personal phone number. Only after both parties accept a connection request can mutual phone numbers be shared for site visits and calls.',
  },
  {
    question: 'How does the lifestyle and habit compatibility matching work?',
    answer:
      'When onboarding, users select their daily habits across 12 criteria (cleanliness, sleep schedule, smoking, drinking, pet tolerance, work-from-home, guest frequency, food preferences). Our matching algorithm calculates a compatibility percentage score for each prospective flatmate.',
  },
  {
    question: 'How do I post a room or shared flat if I have a vacancy?',
    answer:
      'Click the "+ Post Room" button in the navigation header. Provide details such as locality, monthly rent, security deposit, room photos, available amenities (Wi-Fi, AC, Geyser, Parking), and preferences for prospective flatmates. Your listing will go live within minutes.',
  },
];

export default function RentalGuideFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section id="faq" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1000px] mx-auto text-left">
      <div className="text-center sm:text-left mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-[#FF5A36] text-[11px] font-bold tracking-wider uppercase mb-2">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>HELP & RENTAL GUIDE</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-medium text-[#1E2229] tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Everything you need to know about finding flatmates, renting rooms, and staying safe.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`border rounded-2xl transition-all duration-200 overflow-hidden bg-white ${
                isOpen ? 'border-[#FF5A36]/40 shadow-xs' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full py-4 px-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="text-sm sm:text-base font-semibold text-[#1E2229]">
                  {item.question}
                </span>
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'bg-[#FFF2EB] text-[#FF5A36] rotate-180' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-50 mt-1">
                  <div className="pt-3">{item.answer}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust Guarantee Micro-Banner */}
      <div className="mt-8 p-4 rounded-2xl bg-[#FFF2EB]/60 border border-orange-100/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF5A36] text-white flex items-center justify-center shrink-0 shadow-xs">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#1E2229]">100% Zero Brokerage Guarantee</h4>
          <p className="text-[11px] text-gray-600 mt-0.5">
            Never pay any commission or advance visit fees to anyone claiming to be an agent on NestMate.
          </p>
        </div>
      </div>
    </section>
  );
}
