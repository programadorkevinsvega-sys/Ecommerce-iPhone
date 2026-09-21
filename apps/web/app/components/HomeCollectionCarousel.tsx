"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeCollectionItem } from "../../lib/homeCarousel";

export default function HomeCollectionCarousel({
  title,
  items,
}: {
  title: string;
  items: HomeCollectionItem[];
}) {
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (items.length < 5) return;
    const timer = window.setInterval(() => setStart((value) => (value + 1) % items.length), 5000);
    return () => window.clearInterval(timer);
  }, [items.length]);
  if (!items.length) return null;
  const visible = Array.from(
    { length: Math.min(4, items.length) },
    (_, index) => items[(start + index) % items.length],
  ).filter((item): item is HomeCollectionItem => Boolean(item));
  return (
    <section className="home-collection section">
      <div className="section-heading">
        <p className="eyebrow">Catálogo real</p>
        <h2>{title}</h2>
      </div>
      <div className="home-collection-grid">
        {visible.map((item) => (
          <Link className="home-collection-card" href={item.href} key={item.id}>
            <div className="home-collection-media">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={640}
                  height={440}
                  sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 25vw"
                  unoptimized={item.imageUrl.startsWith("/api/media/")}
                />
              ) : (
                <span aria-hidden="true">{item.eyebrow}</span>
              )}
            </div>
            <p className="eyebrow">{item.eyebrow}</p>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="home-collection-link">Ver más →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
