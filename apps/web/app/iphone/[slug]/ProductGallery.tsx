"use client";

import Image from "next/image";
import { useState } from "react";

type ProductGalleryProps = {
  name: string;
  brand: string;
  images: readonly string[];
};

export function ProductGallery({ name, brand, images }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedImage = images[selectedIndex];

  if (images.length === 0) {
    return (
      <div className="product-gallery" aria-label={`Galería de ${name}`}>
        <div className="product-image large">
          <span>{brand}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="product-gallery" aria-label={`Galería de ${name}`}>
      <div className="product-image large product-image-primary">
        <Image
          key={selectedImage}
          src={selectedImage}
          alt={`${name} vista ${selectedIndex + 1}`}
          width={900}
          height={900}
          priority={selectedIndex === 0}
          sizes="(max-width: 800px) 100vw, 55vw"
          unoptimized={selectedImage.startsWith("/api/media/")}
        />
      </div>

      {images.length > 1 &&
        images.map((image, index) => (
          <button
            className={`product-image-thumb${index === selectedIndex ? " selected" : ""}`}
            key={image}
            type="button"
            onClick={() => setSelectedIndex(index)}
            aria-label={`Mostrar ${name}, imagen ${index + 1}`}
            aria-current={index === selectedIndex ? "true" : undefined}
          >
            <Image
              src={image}
              alt={`${name} miniatura ${index + 1}`}
              width={96}
              height={96}
              sizes="96px"
              unoptimized={image.startsWith("/api/media/")}
            />
          </button>
        ))}
    </div>
  );
}
