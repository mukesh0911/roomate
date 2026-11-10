import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('current route and landing search integration', () => {
 it('defines actual current destinations for existing member navigation', () => {
  const app=readFileSync(resolve(__dirname,'../App.tsx'),'utf8');
  for(const route of ['/explore','/saved','/messages','/connections','/listings','/profile']) expect(app).toContain('path="'+route+'"');
 });
 it('hands off explicit query, budget and move-in through the URL', () => {
  const hero=readFileSync(resolve(__dirname,'../components/landing/HeroSearchModule.tsx'),'utf8');
  expect(hero).toContain('new URLSearchParams');
  expect(hero).toContain('max: String(selectedBudget.max)');
  expect(hero).toContain('move: moveInDate');
 });
});
