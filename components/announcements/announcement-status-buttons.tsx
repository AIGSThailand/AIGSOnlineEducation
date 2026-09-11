"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAnnouncementStatusAction } from "@/features/announcements/actions";
import type { AnnouncementStatus } from "@/types/database.types";

export function AnnouncementStatusButtons({
  announcementId,
  status,
}: {
  announcementId: string;
  status: AnnouncementStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(next: AnnouncementStatus) {
    startTransition(async () => {
      await setAnnouncementStatusAction({ announcementId, status: next });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button size="sm" disabled={isPending} onClick={() => setStatus("published")}>
          Publish
        </Button>
      )}
      {status === "published" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setStatus("archived")}
        >
          Archive
        </Button>
      )}
      {status === "archived" && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setStatus("draft")}
        >
          To draft
        </Button>
      )}
    </div>
  );
}
