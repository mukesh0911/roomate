import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, HelpCircle, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { SUPPORT_EMAIL } from '@/lib/runtimeConfig';

const FEATURES = [
  { name: 'Connect Requests', free: 'Unlimited (beta)', premium: 'Unlimited', corporate: 'Unlimited' },
  { name: 'View Matches', free: true, premium: true, corporate: true },
  { name: 'Active Listings', free: '1', premium: '5', corporate: 'Unlimited' },
  { name: 'Basic Chat', free: true, premium: true, corporate: true },
  { name: 'Trust Badges', free: true, premium: true, corporate: true },
  { name: 'See who viewed you', free: false, premium: 'Coming soon', corporate: 'Coming soon' },
  { name: 'Priority Placement', free: false, premium: 'Coming soon', corporate: 'Coming soon' },
  { name: 'Profile Boost', free: false, premium: 'Coming soon', corporate: 'Coming soon' },
  { name: 'HR Dashboard', free: false, premium: false, corporate: 'Coming soon' },
  { name: 'Bulk Listings', free: false, premium: false, corporate: 'Coming soon' },
] as const;

const FAQS = [
  ['How does the free plan work?', 'NestMate is currently free for all core features, including matching, connects, and chat. Premium plans are not purchasable yet.'],
  ['Is my phone number visible to others?', 'No. Contact details stay private and are shared only through consent-based connection flows.'],
  ['Can I buy Premium now?', 'No. Join the launch waitlist and we will contact you when verified server-side payments are available.'],
  ['How does compatibility matching work?', 'Lifestyle answers and housing preferences are compared to produce a data-backed compatibility score.'],
  ['Is Aadhaar verification mandatory?', 'No. Identity verification is optional and reviewed through the verification workflow.'],
  ['Where is NestMate available?', 'City and locality options are driven by the locations currently supported in the marketplace.'],
] as const;

function FeatureValue({ value, tone }: { value: boolean | string; tone: 'teal' | 'fire' | 'navy' }) {
  if (value === false) return <X className="h-4 w-4 shrink-0 text-ink/20" aria-label="Not included" />;
  const color = tone === 'fire' ? 'text-fire' : tone === 'navy' ? 'text-navy' : 'text-teal';
  return (
    <>
      <Check className={`h-4 w-4 shrink-0 ${color}`} aria-label="Included" />
      {typeof value === 'string' && <span className="text-xs text-ink/45">({value})</span>}
    </>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const waitlistHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('NestMate Premium launch waitlist')}`;
  const salesHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('NestMate corporate plan inquiry')}`;

  useEffect(() => {
    document.title = 'Plans & Pricing | NestMate';
  }, []);

  const plans = [
    { key: 'free', name: 'Free', price: '₹0', suffix: '/month', tone: 'teal' as const },
    { key: 'premium', name: 'Premium', price: `₹${isAnnual ? Math.round(2499 / 12) : 299}`, suffix: '/month', tone: 'fire' as const },
    { key: 'corporate', name: 'Corporate', price: 'Custom', suffix: '', tone: 'navy' as const },
  ];

  return (
    <div className="min-h-screen bg-parchment page-transition">
      <header className="gradient-dark px-4 py-20 text-center">
        <h1 className="text-4xl font-display italic text-white sm:text-5xl">Simple Pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/65">Core features are free today. Paid plans remain disabled until secure payment verification is live.</p>
        <div className="mt-8 inline-flex rounded-full bg-white/10 p-1">
          <button onClick={() => setIsAnnual(false)} className={`rounded-full px-5 py-2 text-sm ${!isAnnual ? 'bg-white text-ink' : 'text-white/65'}`}>Monthly</button>
          <button onClick={() => setIsAnnual(true)} className={`rounded-full px-5 py-2 text-sm ${isAnnual ? 'bg-white text-ink' : 'text-white/65'}`}>Annual · Save 30%</button>
        </div>
        {isAnnual && <p className="mt-3 text-xs font-medium text-white/60">Billed annually when Premium launches</p>}
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 sm:px-6">
        <div className="mb-16 grid gap-6 md:grid-cols-3">
          {plans.map(plan => (
            <section key={plan.key} className={`card-nestmate relative p-6 ${plan.key === 'premium' ? 'border-2 border-fire' : ''}`}>
              {plan.key === 'premium' && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-fire px-3 py-1 text-xs font-bold text-white">
                  <Crown className="h-3 w-3" /> Coming Soon
                </span>
              )}
              <p className="mb-1 text-sm font-medium text-ink/60">{plan.name}</p>
              <div className="mb-5 flex items-baseline gap-1"><span className="text-4xl font-bold">{plan.price}</span><span className="text-sm text-ink/50">{plan.suffix}</span></div>
              {plan.key === 'free' ? (
                <button onClick={() => navigate(user ? '/dashboard' : '/login')} className="btn-outline mb-6 w-full">{user ? 'Open App' : 'Get Started'}</button>
              ) : (
                <a href={plan.key === 'premium' ? waitlistHref : salesHref} className={`mb-6 flex w-full items-center justify-center ${plan.key === 'premium' ? 'btn-outline' : 'btn-navy'}`}>
                  {plan.key === 'premium' ? 'Join Launch Waitlist' : 'Email Sales'}
                </a>
              )}
              <ul className="space-y-3">
                {FEATURES.map(feature => {
                  const value = feature[plan.key as keyof typeof feature] as boolean | string;
                  return <li key={feature.name} className="flex items-center gap-2 text-sm text-ink/70"><FeatureValue value={value} tone={plan.tone} /><span>{feature.name}</span></li>;
                })}
              </ul>
            </section>
          ))}
        </div>

        <section className="mx-auto mb-16 max-w-2xl">
          <h2 className="type-h2 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map(([question, answer], index) => (
              <div key={question} className="card-nestmate p-4">
                <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between text-left" aria-expanded={openFaq === index}>
                  <span className="text-sm font-medium">{question}</span><HelpCircle className="h-4 w-4 text-ink/40" />
                </button>
                {openFaq === index && <p className="mt-3 text-sm leading-relaxed text-ink/60">{answer}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className="pb-16 text-center text-sm text-ink/45">No payment required today · Support: {SUPPORT_EMAIL}</div>
      </main>
    </div>
  );
}
