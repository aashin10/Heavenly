import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const BRAND = 'Heavenly Corporation';

/** Production origin — used to build absolute canonical / og:url / og:image URLs. */
const SITE_ORIGIN = 'https://heavenlycorporation.com';

const SOCIAL_CARD = `${SITE_ORIGIN}/assets/social-card.png`;

const DEFAULT_DESCRIPTION =
  'Heavenly Corporation — manpower supply and recruitment, transformer rewinding, ' +
  'and technical services across India.';

/**
 * Sets the document title plus description, Open Graph, Twitter card and the
 * canonical link from route config.
 *
 * Routes provide a bare `title` (e.g. "Our Services") and, optionally,
 * `data: { description }`. The brand suffix is appended here so every route
 * reads consistently instead of each file hard-coding "| Heavenly".
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    const fullTitle = routeTitle ? `${routeTitle} | ${BRAND}` : BRAND;
    this.title.setTitle(fullTitle);

    const description = this.findDescription(snapshot) ?? DEFAULT_DESCRIPTION;
    // Strip query/fragment so canonical points at one clean URL per page.
    // The root keeps its trailing slash to match the sitemap's <loc>.
    const path = snapshot.url.split(/[?#]/)[0];
    const canonical = path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;

    this.meta.updateTag({ name: 'description', content: description });

    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:image', content: SOCIAL_CARD });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: SOCIAL_CARD });

    this.setCanonical(canonical);
  }

  /** Meta service only handles <meta>; the canonical <link> is managed here. */
  private setCanonical(href: string): void {
    const head = this.document.head;
    if (!head) return;

    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** Deepest activated route wins, so child routes can override the parent. */
  private findDescription(snapshot: RouterStateSnapshot): string | undefined {
    let route = snapshot.root;
    let description: string | undefined;
    while (route) {
      const candidate = route.data?.['description'];
      if (typeof candidate === 'string' && candidate.length > 0) {
        description = candidate;
      }
      route = route.firstChild!;
    }
    return description;
  }
}
