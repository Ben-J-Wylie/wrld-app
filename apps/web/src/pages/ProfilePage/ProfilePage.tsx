import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 🧩 Components
import FormContainer from "../../elements/FormContainer/FormContainer";
import FormTitle from "../../elements/FormTitle/FormTitle";
import InputUsername from "../../elements/InputUsername/InputUsername";
import InputText from "../../elements/InputText/InputText";
import InputPassword from "../../elements/InputPassword/InputPassword";
import FormMessage from "../../elements/FormMessage/FormMessage";
import ButtonPrimary from "../../elements/ButtonPrimary/ButtonPrimary";
import AvatarUploader from "../../elements/AvatarUploader/AvatarUploader";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:4000";

export default function ProfilePage() {
  const navigate = useNavigate();

  // ✅ Retrieve stored user
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

  const [avatarPreview, setAvatarPreview] = useState(form.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 👇 Username availability state
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [checkingUsername, setCheckingUsername] = useState(false);

  // ✅ Debounce username availability check
  useEffect(() => {
    if (!form.username.trim() || user.username) return;

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
    }, 400);

    return () => clearTimeout(timer);
  }, [form.username]);

  // ✅ Handle avatar upload
  async function handleAvatarUpload(file: File) {
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

  // ✅ Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!form.username.trim()) return setError("Username is required.");
    if (!form.dob) return setError("Date of birth is required.");
    if (usernameAvailable === false)
      return setError("That username is already taken.");

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
      window.dispatchEvent(new Event("userUpdated"));

      setSuccess(true);
      setTimeout(() => navigate("/setup"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormContainer>
      <form onSubmit={handleSubmit}>
        <FormTitle>Set Up Your Profile</FormTitle>
        <p className="profile-note">
          Your <strong>username</strong> and <strong>date of birth</strong> are
          required. Username <strong>cannot be changed</strong> later.
        </p>

        <InputUsername
          label="Username"
          value={form.username}
          onChange={(e) => {
            setForm({ ...form, username: e.target.value });
            setUsernameAvailable(null);
          }}
          disabled={!!user.username}
          required
          checking={checkingUsername}
          available={usernameAvailable}
        />

        <InputText
          label="First Name (optional)"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />

        <InputText
          label="Last Name (optional)"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />

        <InputText
          type="date"
          label="Date of Birth"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          required
        />

        <AvatarUploader
          avatarUrl={avatarPreview}
          uploading={uploading}
          onUpload={handleAvatarUpload}
          username={user.username}
          email={user.email}
        />

        <InputPassword
          label="Change Password (optional)"
          placeholder="Leave blank to keep current password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />

        {error && <FormMessage type="error">{error}</FormMessage>}
        {success && (
          <FormMessage type="success">
            ✅ Profile updated successfully!
          </FormMessage>
        )}

        <ButtonPrimary type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Profile"}
        </ButtonPrimary>
      </form>
    </FormContainer>
  );
}
