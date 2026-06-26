import { m } from '@/paraglide/messages.js';
import { SiteHeader } from '@/components/site-header';

export function Header() {
  const navLinks = [
    { href: '/#tool', label: m['landing.nav.tool']() },
    { href: '/#how-it-works', label: m['landing.nav.how_it_works']() },
    { href: '/#faq', label: m['landing.nav.faq']() },
  ];

  return <SiteHeader navLinks={navLinks} showAuthActions={false} />;
}
