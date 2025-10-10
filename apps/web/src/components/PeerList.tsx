// apps/web/src/components/PeerList.tsx
import React from "react";

interface Peer {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
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
  return (
    <div className="peerlist">
      <h3 className="peerlist-title">Active Streams</h3>
      {peers.map((peer) => (
        <div
          key={peer.id}
          className={`peerlist-item ${
            selectedPeer?.id === peer.id ? "active" : ""
          }`}
          onClick={() => onSelectPeer(peer)}
        >
          {peer.avatarUrl ? (
            <img src={peer.avatarUrl} alt={peer.displayName} />
          ) : (
            <div className="peerlist-avatar">
              {peer.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="peerlist-name">{peer.displayName}</span>
        </div>
      ))}
    </div>
  );
}
