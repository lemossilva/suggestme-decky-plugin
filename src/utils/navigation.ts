import { Navigation, showModal } from "@decky/ui";
import type { JSX } from "react";

/**
 * Opens a modal with automatic QAM focus restoration on close.
 * 
 * When a modal is opened via showModal, it renders outside the QAM context.
 * Upon dismissal, Steam returns focus to the game/main UI instead of the QAM.
 * This helper wraps showModal to automatically re-open the QAM after modal close.
 * 
 * @param modal - The modal JSX element to display
 * @param skipQAMReturn - If true, skip QAM restoration (e.g., when navigating elsewhere)
 */
export function openModalWithQAMReturn(
  modal: JSX.Element,
  skipQAMReturn: boolean = false
): void {
  showModal(modal, undefined, {
    fnOnClose: () => {
      if (!skipQAMReturn) {
        Navigation.OpenQuickAccessMenu();
      }
    }
  });
}
