import React, { useState } from "react";
import Avatar from "../../elements/Avatar/Avatar";
import DropdownMenu from "../../elements/DropdownMenu/DropdownMenu";
import { Settings, User, LogOut } from "lucide-react";
import "../../_main/main.css";

interface UserDropdownProps {
  user: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
  onProfile?: () => void;
  onSetup?: () => void;
}

export default function UserDropdown({
  user,
  onLogout,
  onProfile,
  onSetup,
}: UserDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const items = [
    {
      label: "Setup",
      icon: <Settings size={18} />,
      onClick: onSetup,
    },
    {
      label: "Profile",
      icon: <User size={18} />,
      onClick: onProfile,
    },
    {
      label: "Sign Out",
      icon: <LogOut size={18} />,
      onClick: onLogout,
    },
  ];

  return (
    <div className="user-dropdown">
      <div
        className="user-dropdown-trigger"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <Avatar
          avatarUrl={user.avatarUrl}
          username={user.username}
          email={user.email}
          size={40}
        />
        <span className="user-name">{user.username || user.email}</span>
        <span className="caret">▾</span>
      </div>

      {menuOpen && (
        <div className="user-dropdown-menu">
          <DropdownMenu label="" items={items} />
        </div>
      )}
    </div>
  );
}
