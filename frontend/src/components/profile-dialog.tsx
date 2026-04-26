import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { user, updateProfile, isAuthenticating } = useAuthStore();
  const [fullName, setFullName] = useState(user?.full_name ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">Update the display name tied to your account.</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Email</label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Full name</label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <Button
            className="w-full"
            disabled={isAuthenticating}
            onClick={async () => {
              await updateProfile(fullName);
              toast.success("Profile updated.");
              onOpenChange(false);
            }}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
