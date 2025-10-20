import React, { useState } from "react";
import {
  Camera,
  Video,
  Mic,
  MapPin,
  ScreenShare,
  RotateCw,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

import { useIsMobile } from "../../../hooks/useIsMobile";
import "../../01-main/main.css";

// Core components
import SetupHeader from "../../elements/SetupHeader/SetupHeader";
import ButtonGoLive from "../../elements/ButtonGoLive/ButtonGoLive";
import ToggleGrid from "../../elements/ToggleGrid/ToggleGrid";
import FeatureCard from "../../elements/FeatureCard/FeatureCard";

// Previews
import PreviewCamera from "../../manifolds/PreviewCamera/PreviewCamera";
import PreviewMicFFT from "../../manifolds/PreviewMicFFT/PreviewMicFFT";
import PreviewLocation from "../../manifolds/PreviewLocation/PreviewLocation";
import PreviewChat from "../../manifolds/PreviewChat/PreviewChat";
import PreviewScreenShare from "../../manifolds/PreviewScreenShare/PreviewScreenShare";
import PreviewTorch from "../../manifolds/PreviewTorch/PreviewTorch";
import PreviewGyro from "../../manifolds/PreviewGyro/PreviewGyro";

type Toggles = {
  frontCamera: boolean;
  backCamera: boolean;
  mic: boolean;
  location: boolean;
  screenShare: boolean;
  gyro: boolean;
  torch: boolean;
  chat: boolean;
};

export default function SetupPage() {
  const [settings, setSettings] = useState<Toggles>({
    frontCamera: false,
    backCamera: false,
    mic: false,
    location: false,
    screenShare: false,
    gyro: false,
    torch: false,
    chat: false,
  });

  const [isLive, setIsLive] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const isMobile = useIsMobile();

  // Toggle logic with single-camera enforcement
  const toggle = (key: keyof Toggles) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      if (key === "frontCamera" && updated.frontCamera)
        updated.backCamera = false;
      if (key === "backCamera" && updated.backCamera)
        updated.frontCamera = false;
      return updated;
    });
  };

  const hasAnyEnabled = Object.values(settings).some(Boolean);
  const handleGoLive = () => {
    if (!hasAnyEnabled) return;
    setIsLive((prev) => !prev);
  };

  // Build grid items dynamically
  const items = [
    ...(isMobile
      ? [
          {
            label: "Front Camera",
            icon: <Camera />,
            active: settings.frontCamera,
            onClick: () => toggle("frontCamera"),
            preview: settings.frontCamera && <PreviewCamera facing="user" />,
          },
          {
            label: "Back Camera",
            icon: <Video />,
            active: settings.backCamera,
            onClick: () => toggle("backCamera"),
            preview: settings.backCamera && (
              <PreviewCamera facing="environment" />
            ),
          },
        ]
      : [
          {
            label: "Camera",
            icon: <Camera />,
            active: settings.frontCamera,
            onClick: () => toggle("frontCamera"),
            preview: settings.frontCamera && <PreviewCamera facing="user" />,
          },
        ]),
    {
      label: "Microphone",
      icon: <Mic />,
      active: settings.mic,
      onClick: () => toggle("mic"),
      preview: settings.mic && <PreviewMicFFT />,
    },
    {
      label: "Location",
      icon: <MapPin />,
      active: settings.location,
      onClick: () => toggle("location"),
      preview: settings.location && <PreviewLocation />,
    },
    {
      label: "Chat",
      icon: <MessageSquare />,
      active: settings.chat,
      onClick: () => toggle("chat"),
      preview: settings.chat && (
        <PreviewChat messages={messages} setMessages={setMessages} />
      ),
    },
    {
      label: "Screen Share",
      icon: <ScreenShare />,
      active: settings.screenShare,
      onClick: () => toggle("screenShare"),
      preview: settings.screenShare && <PreviewScreenShare />,
    },
    ...(isMobile
      ? [
          {
            label: "Gyroscope",
            icon: <RotateCw />,
            active: settings.gyro,
            onClick: () => toggle("gyro"),
            preview: settings.gyro && <PreviewGyro />,
          },
          {
            label: "Torch",
            icon: <Lightbulb />,
            active: settings.torch,
            onClick: () => toggle("torch"),
            preview: settings.torch && <PreviewTorch />,
          },
        ]
      : []),
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
      {/* Header */}
      <SetupHeader
        title="Setup Your Stream"
        subtitle="Choose what you’ll share before going live."
      >
        <ButtonGoLive
          isLive={isLive}
          disabled={!hasAnyEnabled}
          onClick={handleGoLive}
        />
      </SetupHeader>

      {/* Toggles */}
      <ToggleGrid
        items={items.map((item) => ({
          label: item.label,
          icon: item.icon,
          active: item.active,
          onClick: item.onClick,
          preview: item.preview,
        }))}
      />
    </div>
  );
}
