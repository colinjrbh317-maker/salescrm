"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ============================================================
// Undo action state
// ============================================================

interface UndoAction {
  cadenceId: string;
  type: "complete" | "skip" | "reschedule";
  previousState: {
    completed_at: string | null;
    skipped: boolean;
    scheduled_at: string;
  };
}

// ============================================================
// Hook: useCalendarActions
// Manages optimistic UI, undo, and Supabase mutations for
// calendar cadence operations (complete, skip, reschedule).
// ============================================================

export function useCalendarActions() {
  const router = useRouter();
  const supabase = createClient();
  const [pendingActions, setPendingActions] = useState<
    Map<string, "completing" | "skipping">
  >(new Map());
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----------------------------------------------------------
  // Complete a cadence step with optimistic UI
  // ----------------------------------------------------------
  const complete = useCallback(
    async (cadenceId: string, previousScheduledAt: string) => {
      setPendingActions((prev) =>
        new Map(prev).set(cadenceId, "completing")
      );

      const { error } = await supabase
        .from("cadences")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", cadenceId);

      if (error) {
        setPendingActions((prev) => {
          const m = new Map(prev);
          m.delete(cadenceId);
          return m;
        });
        return;
      }

      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoAction({
        cadenceId,
        type: "complete",
        previousState: {
          completed_at: null,
          skipped: false,
          scheduled_at: previousScheduledAt,
        },
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoAction(null);
        router.refresh();
      }, 3000);
    },
    [supabase, router]
  );

  // ----------------------------------------------------------
  // Skip a cadence step
  // ----------------------------------------------------------
  const skip = useCallback(
    async (cadenceId: string, previousScheduledAt: string) => {
      setPendingActions((prev) =>
        new Map(prev).set(cadenceId, "skipping")
      );

      const { error } = await supabase
        .from("cadences")
        .update({ skipped: true })
        .eq("id", cadenceId);

      if (error) {
        setPendingActions((prev) => {
          const m = new Map(prev);
          m.delete(cadenceId);
          return m;
        });
        return;
      }

      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoAction({
        cadenceId,
        type: "skip",
        previousState: {
          completed_at: null,
          skipped: false,
          scheduled_at: previousScheduledAt,
        },
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoAction(null);
        router.refresh();
      }, 3000);
    },
    [supabase, router]
  );

  // ----------------------------------------------------------
  // Reschedule a cadence step to a new date
  // ----------------------------------------------------------
  const reschedule = useCallback(
    async (
      cadenceId: string,
      newDate: string,
      previousScheduledAt: string
    ) => {
      const { error } = await supabase
        .from("cadences")
        .update({ scheduled_at: newDate })
        .eq("id", cadenceId);

      if (error) return;

      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoAction({
        cadenceId,
        type: "reschedule",
        previousState: {
          completed_at: null,
          skipped: false,
          scheduled_at: previousScheduledAt,
        },
      });
      undoTimerRef.current = setTimeout(() => {
        setUndoAction(null);
        router.refresh();
      }, 3000);
      router.refresh();
    },
    [supabase, router]
  );

  // ----------------------------------------------------------
  // Bulk reschedule all overdue cadences to today 9 AM
  // ----------------------------------------------------------
  const bulkRescheduleToday = useCallback(
    async (cadenceIds: string[]) => {
      const today = new Date();
      today.setHours(9, 0, 0, 0);

      await supabase
        .from("cadences")
        .update({ scheduled_at: today.toISOString() })
        .in("id", cadenceIds);

      router.refresh();
    },
    [supabase, router]
  );

  // ----------------------------------------------------------
  // Undo last action
  // ----------------------------------------------------------
  const undo = useCallback(async () => {
    if (!undoAction) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { cadenceId, previousState } = undoAction;

    await supabase
      .from("cadences")
      .update(previousState)
      .eq("id", cadenceId);

    setPendingActions((prev) => {
      const m = new Map(prev);
      m.delete(cadenceId);
      return m;
    });
    setUndoAction(null);
    router.refresh();
  }, [undoAction, supabase, router]);

  return {
    complete,
    skip,
    reschedule,
    bulkRescheduleToday,
    undo,
    pendingActions,
    undoAction,
  };
}
