import { ThreeEvent } from "@react-three/fiber";
import { UIManager } from "../../../CoreScene/Controllers/UIManager";
import { ImagePlane } from "../../../CoreScene/Geometry/ImagePlane";
import { Group } from "../../../CoreScene/Layers/Group";
import { Button } from "../../../Elements/Button/Button";
import { CheckBox } from "../../../Elements/CheckBox/CheckBox";
import { InputField } from "../../../Elements/InputField/InputField";
import { TextLabel } from "../../../Elements/TextLabel/TextLabel";

type Vec3 = [number, number, number];

interface SignupFormProps {
  position?: Vec3;

  email: string;
  password: string;
  confirmPassword: string;
  robot: boolean;

  loading?: boolean;
  error?: string;
  success?: boolean;

  emailValid: boolean;
  passwordsMatch: boolean;
  passwordStrongEnough: boolean;
  canSubmit: boolean;

  showPassword: boolean;
  onToggleShowPassword: () => void;

  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onConfirmPasswordChange: (v: string) => void;
  onRobotChange: (v: boolean) => void;

  onSubmit: () => void;
  onLogin: () => void;
}

export function SignupForm({
  position = [0, 0, 0],

  email,
  password,
  confirmPassword,
  robot,

  loading = false,
  error,
  success = false,

  emailValid,
  passwordsMatch,
  passwordStrongEnough,
  canSubmit,

  showPassword,
  onToggleShowPassword,

  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onRobotChange,

  onSubmit,
  onLogin,
}: SignupFormProps) {
  const submitLabel = loading
    ? "Signing up..."
    : canSubmit
      ? "Sign Up"
      : "Complete all fields";

  return (
    <Group position={position} anchor={[0.5, 0.5, 0]}>
      {/* Background */}
      <ImagePlane
        width={550}
        height={700}
        cornerRadius={24}
        color="#d6d6d6"
        position={[0, -35, 0]}
        castShadow
        receiveShadow
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          UIManager.blurActiveField();
        }}
      />

      {/* Title */}
      <TextLabel
        text={success ? "🎉 Thank You!" : "Sign Up"}
        fontSize={{ desktop: 40, mobile: 50 }}
        fontWeight="bold"
        width={600}
        height={60}
        align="center"
        verticalAlign="middle"
        position={[0, 250, 20]}
      />

      {!success && (
        <>
          {/* Email */}
          <InputField
            id="signup-email"
            placeholder="Email address"
            value={email}
            onChange={onEmailChange}
            width={480}
            height={72}
            position={[0, 170, 20]}
            onSubmit={onSubmit}
          />

          {/* Email feedback */}
          {email.length > 0 && !emailValid && (
            <TextLabel
              text="✕ Please enter a valid email address"
              color="#d9534f"
              fontSize={22}
              width={480}
              height={40}
              align="center"
              verticalAlign="middle"
              position={[0, 110, 20]}
            />
          )}

          {/* Password */}
          <InputField
            id="signup-password"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={onPasswordChange}
            width={480}
            height={72}
            position={[0, 50, 20]}
            onSubmit={onSubmit}
          />

          {/* Eye toggle */}
          {password.length > 0 && (
            <Group position={[210, 50, 30]}>
              <Button
                label={showPassword ? "🙈" : "👁"}
                width={48}
                height={48}
                onClick={onToggleShowPassword}
              />
            </Group>
          )}

          {/* Confirm Password */}
          <InputField
            id="signup-confirm-password"
            type={showPassword ? "text" : "password"}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            width={480}
            height={72}
            position={[0, -30, 20]}
            onSubmit={onSubmit}
          />

          {/* Password feedback */}
          {confirmPassword.length > 0 && (
            <TextLabel
              text={
                !passwordsMatch
                  ? "✕ Passwords do not match"
                  : !passwordStrongEnough
                    ? "⚠ Password is too weak (use 8+ chars, number, symbol)"
                    : "✓ Passwords match"
              }
              color={
                !passwordsMatch
                  ? "#d9534f"
                  : !passwordStrongEnough
                    ? "#f0ad4e"
                    : "#28a745"
              }
              fontSize={22}
              width={480}
              height={40}
              align="center"
              verticalAlign="middle"
              position={[0, -100, 20]}
            />
          )}

          {/* Robot checkbox */}
          <Group position={[-120, -160, 20]}>
            <CheckBox
              label="I'm not a robot"
              checked={robot}
              onChange={onRobotChange}
            />
          </Group>

          {/* Error */}
          {error && (
            <TextLabel
              text={error}
              color="#d9534f"
              fontSize={26}
              width={520}
              height={60}
              align="center"
              verticalAlign="middle"
              position={[0, -160, 20]}
            />
          )}

          {/* Submit */}
          <Button
            label={submitLabel}
            width={480}
            height={70}
            position={[0, -240, 20]}
            onClick={canSubmit ? onSubmit : () => {}}
          />

          {/* Login CTA */}
          <Button
            label="Already have an account?"
            width={480}
            height={70}
            position={[0, -320, 20]}
            onClick={onLogin}
          />
        </>
      )}

      {success && (
        <TextLabel
          text="Check your email to verify your account."
          fontSize={26}
          width={520}
          height={80}
          align="center"
          verticalAlign="middle"
          position={[0, 50, 20]}
        />
      )}
    </Group>
  );
}
