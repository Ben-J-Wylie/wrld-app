// @ts-nocheck

import React, { useState } from "react";
import AvatarUploader from "./components/05-elements/AvatarUploader/AvatarUploader";

export default function App() {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // 🧠 Simulated file upload — creates a temporary local preview
  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    // Simulate upload delay (1.5s)
    setTimeout(() => {
      const previewUrl = URL.createObjectURL(file);
      setAvatarUrl(previewUrl);
      setUploading(false);
    }, 1500);
  }

  return (
    <div className="app-wrapper">
      <h1>Avatar Uploader Demo</h1>

      <div className="avatar-demo">
        <AvatarUploader
          avatarUrl={avatarUrl}
          username="Ben"
          uploading={uploading}
          onUpload={handleUpload}
        />

        {uploading ? (
          <p className="message info">Uploading your new avatar...</p>
        ) : avatarUrl ? (
          <p className="message success">✅ Avatar updated!</p>
        ) : (
          <p className="message hint">No avatar selected yet.</p>
        )}
      </div>
    </div>
  );
}
