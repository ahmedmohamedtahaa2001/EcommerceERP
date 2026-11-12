import type { ReactNode } from "react";
import { useT } from "../../lib/i18n";
import { Button } from "./Button";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}

/** Destructive-action confirmation: alert-toned primary button. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  loading = false,
}: ConfirmDialogProps) {
  const t = useT();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={loading}
            onClick={onConfirm}
            className="bg-alert hover:bg-alert"
          >
            {confirmLabel ?? t("action.confirm")}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
