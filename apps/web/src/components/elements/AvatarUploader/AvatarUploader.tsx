import React from "react";
import Avatar from "../Avatar/Avatar";
import "../../01-main/main.css";

interface AvatarUploaderProps {
  avatarUrl: string;
  username?: string;
  email?: string;
  uploading: boolean;
  onUpload: (file: File) => void; // ✅ accepts File directly
}

export default function AvatarUploader({
  avatarUrl,
  username,
  email,
  uploading,
  onUpload,
}: AvatarUploaderProps) {
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }

  return (
    <div className="avatar-uploader">
      <Avatar
        avatarUrl={avatarUrl}
        username={username}
        email={email}
        size={80}
      />

      <div className="custom-file-upload">
        <label htmlFor="avatarFile">
          {uploading ? "Uploading..." : "Choose File"}
        </label>
        <input
          id="avatarFile"
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={handleFileChange} // ✅ uses local wrapper
        />
      </div>
    </div>
  );
}
