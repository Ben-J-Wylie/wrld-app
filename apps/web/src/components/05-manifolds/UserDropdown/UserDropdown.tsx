import React, { useState, useRef, useEffect } from "react";
import { Settings, User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function UserDropdown({ user, onLogout }: any) {
  const [open, setOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openMenu() {
    setOpen(true);
    setFadeOut(false);
  }

  function close() {
    setFadeOut(true);
    setTimeout(() => {
      setOpen(false);
      setFadeOut(false);
    }, 150);
  }

  return (
    <div className="user-info" ref={ref}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt="Avatar" className="user-avatar" />
      ) : (
        <div className="user-initial">
          {(user.username?.[0] || user.email?.[0] || "?").toUpperCase()}
        </div>
      )}
      <span className="user-name">{user.username || user.email}</span>

      <button
        onClick={() => (open ? close() : openMenu())}
        className="nav-link"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        ▾
      </button>

      {open && (
        <div className={`dropdown-menu ${fadeOut ? "fade-out" : "fade-in"}`}>
          <button
            onClick={() => {
              navigate("/setup");
              close();
            }}
          >
            <Settings size={18} />
            Setup
          </button>
          <button
            onClick={() => {
              navigate("/profile");
              close();
            }}
          >
            <User size={18} />
            Profile
          </button>
          <button
            onClick={() => {
              onLogout();
              close();
            }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
