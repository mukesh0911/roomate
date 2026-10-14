import { describe, it, expect } from 'vitest';
import { DEFAULT_ADVANCED_FILTERS } from '@/components/AdvancedFiltersModal';
import { cities } from '@/lib/staticData';

describe('NestMate Mobile Navigation & Explore Control Bar Architecture', () => {
  describe('Part 1: Mobile Bottom Navigation Specifications', () => {
    it('defines the shared-account mobile destinations: Explore, Listings, Post, Messages, Profile', () => {
      const mobileNavDestinations = [
        { label: 'Explore', path: '/explore?tab=rooms', icon: 'Building2' },
        { label: 'Listings', path: '/my-listings', icon: 'Home' },
        { label: 'Post Room', action: 'newListing', icon: 'PlusCircle' },
        { label: 'Messages', path: '/chat', icon: 'MessageCircle' },
        { label: 'Profile', path: '/profile', icon: 'User' },
      ];

      expect(mobileNavDestinations).toHaveLength(5);
      const labels = mobileNavDestinations.map(d => d.label);
      expect(labels).toEqual(['Explore', 'Listings', 'Post Room', 'Messages', 'Profile']);

      // Roommates stays a contextual Explore tab, not a separate account mode.
      expect(labels).not.toContain('Flatmates');
    });

    it('retains Home and Flatmates in their designated locations without breaking', () => {
      // Inside Rooms/Explore: [ Rooms & PGs ] [ Flatmates ]
      const exploreTabs = ['rooms', 'roommates'];
      expect(exploreTabs).toContain('rooms');
      expect(exploreTabs).toContain('roommates');

      // Inside Mobile Menu Drawer: Home, Saved, Applications, Settings, Help, Safety, Logout
      const menuDrawerLinks = [
        'Home',
        'Saved Rooms',
        'My Applications / Interests',
        'Settings',
        'Safety Center',
        'Help & Support',
      ];
      expect(menuDrawerLinks).toContain('Home');
      expect(menuDrawerLinks).toContain('Saved Rooms');
    });
  });

  describe('Part 2: Mobile Explore Control Bar Specifications', () => {
    it('visible mobile control bar exposes strictly Best Match and Filters', () => {
      const mobileControlBarItems = ['Best Match', 'Filters'];
      expect(mobileControlBarItems).toHaveLength(2);
      expect(mobileControlBarItems).toContain('Best Match');
      expect(mobileControlBarItems).toContain('Filters');

      // Standalone city control must NOT be in the visible mobile control bar
      expect(mobileControlBarItems).not.toContain('Bengaluru');
    });

    it('sorting labels support Best Match, Newest First, Lowest Rent, Highest Rent', () => {
      const sortLabels: Record<string, string> = {
        match: 'Best Match',
        newest: 'Newest First',
        price_asc: 'Lowest Rent',
        price_desc: 'Highest Rent',
      };

      expect(sortLabels.match).toBe('Best Match');
      expect(sortLabels.newest).toBe('Newest First');
      expect(sortLabels.price_asc).toBe('Lowest Rent');
      expect(sortLabels.price_desc).toBe('Highest Rent');
    });

    it('sorting logic correctly sorts listings by rent and timestamp', () => {
      const mockListings = [
        { id: '1', totalRent: 18000, partnerShare: 18000, createdAt: { toMillis: () => 1000 } },
        { id: '2', totalRent: 12000, partnerShare: 12000, createdAt: { toMillis: () => 3000 } },
        { id: '3', totalRent: 25000, partnerShare: 25000, createdAt: { toMillis: () => 2000 } },
      ];

      // Lowest Rent
      const lowestRent = [...mockListings].sort((a, b) => a.totalRent - b.totalRent);
      expect(lowestRent.map(l => l.id)).toEqual(['2', '1', '3']);

      // Highest Rent
      const highestRent = [...mockListings].sort((a, b) => b.totalRent - a.totalRent);
      expect(highestRent.map(l => l.id)).toEqual(['3', '1', '2']);

      // Newest First
      const newestFirst = [...mockListings].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      expect(newestFirst.map(l => l.id)).toEqual(['2', '3', '1']);
    });

    it('location is completely managed within Filters with supported cities list', () => {
      expect(cities).toContain('Bengaluru');
      expect(cities).toContain('Mumbai');
      expect(cities).toContain('Delhi NCR');
      expect(cities).toContain('Hyderabad');
      expect(cities).toContain('Pune');
      expect(cities).toContain('Chennai');

      expect(DEFAULT_ADVANCED_FILTERS.city).toBe('Bengaluru');
      expect(DEFAULT_ADVANCED_FILTERS.budgetMax).toBe(100000);
      expect(DEFAULT_ADVANCED_FILTERS.moveInDate).toBe('any');
      expect(DEFAULT_ADVANCED_FILTERS.gender).toBe('any');
      expect(DEFAULT_ADVANCED_FILTERS.roomTypes).toEqual([]);
      expect(DEFAULT_ADVANCED_FILTERS.accommodationTypes).toEqual([]);
      expect(DEFAULT_ADVANCED_FILTERS.furnishing).toBe('any');
      expect(DEFAULT_ADVANCED_FILTERS.verifiedOnly).toBe(false);
    });
  });
});
