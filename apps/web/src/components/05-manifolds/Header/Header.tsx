import React from "react";
import { useAuthModal } from "../context/AuthModalContext";
import UserDropdown from "./UserDropdown";

export default function Header({ user, onLogout }: any) {
  const { openLogin, openSignup } = useAuthModal();

  return (
    <header className="header">
      <div className="logo">WRLD</div>

      <div className="nav-right">
        {user ? (
          <UserDropdown user={user} onLogout={onLogout} />
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
