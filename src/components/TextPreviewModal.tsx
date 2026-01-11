import type { Preview } from "../types";

type TextPreviewModalProps = {
  preview: Preview | null;
  open: boolean;
  onClose: () => void;
};

export function TextPreviewModal({ preview, open, onClose }: TextPreviewModalProps) {
  if (!open || !preview) {
    return null;
  }

  return (
    <div className="text-preview" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="text-preview-body" onClick={(event) => event.stopPropagation()}>
        <div className="text-preview-header">
          <span className="text-preview-title">{preview.name}</span>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <pre className="text-preview-content">{preview.content}</pre>
      </div>
    </div>
  );
}
