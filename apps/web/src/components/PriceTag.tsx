import { TrendingDown } from "lucide-react";
import { priceLabel } from "../api";

type PriceTagProps = {
  value?: string | number | null;
  currency?: string;
  delta?: number | null;
  flash?: boolean;
  className?: string;
};

export function PriceTag({ value, currency = "USD", delta, flash = false, className = "" }: PriceTagProps) {
  const isDrop = delta != null && delta < 0;

  return (
    <span className={`price-tag ${isDrop ? "price-tag--drop" : ""} ${flash ? "price-tag--flash" : ""} ${className}`}>
      <span className="price-tag__inner">
        <span className="price-tag__hole" aria-hidden="true" />
        <span className="price-tag__value">{priceLabel(value, currency)}</span>
        {isDrop ? (
          <span className="price-tag__delta">
            <TrendingDown size={12} strokeWidth={2.5} aria-hidden="true" />
            {priceLabel(Math.abs(delta), currency)}
          </span>
        ) : null}
      </span>
    </span>
  );
}
