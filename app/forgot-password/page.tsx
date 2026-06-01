import { forgotPasswordAction } from "@/app/actions/auth";
import { PremiumAuthShell } from "@/components/PremiumAuthShell";

export default function ForgotPasswordPage() {
  return <PremiumAuthShell mode="forgot" action={forgotPasswordAction} />;
}
