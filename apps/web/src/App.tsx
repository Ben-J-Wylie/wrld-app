import React, { useState } from "react";
import { Camera, Mic, MapPin, MessageSquare } from "lucide-react";
import SetupHeader from "./components/05-elements/SetupHeader/SetupHeader";
import ButtonGoLive from "./components/05-elements/ButtonGoLive/ButtonGoLive";
import ToggleGrid from "./components/05-elements/ToggleGrid/ToggleGrid";

export default function App() {
  const [isLive, setIsLive] = useState(false);
  const [active, setActive] = useState<{ [key: string]: boolean }>({
    Camera: false,
    Mic: false,
    Location: false,
    Chat: false,
  });

  const toggle = (key: string) =>
    setActive((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasAnyActive = Object.values(active).some(Boolean);

  const items = [
    {
      label: "Camera",
      icon: <Camera />,
      active: active.Camera,
      onClick: () => toggle("Camera"),
      preview: active.Camera && <div>Camera preview placeholder</div>,
    },
    {
      label: "Microphone",
      icon: <Mic />,
      active: active.Mic,
      onClick: () => toggle("Mic"),
      preview: active.Mic && <div>Mic visualization placeholder</div>,
    },
    {
      label: "Location",
      icon: <MapPin />,
      active: active.Location,
      onClick: () => toggle("Location"),
      preview: active.Location && <div>Map preview placeholder</div>,
    },
    {
      label: "Chat",
      icon: <MessageSquare />,
      active: active.Chat,
      onClick: () => toggle("Chat"),
      preview: active.Chat && <div>Chat preview placeholder</div>,
    },
  ];

  return (
    <div
      style={{
        background: "#0e0e0e",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <SetupHeader
        title="Setup Your Stream"
        subtitle="Choose what you’ll share before going live."
      >
        <ButtonGoLive
          isLive={isLive}
          onClick={() => setIsLive((prev) => !prev)}
          disabled={!hasAnyActive}
        />
      </SetupHeader>

      <ToggleGrid items={items} />
    </div>
  );
}
