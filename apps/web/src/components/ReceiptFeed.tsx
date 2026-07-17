import { ActivityEvent, priceLabel } from "../api";

type ReceiptFeedProps = {
  events: ActivityEvent[];
  newEventIds?: Set<string>;
};

export function ReceiptFeed({ events, newEventIds = new Set() }: ReceiptFeedProps) {
  return (
    <section className="receipt" aria-labelledby="activity-title">
      <div className="receipt__perforation" aria-hidden="true" />
      <header className="receipt__header">
        <div>
          <p className="eyebrow">Live receipt</p>
          <h2 id="activity-title">Workspace activity</h2>
        </div>
        <span className="receipt__live"><span /> LIVE</span>
      </header>
      <div className="receipt__rule" aria-hidden="true">********************************</div>
      <div className="receipt__body">
        {events.slice(0, 12).map((event) => {
          const copy = receiptCopy(event);
          return (
            <article className={`receipt-row ${newEventIds.has(event.id) ? "receipt-row--new" : ""}`} key={event.id}>
              <time dateTime={event.createdAt}>{receiptTime(event.createdAt)}</time>
              <div className="receipt-row__line">
                <span>{copy}</span>
                <span className="receipt-row__leaders" aria-hidden="true" />
                <strong>{firstName(event.actor.name)}</strong>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="receipt__footer">
        <span>{events.length.toString().padStart(2, "0")} EVENTS</span>
        <span>SYNCED NOW</span>
      </footer>
    </section>
  );
}

function receiptCopy(event: ActivityEvent) {
  const title = String(event.metadata.title ?? "an item");
  if (event.eventType === "product_added") return `Added ${title}`;
  if (event.eventType === "vote_cast") return `${voteWord(String(event.metadata.voteType))} ${title}`;
  if (event.eventType === "comment_added") return `Commented on ${title}`;
  const from = priceLabel(Number(event.metadata.from));
  const to = priceLabel(Number(event.metadata.to));
  return `${title} ${from} -> ${to}`;
}

function voteWord(vote: string) {
  if (vote === "love") return "Loved";
  if (vote === "pass") return "Passed on";
  return "Favorited";
}

function firstName(name: string) {
  return name.split(" ")[0]?.toUpperCase() ?? name.toUpperCase();
}

function receiptTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}
