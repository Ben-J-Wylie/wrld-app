import { requireNativeComponent, Platform } from 'react-native'
import type { ViewProps } from 'react-native'

// iOS continuous-gimbal local camera preview. Renders an
// AVCaptureVideoPreviewLayer off the WebRTC capturer's existing
// AVCaptureSession (reused, never re-opened) and rotates it continuously so the
// scene stays vertical at any phone tilt — matching Android, which the
// RTCMTLVideoView discrete path can't do. iOS ONLY (see native
// WRLDCameraPreviewView; backed by the react-native-webrtc patch).
//
// JS owns the rotation sign/base calibration and passes the final `rotationDeg`;
// the native view rotates by it and cover-scales. Use for the LOCAL preview
// only (the remote/viewer path keeps RTCView).

export type CameraPreviewProps = ViewProps & {
  // React tag of the local MediaStream (same value RTCView's `streamURL` takes).
  streamURL: string
  // Continuous rotation (degrees) counter-rotating the physical roll.
  rotationDeg: number
  // Horizontal flip for the front camera (natural selfie).
  mirror?: boolean
}

const NativeCameraPreview =
  Platform.OS === 'ios' ? requireNativeComponent<CameraPreviewProps>('WRLDCameraPreview') : null

export const CameraPreview = (props: CameraPreviewProps) => {
  if (!NativeCameraPreview) return null
  return <NativeCameraPreview {...props} />
}
