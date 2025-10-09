// apps/web/src/components/Header.tsx
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuthModal } from "../context/AuthModalContext";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const { openLogin, openSignup } = useAuthModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleProfileClick() {
    navigate("/profile");
    setMenuOpen(false);
  }

  function handleLogoutClick() {
    localStorage.removeItem("wrld_token");
    localStorage.removeItem("wrld_user");
    onLogout();
    setMenuOpen(false);
  }

  return (
    <header className="header">
      <div className="logo">🌐 WRLD</div>

      <div className="nav-right">
        {user ? (
          <div className="user-menu">
            <div className="user-info" onClick={() => setMenuOpen(!menuOpen)}>
              {/* ✅ Avatar or Initial */}
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  className="user-avatar"
                />
              ) : (
                <div className="user-initial">
                  {user.username?.[0]?.toUpperCase() ||
                    user.email?.[0]?.toUpperCase() ||
                    "?"}
                </div>
              )}

              <span className="user-name">{user.username || user.email}</span>
              <ChevronDown
                size={16}
                style={{
                  marginLeft: "6px",
                  opacity: 0.6,
                }}
              />
            </div>

            {menuOpen && (
              <div className="dropdown-menu">
                <button onClick={handleProfileClick}>Profile</button>
                <button onClick={handleLogoutClick}>Sign Out</button>
              </div>
            )}
          </div>
        ) : (
          <div className="auth-links">
            <button onClick={openSignup} className="nav-link">
              Sign Up
            </button>
            <button onClick={openLogin} className="nav-link">
              Log In
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
