import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const contentTypes = ["YouTube Videos", "Instagram/TikTok", "Blog Posts", "Email Marketing", "Social Media", "Podcasts"];

export function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [contentType, setContentType] = useState("");
  const { user, refreshProfile } = useAuth();

  const handleFinish = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name || undefined,
        content_preference: contentType || undefined,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Something went wrong. Try again.");
    } else {
      await refreshProfile();
      toast.success("Welcome to PromptOS! 🎉");
    }
  };

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md bg-card border-border" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {step === 1 && "What's your name?"}
            {step === 2 && "What do you mainly create?"}
            {step === 3 && "You're all set! 🚀"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Let's personalize your experience."}
            {step === 2 && "We'll tailor your starter prompts."}
            {step === 3 && "We've loaded 6 ContentCreator AI starter prompts for you."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
            />
            <Button className="w-full" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {contentTypes.map((ct) => (
                <Button
                  key={ct}
                  variant={contentType === ct ? "default" : "outline"}
                  size="sm"
                  onClick={() => setContentType(ct)}
                  className="text-sm"
                >
                  {ct}
                </Button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm text-muted-foreground">
              <p>✍️ Instagram caption writer</p>
              <p>🎬 YouTube script outliner</p>
              <p>🐦 Tweet variation generator</p>
              <p>📧 Email subject line creator</p>
              <p>📱 TikTok hook writer</p>
              <p>♻️ Content repurposer</p>
            </div>
            <Button className="w-full" onClick={handleFinish}>
              Let's go!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
