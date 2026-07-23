
import React from "react";
import logoIcon from "../assets/logo-icon.png";

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "transition-transform hover:scale-105 duration-300", size = 32 }: LogoProps) {
  return (
    <img
      src={logoIcon}
      alt="Palazzinaro AI"
      width={size}
      height={size}
      className={`object-cover rounded-md ${className}`}
      id="app-logo-img"
    />
  );
}

