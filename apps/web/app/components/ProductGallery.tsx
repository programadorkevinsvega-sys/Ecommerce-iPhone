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

  if (images.length === 0) {
    return (
      <div className="product-gallery" aria-label={`Galería de ${name}`}>
        <div className="product-image large">
          <span>{brand}</span>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(selectedIndex, images.length - 1);
  const selectedImage = images[safeIndex];
  if (!selectedImage) return null;

  return (
    <div className="product-gallery" aria-label={`Galería de ${name}`}>
      <div className="product-image large product-image-primary">
        <Image
          src={selectedImage}
          alt={`${name} imagen ${safeIndex + 1}`}
          width={900}
          height={900}
          priority
          sizes="(max-width: 800px) 100vw, 55vw"
          unoptimized={selectedImage.startsWith("/api/media/")}
        />
      </div>

      {images.length > 1 && (
        <div className="product-gallery-thumbnails" role="list" aria-label="Imágenes del producto">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={`product-image-thumb${index === safeIndex ? " selected" : ""}`}
              onClick={() => setSelectedIndex(index)}
              aria-label={`Ver imagen ${index + 1} de ${images.length}`}
              aria-current={index === safeIndex ? "true" : undefined}
              role="listitem"
            >
              <Image
                src={image}
                alt=""
                width={96}
                height={96}
                sizes="96px"
                unoptimized={image.startsWith("/api/media/")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
