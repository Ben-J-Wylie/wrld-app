// apps/web/src/components/Header.tsx
import React, { useState, useRef, useEffect } from "react";
import { useAuthModal } from "../context/AuthModalContext";
import { ChevronDown, LogOut, User } from "lucide-react";

export default function Header({
  user,
  onLogout,
}: {
  user: any;
  onLogout?: () => void;
}) {
  const { openLogin, openSignup } = useAuthModal();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="wrld-logo">WRLD</h1>
      </div>

      <div className="header-right">
        {user ? (
          <div className="user-dropdown" ref={menuRef}>
            <button
              className="user-button"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="user-email">{user.username || user.email}</span>
              <ChevronDown size={16} style={{ marginLeft: 6 }} />
            </button>

            {menuOpen && (
              <div className="dropdown-menu">
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    window.location.href = "/profile";
                  }}
                >
                  <User size={14} style={{ marginRight: 8 }} /> Profile
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    localStorage.removeItem("wrld_user");
                    localStorage.removeItem("wrld_token");
                    setMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                >
                  <LogOut size={14} style={{ marginRight: 8 }} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button onClick={openSignup} className="nav-link">
              Sign Up
            </button>
            <button onClick={openLogin} className="nav-link">
              Log In
            </button>
          </>
        )}
      </div>
    </header>
  );
}
