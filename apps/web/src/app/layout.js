import '@radix-ui/themes/styles.css';
import './globals.css';
import { Theme } from '@radix-ui/themes';

export const metadata = {
  title: 'Estoque Inteligente',
  description: 'Gestão inteligente de estoque e previsão de demanda',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c7767',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Theme accentColor="teal" grayColor="slate" radius="large" scaling="100%">
          {children}
        </Theme>
      </body>
    </html>
  );
}
