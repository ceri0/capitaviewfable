import React, { useState } from "react";

export default function ProtocolLogo({ name, slug, size = 32 }) {
  const [error, setError] = useState(false);
  
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const logoUrl = slug ? `https://icons.llama.fi/icons/protocols/${slug}.png` : null;

  const colors = [
    '#a97bd1', '#34d399', '#60a5fa', '#f472b6', '#fbbf24',
    '#fb923c', '#a78bfa', '#2dd4bf', '#f87171', '#6ee7b7'
  ];
  const colorIndex = name.length % colors.length;
  const bgColor = colors[colorIndex];

  if (error || !logoUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{ 
          width: size, 
          height: size, 
          fontSize: size * 0.35,
          backgroundColor: bgColor
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setError(true)}
    />
  );
}