// apps/web/src/pages/ProfilePage.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

console.log("API_BASE_URL", API_BASE_URL);

export default function ProfilePage() {
  const storedUser = localStorage.getItem("wrld_user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const [form, setForm] = useState({
    username: user?.username || "",
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    dob: user?.dob ? user.dob.substring(0, 10) : "",
    avatarUrl: user?.avatarUrl || "",
    newPassword: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(form.avatarUrl || "");
  const [uploading, setUploading] = useState(false);

  // 👇 Username availability state
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [checkingUsername, setCheckingUsername] = useState(false);

  const navigate = useNavigate();

  // ✅ Debounce username availability check
  useEffect(() => {
    if (!form.username.trim() || user.username) return; // skip if empty or already locked

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/profile/check-username?username=${encodeURIComponent(
            form.username.trim()
          )}`
        );
        const data = await res.json();
        setUsernameAvailable(data.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [form.username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!form.username.trim()) return setError("Username is required.");
    if (!form.dob) return setError("Date of birth is required.");

    // ✅ Prevent saving unavailable usernames
    if (usernameAvailable === false) {
      return setError("That username is already taken.");
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId: user.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      localStorage.setItem("wrld_user", JSON.stringify(data.user));

      // 🔔 Notify app about profile change (refreshes header instantly)
      window.dispatchEvent(new Event("userUpdated"));

      setSuccess(true);

      // ✅ Redirect to setup page after successful profile update
      setTimeout(() => {
        navigate("/setup");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // 👇 Handle avatar file upload
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    setUploading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/upload/avatar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatarPreview(data.url);
      setForm({ ...form, avatarUrl: data.url });
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="profile-container">
      <h2>Set Up Your Profile</h2>
      <p className="profile-note">
        Your <strong>username</strong> and <strong>date of birth</strong> are
        required. Username <strong>cannot be changed</strong> later.
      </p>

      <form onSubmit={handleSubmit} className="profile-form">
        <label>
          Username <span style={{ color: "#00e0ff" }}>*</span>
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={form.username}
            onChange={(e) => {
              setForm({ ...form, username: e.target.value });
              setUsernameAvailable(null);
            }}
            disabled={!!user.username}
            required
          />

          {/* ✅ Username availability indicator */}
          {!user.username && form.username && (
            <span className="username-status">
              {checkingUsername ? (
                <span style={{ color: "#aaa" }}>Checking...</span>
              ) : usernameAvailable === true ? (
                <span style={{ color: "#00ff99" }}>✓ Available</span>
              ) : usernameAvailable === false ? (
                <span style={{ color: "tomato" }}>✗ Taken</span>
              ) : null}
            </span>
          )}
        </div>

        <label>First Name (optional)</label>
        <input
          type="text"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />

        <label>Last Name (optional)</label>
        <input
          type="text"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />

        <label>
          Date of Birth <span style={{ color: "#00e0ff" }}>*</span>
        </label>
        <input
          type="date"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          required
        />

        <label>Avatar</label>
        <div className="avatar-section">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar preview"
              className="avatar-preview"
            />
          ) : (
            <div className="avatar-initial">
              {user.username?.[0]?.toUpperCase() ||
                user.email?.[0]?.toUpperCase() ||
                "?"}
            </div>
          )}

          <div className="custom-file-upload">
            <label htmlFor="avatarFile">
              {uploading ? "Uploading..." : "Choose File"}
            </label>
            <input
              id="avatarFile"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        <label>Change Password (optional)</label>
        <input
          type="password"
          placeholder="Leave blank to keep current password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />

        {error && <p className="error">{error}</p>}
        {success && <p className="success">✅ Profile updated successfully!</p>}

        <button
          type="submit"
          className={`form-button ${loading ? "disabled" : ""}`}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
