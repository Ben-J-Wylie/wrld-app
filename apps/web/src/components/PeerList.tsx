import React from "react";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";

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
  // ✅ Early empty state
  if (!peers?.length) {
    return (
      <div className="peerlist empty">
        <p>No one is live right now</p>
      </div>
    );
  }

  // ✅ Deduplicate peers by ID to prevent duplicate key warnings
  const dedupedPeers = React.useMemo(() => {
    const map = new Map<string, Peer>();
    peers.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [peers]);

  return (
    <div className="peerlist">
      <h3 className="peerlist-title">Active Streams</h3>

      {dedupedPeers.length === 0 ? (
        <div className="peerlist empty">No one is live right now</div>
      ) : (
        dedupedPeers.map((peer, index) => {
          // ✅ Use a stable key fallback if peer.id is missing
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
        })
      )}

      <style>{`
      .peerlist {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        color: #fff;
      }

      .peerlist-title {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.5rem;
        color: #aaa;
      }

      .peerlist-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .peerlist-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .peerlist-item.active {
        background: rgba(0, 255, 255, 0.15);
        border: 1px solid rgba(0, 255, 255, 0.5);
      }

      .peerlist-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #0ff;
      }

      .peerlist-avatar-img {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }

      .peerlist-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex: 1;
      }

      .peerlist-name {
        font-weight: 500;
        font-size: 0.95rem;
        color: #fff;
      }

      .peerlist-icons {
        display: flex;
        gap: 6px;
        align-items: center;
      }

      .peerlist.empty {
        text-align: center;
        color: #aaa;
        padding: 1rem;
      }
    `}</style>
    </div>
  );
}
