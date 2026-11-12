import { useState, useEffect } from "react";
import { useT } from "../../lib/i18n";
import { Button, Modal } from "../../components/ui";

export interface ResolveDialogProps {
  open: boolean;
  onClose: () => void;
  onResolve: (resolution: string) => void;
  resolving: boolean;
}

export function ResolveDialog({
  open,
  onClose,
  onResolve,
  resolving,
}: ResolveDialogProps) {
  const t = useT();
  const [resolution, setResolution] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolution("");
      setSubmitted(false);
    }
  }, [open]);

  const canSubmit = resolution.trim() !== "" && !resolving;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("exceptions.resolve.title")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("action.cancel")}
          </Button>
          <Button
            loading={resolving}
            disabled={!canSubmit}
            onClick={() => {
              setSubmitted(true);
              if (resolution.trim() !== "") {
                onResolve(resolution.trim());
              }
            }}
          >
            {t("action.resolve")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label
          className="text-body2 font-semibold text-ink-800"
          htmlFor="resolution"
        >
          {t("exceptions.resolve.resolution")}
        </label>
        <textarea
          id="resolution"
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          placeholder={t("exceptions.resolve.placeholder")}
          rows={4}
          className="rounded-sm border border-ink-300 bg-surface px-3 py-2 text-body2 text-ink-900 placeholder:text-ink-500 focus:border-primary"
        />
        {submitted && resolution.trim() === "" ? (
          <p className="text-caption font-semibold text-alert">
            {t("exceptions.resolve.required")}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
