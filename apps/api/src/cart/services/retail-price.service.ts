import { Injectable, Logger } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ObservedPrice = {
  amount: number;
  currency?: string;
};

/**
 * Reads prices intentionally published in a product page's structured data.
 * This is a best-effort generic integration: it does not bypass retailer bot
 * protections or execute page JavaScript.
 */
@Injectable()
export class RetailPriceService {
  private readonly logger = new Logger(RetailPriceService.name);

  async read(urlValue: string): Promise<ObservedPrice | null> {
    let url: URL;
    try {
      url = new URL(urlValue);
    } catch {
      this.logger.warn("Skipping product with an invalid tracking URL");
      return null;
    }

    if (!this.isSupportedUrl(url)) {
      this.logger.warn(`Skipping unsupported tracking URL protocol for ${url.hostname}`);
      return null;
    }

    try {
      const response = await this.fetchPublicPage(url);
      if (!response) return null;
      if (!response.ok) {
        this.logger.warn(`Price lookup returned HTTP ${response.status} for ${url.hostname}`);
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (!contentType.includes("text/html") || contentLength > 2_000_000) {
        this.logger.warn(`Price lookup returned an unsupported response for ${url.hostname}`);
        return null;
      }

      return this.extractPrice(await response.text());
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unknown error";
      this.logger.warn(`Price lookup failed for ${url.hostname}: ${reason}`);
      return null;
    }
  }

  private async fetchPublicPage(initialUrl: URL) {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 4; redirects += 1) {
      if (!this.isSupportedUrl(url) || !(await this.resolvesToPublicAddress(url.hostname))) {
        this.logger.warn(`Skipping non-public tracking URL for ${url.hostname}`);
        return null;
      }
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "CartPartyPriceTracker/1.0 (+https://cartparty.app)"
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000)
      });
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("location");
      if (!location) return response;
      url = new URL(location, url);
    }
    this.logger.warn(`Price lookup exceeded redirect limit for ${initialUrl.hostname}`);
    return null;
  }

  private isSupportedUrl(url: URL) {
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  }

  private async resolvesToPublicAddress(hostname: string) {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !this.isPrivateAddress(address));
  }

  private isPrivateAddress(address: string) {
    if (isIP(address) === 4) {
      const [first, second] = address.split(".").map(Number);
      return first === 0 || first === 10 || first === 127 || first === 169 && second === 254 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
    }
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
  }

  private extractPrice(html: string): ObservedPrice | null {
    for (const script of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const observed = this.findStructuredPrice(JSON.parse(this.decodeHtml(script[1])));
        if (observed) return observed;
      } catch {
        // Invalid JSON-LD is common; continue with the next structured-data block.
      }
    }

    const amount = this.metaContent(html, ["product:price:amount", "price", "product:price"]);
    return this.toObservedPrice(amount, this.metaContent(html, ["product:price:currency", "priceCurrency"]));
  }

  private findStructuredPrice(value: unknown): ObservedPrice | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const observed = this.findStructuredPrice(item);
        if (observed) return observed;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    const offers = record.offers ?? (record["@type"] === "Offer" ? record : undefined);
    if (offers) {
      const observed = this.findOfferPrice(offers, typeof record.priceCurrency === "string" ? record.priceCurrency : undefined);
      if (observed) return observed;
    }
    for (const child of Object.values(record)) {
      const observed = this.findStructuredPrice(child);
      if (observed) return observed;
    }
    return null;
  }

  private findOfferPrice(offers: unknown, inheritedCurrency?: string): ObservedPrice | null {
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        const observed = this.findOfferPrice(offer, inheritedCurrency);
        if (observed) return observed;
      }
      return null;
    }
    if (!offers || typeof offers !== "object") return null;
    const offer = offers as Record<string, unknown>;
    const amount = offer.price ?? offer.lowPrice;
    const currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency : inheritedCurrency;
    return this.toObservedPrice(amount, currency);
  }

  private metaContent(html: string, names: string[]) {
    for (const tag of html.matchAll(/<meta\s+[^>]*>/gi)) {
      const element = tag[0];
      const name = /(?:name|property|itemprop)=["']([^"']+)["']/i.exec(element)?.[1];
      if (name && names.some((candidate) => candidate.toLowerCase() === name.toLowerCase())) {
        return /content=["']([^"']+)["']/i.exec(element)?.[1];
      }
    }
    return undefined;
  }

  private toObservedPrice(value: unknown, currency?: string): ObservedPrice | null {
    const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999) return null;
    const normalizedCurrency = currency?.trim().toUpperCase();
    return { amount: Number(amount.toFixed(2)), currency: normalizedCurrency && /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : undefined };
  }

  private decodeHtml(value: string) {
    return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
  }
}
