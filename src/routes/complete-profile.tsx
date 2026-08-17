import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Briefcase,
  Camera,
  Check,
  Loader2,
  MapPin,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/complete-profile")({
  head: () => ({
    meta: [
      { title: "Complete Your Profile — QuickWork" },
      {
        name: "description",
        content: "Tell us a bit about yourself to get started on QuickWork.",
      },
    ],
  }),
  component: CompleteProfilePage,
});

const workerSkills = [
  "Banquet server",
  "Kitchen helper",
  "Event steward",
  "Bartender",
  "Dishwashing",
  "Catering assistant",
  "Warehouse loader",
  "Delivery associate",
];

const employerTypes = [
  "Catering business",
  "Event management",
  "Restaurant",
  "Hotel",
  "Warehouse",
  "Retail store",
  "Other",
];

function CompleteProfilePage() {
  const { user, completeProfile, clearPendingAction } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [skill, setSkill] = useState("");
  const [experience, setExperience] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
    } else if (user.profileComplete) {
      navigate({ to: user.role === "employer" ? "/hire" : "/work" });
    }
  }, [user, navigate]);

  if (!user || user.profileComplete) return null;

  const isWorker = user.role === "worker";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !location) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (isWorker && (!skill || !experience)) {
      toast.error("Please select your skill and experience.");
      return;
    }
    if (!isWorker && !businessType) {
      toast.error("Please select your business type.");
      return;
    }

    setLoading(true);
    try {
      await completeProfile({ name });
      toast.success("Profile complete! Redirecting…");
      clearPendingAction();
      setTimeout(() => {
        navigate({ to: isWorker ? "/work" : "/hire" });
      }, 800);
    } catch {
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-14 lg:px-8">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[image:linear-gradient(135deg,var(--brand),var(--brand-deep))] shadow-brand">
          <Zap className="size-6 text-primary-foreground" />
        </span>
        <span className="font-display text-xl font-bold tracking-tight">QuickWork</span>
      </div>

      <div className="mt-10">
        <h1 className="font-display text-4xl font-bold sm:text-5xl">
          {isWorker ? "Set up your worker profile" : "Set up your business profile"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {isWorker
            ? "Tell us about your skills and experience so employers can find you."
            : "Tell us about your business so workers can see your listings."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="photo">
            {isWorker ? "Profile photo" : "Business logo"} (optional)
          </Label>
          <div className="flex items-center gap-4">
            <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="size-full object-cover" />
              ) : (
                <Camera className="size-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("photo")?.click()}
              >
                <Camera className="size-4" />
                Upload photo
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">
            {isWorker ? "Full name" : "Business name"} <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              placeholder={isWorker ? "e.g. Rahul Mehta" : "e.g. Saffron Caterers"}
              className="pl-9"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="location">
            Location <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="location"
              placeholder="e.g. Andheri East, Mumbai"
              className="pl-9"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
          </div>
        </div>

        {isWorker && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="skill">
                Skill category <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Wrench className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="skill"
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-background pl-9 pr-9 text-sm"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  required
                >
                  <option value="">Select a skill</option>
                  {workerSkills.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="experience">
                Experience <span className="text-destructive">*</span>
              </Label>
              <select
                id="experience"
                className="h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 text-sm"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                required
              >
                <option value="">Select experience level</option>
                <option value="0-1">Less than 1 year</option>
                <option value="1-3">1-3 years</option>
                <option value="3-5">3-5 years</option>
                <option value="5+">5+ years</option>
              </select>
            </div>
          </>
        )}

        {!isWorker && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="businessType">
                Business type <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="businessType"
                  className="h-11 w-full appearance-none rounded-xl border border-border bg-background pl-9 pr-9 text-sm"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  required
                >
                  <option value="">Select business type</option>
                  {employerTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">About your business (optional)</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Brief description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </>
        )}

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check />
              Complete profile
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
