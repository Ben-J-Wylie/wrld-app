import React from "react";
import "../../_main/main.css";

interface AvatarProps {
  avatarUrl?: string;
  username?: string;
  email?: string;
  size?: number; // optional pixel size (default 32)
}

export default function Avatar({
  avatarUrl,
  username,
  email,
  size = 32,
}: AvatarProps) {
  const initial = (username?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <div
      className="avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="User Avatar" className="avatar-img" />
      ) : (
        <div className="avatar-initial">{initial}</div>
      )}
    </div>
  );
}
