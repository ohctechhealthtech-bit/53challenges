import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function VerifyEmail() {
  return (
    <AuthLayout
      icon={Mail}
      title="Verify your email"
      subtitle="Check your inbox for a verification link"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Back to log in
        </Link>
      }
    >
      <p className="text-sm text-foreground text-center">
        We sent a verification link to your email. Confirm your address to activate your
        account, then return here to log in.
      </p>
    </AuthLayout>
  );
}