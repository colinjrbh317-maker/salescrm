"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { WelcomeStep } from "./steps/welcome-step";
import { TeamStep } from "./steps/team-step";
import { LeadAssignmentStep } from "./steps/lead-assignment-step";
import { GoalSettingStep } from "./steps/goal-setting-step";
import { PracticeStep } from "./steps/practice-step";

const STEP_NAMES = ["Welcome", "Meet the Team", "Claim Leads", "Set Goals", "Practice"];

interface OnboardingWizardProps {
  profile: Profile | null;
  userId: string;
}

export function OnboardingWizard({ profile, userId }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  function handleNext() {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleComplete() {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);

    router.push("/");
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-white">
            Step {currentStep + 1} of {STEP_NAMES.length}: {STEP_NAMES[currentStep]}
          </span>
          <span className="text-sm text-slate-400">
            {Math.round(((currentStep + 1) / STEP_NAMES.length) * 100)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-700">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEP_NAMES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      {currentStep === 0 && (
        <WelcomeStep profile={profile} userId={userId} onNext={handleNext} />
      )}
      {currentStep === 1 && (
        <TeamStep onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === 2 && (
        <LeadAssignmentStep userId={userId} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === 3 && (
        <GoalSettingStep userId={userId} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === 4 && (
        <PracticeStep userId={userId} onComplete={handleComplete} />
      )}
    </div>
  );
}
