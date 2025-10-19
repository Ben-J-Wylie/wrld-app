import React from "react";
import "../../01-main/main.css";
import { useAuthModal } from "../../../context/AuthModalContext";
import Logo from "../../05-elements/Logo/Logo";
import UserDropdown from "../../06-manifolds/UserDropdown/UserDropdown";

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const { openLogin, openSignup } = useAuthModal();

  return (
    <header className="header">
      {/* Left side — logo */}
      <div className="header-left">
        <Logo
          text="WRLD"
          variant="accent"
          size={28}
          onClick={() => (window.location.href = "/")}
        />
      </div>

      {/* Right side — user or auth buttons */}
      <div className="header-right">
        {user ? (
          <UserDropdown
            user={user}
            onLogout={onLogout}
            onProfile={() => (window.location.href = "/profile")}
            onSetup={() => (window.location.href = "/setup")}
          />
        ) : (
          <div className="auth-buttons">
            <button className="auth-btn" onClick={openLogin}>
              Login
            </button>
            <button className="auth-btn signup" onClick={openSignup}>
              Sign Up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
