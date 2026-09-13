"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HomeSlide } from "../../lib/homeCarousel";

export default function HomeCarousel({ slides }: { slides: HomeSlide[] }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(
      () => setCurrent((index) => (index + 1) % slides.length),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);
  if (!slides.length) return null;
  const slide = slides[current] ?? slides[0];
  if (!slide) return null;
  return (
    <section className="home-carousel" aria-label="Promociones destacadas">
      <div className="home-carousel-copy">
        <p className="eyebrow">{slide.eyebrow}</p>
        <h2>{slide.title}</h2>
        <p>{slide.description}</p>
        <Link className="button secondary" href={slide.href} style={{ color: "#171715" }}>
          Ver más <span aria-hidden="true">→</span>
        </Link>
        {slides.length > 1 && (
          <div className="home-carousel-controls">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === current ? "active" : ""}
                aria-label={`Mostrar promoción ${index + 1}`}
                aria-current={index === current ? "true" : undefined}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        )}
      </div>
      <img src={slide.imageUrl} alt={slide.title} className="home-carousel-image" />
    </section>
  );
}
