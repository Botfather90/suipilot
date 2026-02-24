import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SuiPilot — AI DeFi Execution Protocol',
  description: 'Autonomous DeFi execution on Sui with AI agents and on-chain guard rails',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
