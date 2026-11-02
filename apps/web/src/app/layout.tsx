import './globals.css';
import { QueryProvider } from '../providers/query-provider';
import { AuthProvider } from '../contexts/auth-context';
import { SettingsProvider } from '../contexts/settings-context';

export const metadata = {
  title: 'Obsidian Panel — Game Server Management',
  description: 'Production-grade self-hosted game server management panel',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary min-h-screen">
        <QueryProvider>
          <SettingsProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </SettingsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
