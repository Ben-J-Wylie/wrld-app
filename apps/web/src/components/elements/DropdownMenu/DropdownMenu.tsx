import React, { useState, useRef, useEffect, ReactNode } from "react";
import "../../_main/main.css";

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}

interface DropdownMenuProps {
  label?: string; // text on the toggle button
  items: DropdownItem[];
}

export default function DropdownMenu({
  label = "Menu",
  items,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openMenu() {
    setOpen(true);
    setFadeOut(false);
  }

  function closeMenu() {
    setFadeOut(true);
    setTimeout(() => {
      setOpen(false);
      setFadeOut(false);
    }, 150);
  }

  return (
    <div className="dropdown-wrapper" ref={menuRef}>
      <button
        onClick={() => (open ? closeMenu() : openMenu())}
        className="dropdown-toggle"
      >
        {label} ▾
      </button>

      {open && (
        <div className={`dropdown-menu ${fadeOut ? "fade-out" : "fade-in"}`}>
          {items.map((item, index) => (
            <button
              key={index}
              className="dropdown-item"
              onClick={() => {
                item.onClick?.();
                closeMenu();
              }}
            >
              {item.icon && <span className="icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
