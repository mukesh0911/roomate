import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResetResult {
  success: boolean;
  timestamp: string;
  clearedFiles: string[];
  protectedAccountsPreserved: string[];
}

export async function resetTestUniverse(): Promise<ResetResult> {
  const dataDir = path.resolve(__dirname, '../data');
  const clearedFiles: string[] = [];

  const universeFile = path.join(dataDir, 'seed-universe.json');
  if (fs.existsSync(universeFile)) {
    fs.unlinkSync(universeFile);
    clearedFiles.push('tests/data/seed-universe.json');
  }

  const protectedAccounts = [
    'mukvr46@gmail.com',
    'mrmukeshram111@gmail.com',
    'seeker@example.com',
  ];

  return {
    success: true,
    timestamp: new Date().toISOString(),
    clearedFiles,
    protectedAccountsPreserved: protectedAccounts,
  };
}
