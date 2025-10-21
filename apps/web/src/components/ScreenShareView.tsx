import React from "react";
export default function ScreenShareView({ peer }: any) {
  return (
    <div className="screen-share">
      🖥️ Viewing {peer.displayName}'s shared screen (stub)
    </div>
  );
}
