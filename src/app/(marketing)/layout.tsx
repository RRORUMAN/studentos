import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";

/**
 * The public site: nav, footer, indexed. Everything a visitor sees before they
 * have an account.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteNav />
      <main id="main" className="flex-1 pt-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
