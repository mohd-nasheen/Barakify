import { loginAction } from "@/app/actions/auth";
import { PremiumAuthShell } from "@/components/PremiumAuthShell";

export default function LoginPage() {
  return <PremiumAuthShell mode="login" action={loginAction} />;
}
