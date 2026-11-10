import { describe, expect, it } from "vitest";
import {
  calculateProfileCompatibility,
  calculateRoomCompatibility,
} from "./matching";

describe("evidence-based weighted compatibility", () => {
  const full = {
    city: "Pune",
    localities: ["Baner"],
    budget: 15000,
    preferredRoomTypes: ["Private room"],
    occupancyPreference: "single",
    quizAnswers: {
      diet: "Vegetarian",
      smoke: "Non-smoker",
      sleep: "Early riser",
      clean: "Very tidy",
      guests: "rarely",
    },
  };
  it("requires evidence across every dimension for 100 and is symmetric", () => {
    expect(calculateProfileCompatibility(full, full).score).toBe(100);
    const peer = { ...full, budget: 20000, city: "Chennai" };
    expect(calculateProfileCompatibility(full, peer).score).toBe(
      calculateProfileCompatibility(peer, full).score
    );
    expect(calculateProfileCompatibility(full, peer).score).toBeLessThan(60);
  });
  it("does not turn one shared answer into a 100 percent match", () => {
    const sparse = { quizAnswers: { diet: "Vegetarian" } };
    expect(calculateProfileCompatibility(sparse, sparse).score).toBe(6);
    expect(calculateProfileCompatibility({}, {}).score).toBe(0);
    expect(calculateRoomCompatibility({}, {})).toBe(0);
  });
  it("normalizes stored preference aliases consistently", () => {
    const modern = {
      ...full,
      quizAnswers: {
        food_pref: "veg",
        smoking: "never",
        sleep_time: "before_10",
        cleanliness: "very",
        guests: "rarely",
      },
    };
    expect(calculateProfileCompatibility(full, modern).score).toBe(100);
  });
  it("changes rank for actual budget, location, room and occupancy conflicts", () => {
    const poor = {
      ...full,
      budget: 5000,
      localities: ["Other"],
      preferredRoomTypes: ["Full flat"],
      occupancyPreference: "shared",
    };
    expect(calculateProfileCompatibility(full, poor).score).toBeLessThan(
      calculateProfileCompatibility(full, full).score
    );
    expect(
      calculateRoomCompatibility(
        { ...full, onboardingComplete: false },
        { city: "Pune", monthlyRent: 10000 }
      )
    ).toBe(0);
  });
});


it('keeps legacy mixed-schema display answers and malformed preference lists safe', () => {
  const current = { quizAnswers: { diet: 'Vegetarian', food_pref: 'non_veg' }, localities: 'Baner', preferredRoomTypes: 'Private room' };
  const peer = { quizAnswers: { food_pref: 'veg' } };
  expect(calculateProfileCompatibility(current, peer).score).toBe(6);
  expect(calculateProfileCompatibility(current, peer).score).toBe(calculateProfileCompatibility(peer, current).score);
});
