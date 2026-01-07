"use client";

import { useRouter } from "next/navigation";
import { useTransition, useMemo } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import {
  impersonateUserAction,
  stopImpersonatingAction,
} from "@/lib/actions/admin";

interface TargetUser {
  id: string;
  name: string;
  email: string;
  workspaceName?: string;
}

export function useImpersonation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { data: session } = useSession();

  // Check if we're currently impersonating someone
  // better-auth stores the admin's userId in session.impersonatedBy
  const isImpersonating = Boolean(
    session?.session && "impersonatedBy" in session.session && session.session.impersonatedBy
  );

  // Get target user info from the current session (the user being impersonated)
  const sessionUserId = session?.user?.id;
  const sessionUserName = session?.user?.name;
  const sessionUserEmail = session?.user?.email;

  const targetUser = useMemo<TargetUser | null>(() => {
    if (!isImpersonating || !sessionUserId || !sessionUserName || !sessionUserEmail) {
      return null;
    }
    return {
      id: sessionUserId,
      name: sessionUserName,
      email: sessionUserEmail,
      workspaceName: undefined, // We don't have workspace name in session
    };
  }, [isImpersonating, sessionUserId, sessionUserName, sessionUserEmail]);

  const impersonateUser = (userId: string) => {
    startTransition(async () => {
      const result = await impersonateUserAction(userId);

      if (result.success) {
        toast.success("Impersonation started");
        router.push(result.data.redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  // Alias for table actions that pass a user object
  const startImpersonation = (user: { id: string; name: string }) => {
    toast.info(`Impersonating ${user.name}…`);
    impersonateUser(user.id);
  };

  const endImpersonation = () => {
    startTransition(async () => {
      const result = await stopImpersonatingAction();

      if (result.success) {
        toast.success("Impersonation ended");
        router.push(result.data.redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return {
    impersonateUser,
    startImpersonation,
    endImpersonation,
    isImpersonating,
    targetUser,
    isPending,
  };
}
