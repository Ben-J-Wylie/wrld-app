import React from "react";
export default function TorchIndicator({ peer }: any) {
  return (
    <div className="torch-indicator">🔦 {peer.displayName}'s torch is ON</div>
  );
}
