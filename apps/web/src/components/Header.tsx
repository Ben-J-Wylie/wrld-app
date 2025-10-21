import React, { useState, useRef, useEffect } from "react";
import { useAuthModal } from "../context/_AuthModalContext";
import { useBroadcast } from "../context/_BroadcastContext";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";

export default function Header({ user, onLogout }: any) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { openLogin, openSignup } = useAuthModal();
  const { settings, setSettings, startLocal, stopLocal } = useBroadcast();
  const navigate = useNavigate();

  // ✅ derived streaming state
  const isLive = settings.__live ?? false;

  // ✅ Go Live handler
  const handleGoLiveClick = async () => {
    try {
      if (!isLive) {
        console.log("🚀 Going live...");
        await startLocal();
        setSettings((prev) => ({ ...prev, __live: true }));
      } else {
        console.log("🛑 Stopping live stream...");
        await stopLocal();
        setSettings((prev) => ({ ...prev, __live: false }));
      }
    } catch (err) {
      console.error("❌ Error toggling live state:", err);
    }
  };

  // ✅ handle dropdown logic
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        handleCloseDropdown();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleCloseDropdown() {
    setFadeOut(true);
    setTimeout(() => {
      setDropdownOpen(false);
      setFadeOut(false);
    }, 150);
  }

  function handleOpenDropdown() {
    setDropdownOpen(true);
    setFadeOut(false);
  }

  return (
    <header className="header">
      <div className="logo" onClick={() => navigate("/")}>
        WRLD
      </div>

      <div className="nav-right">
        {/* 🎬 Go Live / Stop button */}
        <button
          onClick={handleGoLiveClick}
          className={`go-live-btn ${isLive ? "live" : ""}`}
        >
          {isLive ? "● LIVE" : "Go Live"}
        </button>

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
                    navigate("/broadcast");
                    handleCloseDropdown();
                  }}
                >
                  Broadcast
                </button>

                <button
                  onClick={() => {
                    navigate("/global-room");
                    handleCloseDropdown();
                  }}
                >
                  Global Room
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
            <button onClick={openLogin}>Login</button>
            <button onClick={openSignup}>Sign Up</button>
          </>
        )}
      </div>

      <style>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.25rem;
          background-color: #111827;
          color: white;
        }

        .logo {
          font-weight: 700;
          letter-spacing: 0.05em;
          font-size: 1.25rem;
          cursor: pointer;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .go-live-btn {
          background-color: #374151;
          color: #f9fafb;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          cursor: pointer;
          border: none;
        }

        .go-live-btn:hover:not(:disabled) {
          background-color: #4b5563;
        }

        .go-live-btn.live {
          background-color: #dc2626;
          color: white;
          animation: pulse 1.6s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
      `}</style>
    </header>
  );
}
