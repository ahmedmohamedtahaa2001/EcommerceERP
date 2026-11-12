import { useState, useEffect } from "react";
import { useSession } from "../../lib/auth/store";
import { useT } from "../../lib/i18n";
import { Button, Input, Modal } from "../../components/ui";

export interface AssignDialogProps {
  open: boolean;
  onClose: () => void;
  onAssign: (ownerId: string) => void;
  assigning: boolean;
}

export function AssignDialog({
  open,
  onClose,
  onAssign,
  assigning,
}: AssignDialogProps) {
  const t = useT();
  const { session } = useSession();
  const [ownerId, setOwnerId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setOwnerId("");
      setSubmitted(false);
    }
  }, [open]);

  const canSubmit = ownerId.trim() !== "" && !assigning;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("exceptions.assign.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={assigning}
            disabled={!canSubmit}
            onClick={() => {
              setSubmitted(true);
              if (ownerId.trim() !== "") {
                onAssign(ownerId.trim());
              }
            }}
          >
            {t("action.assign")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          label={t("exceptions.assign.ownerId")}
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          hint={t("exceptions.assign.hint")}
          error={
            submitted && ownerId.trim() === ""
              ? t("exceptions.assign.required")
              : null
          }
        />
        {session?.user.id ? (
          <Button
            variant="outlined"
            size="sm"
            className="self-start"
            onClick={() => setOwnerId(session.user.id)}
          >
            {t("exceptions.assign.toMe")}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
