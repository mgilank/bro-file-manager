type ImagePreviewModalProps = {
  path: string | null;
  name: string | null;
  imageBasePath: string;
  imageConfigId?: string | null;
  onClose: () => void;
  onError: () => void;
};

export function ImagePreviewModal({
  path,
  name,
  imageBasePath,
  imageConfigId,
  onClose,
  onError,
}: ImagePreviewModalProps) {
  if (!path) {
    return null;
  }

  return (
    <div className="image-preview" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="image-preview-body" onClick={(event) => event.stopPropagation()}>
        <div className="image-preview-header">
          <span className="image-preview-title">{name ?? "Image preview"}</span>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <img
          src={`${imageBasePath}?${new URLSearchParams({
            path,
            ...(imageConfigId ? { configId: imageConfigId } : {}),
          })}`}
          alt={name ?? "Image preview"}
          onError={onError}
        />
      </div>
    </div>
  );
}
