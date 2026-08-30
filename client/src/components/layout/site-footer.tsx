import { Link } from "@tanstack/react-router";
import { Globe, Instagram, Twitter } from "lucide-react";

/*
 * DESIGN.md footer-light: white surface matching the page canvas — there is no
 * contrast footer. Three columns of link blocks with 24px gutters, closed by a
 * legal-band strip carrying the copyright, locale picker and social icons in
 * muted caption-sm.
 */

const COLUMNS = [
  {
    title: "Support",
    links: [
      { label: "Help centre", to: "/" },
      { label: "Cancellation options", to: "/bookings" },
      { label: "Report a problem", to: "/profile" },
    ],
  },
  {
    title: "Booking",
    links: [
      { label: "Find a shop", to: "/" },
      { label: "Your bookings", to: "/bookings" },
      { label: "Past visits", to: "/history" },
    ],
  },
  {
    title: "Drop",
    links: [
      { label: "For barber shops", to: "/manage" },
      { label: "Your profile", to: "/profile" },
      { label: "Log in or sign up", to: "/auth" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-background">
      <div className="page py-12">
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="type-title-sm text-ink">{col.title}</h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-hairline pt-6 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Drop, Inc. · Privacy · Terms</p>
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Globe className="size-4" aria-hidden />
              English (IN)
            </span>
            <span>₹ INR</span>
            <span className="flex items-center gap-3">
              <a href="/" aria-label="Drop on X" className="hover:text-ink">
                <Twitter className="size-4" aria-hidden />
              </a>
              <a href="/" aria-label="Drop on Instagram" className="hover:text-ink">
                <Instagram className="size-4" aria-hidden />
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
