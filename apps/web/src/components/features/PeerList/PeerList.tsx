import React from "react";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";
import "../../_main/main.css";

interface Peer {
  id: string;
  displayName?: string;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
  platform?: string;
  settings?: {
    camera?: boolean;
    frontCamera?: boolean;
    backCamera?: boolean;
    mic?: boolean;
    isStreaming?: boolean;
  };
}

interface PeerListProps {
  peers: Peer[];
  selectedPeer: Peer | null;
  onSelectPeer: (peer: Peer) => void;
}

export default function PeerList({
  peers,
  selectedPeer,
  onSelectPeer,
}: PeerListProps) {
  if (!peers?.length) {
    return (
      <div className="peerlist empty">
        <p>No one is live right now</p>
      </div>
    );
  }

  const dedupedPeers = React.useMemo(() => {
    const map = new Map<string, Peer>();
    peers.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [peers]);

  return (
    <div className="peerlist">
      <h3 className="peerlist-title">Active Streams</h3>

      {dedupedPeers.map((peer, index) => {
        const key = peer.id || `peer-${index}`;
        const name =
          peer.displayName ||
          peer.name ||
          peer.username ||
          (peer.id ? `User-${peer.id.slice(0, 5)}` : "Anonymous");
        const initial = name.charAt(0).toUpperCase() || "?";
        const isSelected = selectedPeer?.id === peer.id;

        const settings = peer.settings || {};
        const isCameraOn =
          settings.camera || settings.frontCamera || settings.backCamera;
        const isMicOn = settings.mic;

        return (
          <div
            key={key}
            className={`peerlist-item ${isSelected ? "active" : ""}`}
            onClick={() => onSelectPeer(peer)}
          >
            {peer.avatarUrl ? (
              <img
                src={peer.avatarUrl}
                alt={name}
                className="peerlist-avatar-img"
              />
            ) : (
              <div className="peerlist-avatar">{initial}</div>
            )}

            <div className="peerlist-info">
              <span className="peerlist-name">{name}</span>
              <span className="peerlist-icons">
                {isCameraOn ? (
                  <Video size={14} color="#0ff" />
                ) : (
                  <VideoOff size={14} color="#444" />
                )}
                {isMicOn ? (
                  <Mic size={14} color="#0f0" />
                ) : (
                  <MicOff size={14} color="#444" />
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
