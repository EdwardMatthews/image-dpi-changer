import { m } from '@/paraglide/messages.js';
import { SiteFooter, type FooterColumn } from '@/components/site-footer';

export function Footer() {
  const columns: FooterColumn[] = [
    {
      title: m['landing.footer.feature'](),
      links: [
        { label: m['landing.nav.tool'](), href: '/#tool' },
        { label: m['landing.nav.how_it_works'](), href: '/#how-it-works' },
        { label: m['landing.nav.faq'](), href: '/#faq' },
      ],
    },
    {
      title: m['landing.footer.resources'](),
      links: [
        { label: m['landing.footer.privacy_note'](), href: '/#tool' },
        { label: m['landing.footer.print_note'](), href: '/#use-cases' },
      ],
    },
    {
      title: m['landing.footer.legal'](),
      links: [
        { label: m['landing.footer.privacy'](), href: '/privacy-policy' },
        { label: m['landing.footer.terms'](), href: '/terms-of-service' },
      ],
    },
  ];

  return (
    <SiteFooter tagline={m['landing.footer.tagline']()} columns={columns} />
  );
}
