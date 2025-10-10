import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthModal } from "../context/AuthModalContext";
import { Settings, User, LogOut } from "lucide-react";

export default function Header({ user, onLogout }: any) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { openLogin, openSignup } = useAuthModal();

  // ✅ handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        handleCloseDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCloseDropdown() {
    // trigger fade-out before closing
    setFadeOut(true);
    setTimeout(() => {
      setDropdownOpen(false);
      setFadeOut(false);
    }, 150); // matches CSS animation time
  }

  function handleOpenDropdown() {
    setDropdownOpen(true);
    setFadeOut(false);
  }

  return (
    <header className="header">
      <div className="logo">WRLD</div>

      <div className="nav-right">
        {user ? (
          <div className="user-info" ref={dropdownRef}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="user-avatar" />
            ) : (
              <div className="user-initial">
                {(user.username?.[0] || user.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <span className="user-name">{user.username || user.email}</span>

            <button
              onClick={() =>
                dropdownOpen ? handleCloseDropdown() : handleOpenDropdown()
              }
              className="nav-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              ▾
            </button>

            {dropdownOpen && (
              <div
                className={`dropdown-menu ${fadeOut ? "fade-out" : "fade-in"}`}
              >
                <button
                  onClick={() => {
                    navigate("/setup");
                    handleCloseDropdown();
                  }}
                >
                  <Settings size={18} />
                  Setup
                </button>
                <button
                  onClick={() => {
                    navigate("/profile");
                    handleCloseDropdown();
                  }}
                >
                  <User size={18} />
                  Profile
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    handleCloseDropdown();
                  }}
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={openLogin}>Login</button>
            <button onClick={openSignup}>Sign Up</button>
          </>
        )}
      </div>
    </header>
  );
}
