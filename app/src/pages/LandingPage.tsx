import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { DEMO_MODE_ENABLED } from '@/lib/runtimeConfig';

// Landing modular components
import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import PopularCitiesSection from '@/components/landing/PopularCitiesSection';
import LivingOptionsSection from '@/components/landing/LivingOptionsSection';
import StatsStrip from '@/components/landing/StatsStrip';
import TrustSection from '@/components/landing/TrustSection';
import CommunityTestimonialSection from '@/components/landing/CommunityTestimonialSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import FeaturedListingsSection from '@/components/landing/FeaturedListingsSection';
import RentalGuideFaqSection from '@/components/landing/RentalGuideFaqSection';
import FinalCTASection from '@/components/landing/FinalCTASection';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openAuthModal } = useStore();

  useEffect(() => {
    // Scroll to top upon landing page mount
    window.scrollTo(0, 0);
  }, []);

  const handleListSpace = () => {
    if (user?.uid) {
      navigate('/explore?post=1');
    } else {
      openAuthModal({
        title: 'Post Your Room Listing',
        subtitle: DEMO_MODE_ENABLED
          ? 'Sign in or use the local demo to evaluate the listing workflow.'
          : 'Sign in to create and manage your room listing.',
        redirect: '/explore?post=1',
      });
    }
  };

  return (
    <div className="min-h-screen text-[#1E2229] font-sans selection:bg-[#FF5A36]/20 selection:text-[#FF5A36] overflow-x-hidden w-full max-w-full bg-[#FBFBFC]">
      {/* 1. Premium Navigation */}
      <LandingNavbar onListSpace={handleListSpace} />

      {/* 2. Hero Section + Hero Search Module + Popular Cities Quicklinks */}
      <HeroSection />

      {/* 3. Popular Cities 12-Grid (Delhi, Mumbai, Bengaluru, Pune, etc.) */}
      <PopularCitiesSection />

      {/* 4. Living Options (4 Category Cards: Private Rooms, Shared Rooms, PGs & Hostels, Coliving) */}
      <LivingOptionsSection />

      {/* 6. Statistics Strip (Live DB counts + verified members) */}
      <StatsStrip />

      {/* 7. Why NestMate / More than a platform, a community */}
      <TrustSection />

      {/* 8. Community Testimonial & Story Collage */}
      <CommunityTestimonialSection />

      {/* 9. How It Works (4 Steps with Clear Badges & Process) */}
      <HowItWorksSection />

      {/* 10. Featured Listings Carousel */}
      <FeaturedListingsSection />

      {/* 11. SEO Rental Guide & FAQ Accordion - FlatMate Reference */}
      <RentalGuideFaqSection />

      {/* 12. Final CTA Banner: Ready to find your people? */}
      <FinalCTASection />

      {/* 13. Comprehensive 5-Column Footer */}
      <LandingFooter onListSpace={handleListSpace} />
    </div>
  );
}
