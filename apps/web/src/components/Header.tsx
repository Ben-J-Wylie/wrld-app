import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Header({ user, onLogout }: any) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
                  Setup
                </button>
                <button
                  onClick={() => {
                    navigate("/profile");
                    handleCloseDropdown();
                  }}
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    handleCloseDropdown();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button className="nav-link">Sign Up</button>
            <button className="nav-link">Log In</button>
          </>
        )}
      </div>
    </header>
  );
}
