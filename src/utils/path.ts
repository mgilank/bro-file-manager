export function joinPath(base: string, name: string) {
  if (base === "/") {
    return `/${name}`;
  }
  return `${base}/${name}`;
}

export function normalizeInputPath(value: string, base: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return base;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return joinPath(base, trimmed);
}

export function getFileExtension(name: string) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return name.slice(dotIndex).toLowerCase();
}
