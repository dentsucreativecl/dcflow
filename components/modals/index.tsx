"use client";

import { NewProjectModal } from "./new-project-modal";
import { NewTaskModalV2 } from "./new-task-modal-v2";
import { NewClientModal } from "./new-client-modal";
import { NewMemberModal } from "./new-member-modal";
import { NewEventModal } from "./new-event-modal";
import { LogTimeModal } from "./log-time-modal";
import { TaskDetailModalV2 } from "./task-detail-modal-v2";
import { ProjectDetailModal } from "./project-detail-modal";
import { ClientDetailModal } from "./client-detail-modal";
import { EventDetailModal } from "./event-detail-modal";
import { ConfirmDeleteModal } from "./confirm-delete-modal";
import { BulkImportModal } from "./bulk-import-modal";
import { BulkStatusChangeModal } from "./bulk-status-change-modal";
import { BulkAssignModal } from "./bulk-assign-modal";
import { useAppStore } from "@/lib/store";

export function ModalProvider() {
  const { activeModal } = useAppStore();
  return (
    <>
      <NewProjectModal />
      <NewTaskModalV2 />
      {activeModal === "new-client" && <NewClientModal />}
      <NewMemberModal />
      <NewEventModal />
      <LogTimeModal />
      <TaskDetailModalV2 />
      <ProjectDetailModal />
      <ClientDetailModal />
      <EventDetailModal />
      <ConfirmDeleteModal />
      <BulkImportModal />
      <BulkStatusChangeModal />
      <BulkAssignModal />
    </>
  );
}

// Export as Modals for convenience
export { ModalProvider as Modals };

export { NewProjectModal } from "./new-project-modal";
export { NewTaskModalV2 } from "./new-task-modal-v2";
export { NewClientModal } from "./new-client-modal";
export { NewMemberModal } from "./new-member-modal";
export { NewEventModal } from "./new-event-modal";
export { LogTimeModal } from "./log-time-modal";
export { TaskDetailModalV2 } from "./task-detail-modal-v2";
export { ProjectDetailModal } from "./project-detail-modal";
export { ClientDetailModal } from "./client-detail-modal";
export { EventDetailModal } from "./event-detail-modal";
