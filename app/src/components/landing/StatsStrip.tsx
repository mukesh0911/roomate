import { useState, useEffect } from 'react';
import { Users, Home, MapPin, ShieldCheck } from 'lucide-react';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function StatsStrip() {
  const [statsData, setStatsData] = useState({
    usersCount: null as number | null,
    listingsCount: null as number | null,
  });

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      try {
        const [usersSnap, listingsSnap] = await Promise.allSettled([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'listings'), where('status', '==', 'active'))),
        ]);
        if (!mounted) return;
        setStatsData({
          usersCount: usersSnap.status === 'fulfilled' ? usersSnap.value.data().count : null,
          listingsCount: listingsSnap.status === 'fulfilled' ? listingsSnap.value.data().count : null,
        });
      } catch (e) {
        console.warn('Could not load live stats counts:', e);
      }
    }
    const handle = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(() => loadStats(), { timeout: 3500 })
      : setTimeout(loadStats, 2000);

    return () => {
      mounted = false;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, []);

  const stats = [
    {
      value: statsData.usersCount !== null
        ? `${statsData.usersCount.toLocaleString()}`
        : '?',
      label: 'Registered Profiles',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
    },
    {
      value: statsData.listingsCount !== null
        ? `${statsData.listingsCount.toLocaleString()}`
        : '?',
      label: 'Active Listing Records',
      icon: Home,
      iconBg: 'bg-orange-50 text-[#FF5A36]',
    },
    {
      value: 'Manual',
      label: 'Identity Review',
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      value: 'By city',
      label: 'Explore Locations',
      icon: MapPin,
      iconBg: 'bg-teal-50 text-teal-600',
    },
  ];

  return (
    <section className="py-6 sm:py-12 border-y border-gray-100/80 bg-white/40 backdrop-blur-xs">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6 lg:gap-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6 flex-1 w-full min-w-0">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-0 bg-white sm:bg-transparent rounded-2xl sm:rounded-none border border-gray-100 sm:border-none shadow-xs sm:shadow-none min-w-0"
                >
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full ${stat.iconBg} flex items-center justify-center shrink-0 shadow-xs`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="text-base sm:text-2xl font-bold text-[#1E2229] tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5 truncate">
                      {stat.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop handwritten note with underline (untouched on desktop) */}
          <div className="hidden xl:flex flex-col items-center pl-6 shrink-0 relative">
            <span className="font-script text-2xl text-[#1E2229] select-none -rotate-3">
              A happier way to live
            </span>
            <svg className="w-32 h-2 text-[#FF5A36] -mt-0.5 -rotate-2" viewBox="0 0 120 8" fill="none">
              <path d="M2 5C35 2 75 7 118 3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
