import { useState, useEffect } from "react";
import type { S3Config, S3ConnectionState } from "../types";
import { s3ListConfigs, s3Connect, s3Disconnect, s3ListConnections } from "../services/api";
import { Cloud, X, Plug, HardDrive, CheckCircle2, AlertCircle } from "lucide-react";

interface S3ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (configId?: string) => void;
  userRole: string;
  onOpenS3Settings?: () => void;
  initialConfigId?: string | null;
}

export function S3ConnectionModal({
  isOpen,
  onClose,
  onConnected,
  userRole,
  onOpenS3Settings,
  initialConfigId,
}: S3ConnectionModalProps) {
  const [configs, setConfigs] = useState<S3Config[]>([]);
  const [connection, setConnection] = useState<S3ConnectionState | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const connectedIds = new Set(connection?.configs?.map((config) => config.id) ?? []);
  const maxConnections = connection?.maxConnections ?? 5;
  const atLimit = connectedIds.size >= maxConnections;
  const isSelectedConnected = selectedId ? connectedIds.has(selectedId) : false;
  const activeConfig = selectedId
    ? connection?.configs?.find((config) => config.id === selectedId)
    : connection?.configs?.[0];

  useEffect(() => {
    if (isOpen) {
      if (initialConfigId) {
        setSelectedId(initialConfigId);
      }
      loadConfigs();
      loadConnection();
    }
  }, [isOpen, initialConfigId]);

  const loadConfigs = async () => {
    try {
      const response = await s3ListConfigs();
      if (response.configs) {
        setConfigs(response.configs.filter((config: S3Config) => config.active !== false));
      }
    } catch {
      setError("Failed to load S3 configurations");
    }
  };

  const loadConnection = async () => {
    try {
      const response = await s3ListConnections();
      setConnection(response);
      if (response?.connected && response.configs?.length > 0) {
        setSelectedId((prev) => prev || response.configs[0]?.id || "");
      }
    } catch {
      setConnection(null);
    }
  };

  const handleConnect = async () => {
    if (!selectedId) return;
    if (atLimit && !isSelectedConnected) {
      setError(`Maximum of ${maxConnections} S3 connections reached.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await s3Connect(selectedId);
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setConnection(result);
      onConnected(selectedId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to connect to S3");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await s3Disconnect(selectedId || undefined);
      if (response?.error) {
        setError(response.error);
        setLoading(false);
        return;
      }
      setConnection(response);
      onConnected();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(28,37,43,0.4)] backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-fadeUp">
      <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[rgba(28,37,43,0.1)] transform transition-all scale-100">
        <div className="flex justify-between items-center p-5 border-b border-[rgba(28,37,43,0.06)]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[rgba(78,139,183,0.15)] rounded-lg">
              <Cloud className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--ink)]">Connect Storage</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-2 hover:bg-[rgba(28,37,43,0.05)] rounded-full transition-colors"
            style={{ backgroundColor: "transparent", borderColor: "transparent", boxShadow: "none" }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-5 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="p-5 space-y-6">
          {connection?.connected ? (
            <div className="p-5 bg-[rgba(61,143,140,0.12)] border border-[rgba(61,143,140,0.2)] rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Cloud className="w-24 h-24 text-[var(--accent-2)]" />
              </div>
              <div className="relative z-10 flex items-start gap-4">
                <div className="p-2 bg-white rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-[var(--accent-2)]" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--ink)] text-lg">
                    Connected ({connectedIds.size})
                  </h3>
                  <p className="text-[var(--muted)] text-sm mt-1">
                    Active <strong>{activeConfig?.name || "S3 Storage"}</strong>
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--ink)] font-mono bg-white/50 rounded px-2 py-1 w-fit">
                    <HardDrive className="w-3 h-3" />
                    {activeConfig?.bucket ?? "Multiple buckets"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {configs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[rgba(28,37,43,0.05)] rounded-full flex items-center justify-center mx-auto mb-3">
                <Cloud className="w-8 h-8 text-[var(--muted)]" />
              </div>
              <p className="text-[var(--ink)] font-bold">No storage configurations</p>
              {userRole === "admin" && onOpenS3Settings ? (
                <button
                  onClick={() => {
                    onClose();
                    onOpenS3Settings();
                  }}
                  className="mt-3 px-4 py-2 bg-[var(--accent)] text-white rounded-full text-sm font-bold hover:bg-[var(--accent)]/90 transition-colors shadow-sm"
                >
                  Add Configuration
                </button>
              ) : (
                <p className="text-sm text-[var(--muted)] mt-1">
                  Ask an administrator to create one.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                Select Configuration
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {configs.map((config) => {
                  const isConnected = connectedIds.has(config.id);
                  return (
                    <label
                      key={config.id}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-all ${selectedId === config.id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                        : "border-[rgba(28,37,43,0.1)] hover:border-[var(--accent)] hover:bg-[rgba(28,37,43,0.02)]"
                        }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="radio"
                          name="s3-config"
                          value={config.id}
                          checked={selectedId === config.id}
                          onChange={(e) => setSelectedId(e.target.value)}
                          className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--ink)] text-sm">{config.name}</span>
                          <div className="flex items-center gap-2">
                            {isConnected ? (
                              <span className="text-[10px] bg-[rgba(61,143,140,0.15)] text-[var(--accent-2)] px-1.5 py-0.5 rounded font-bold uppercase">
                                Connected
                              </span>
                            ) : null}
                            {config.isDefault && (
                              <span className="text-[10px] bg-[rgba(28,37,43,0.05)] text-[var(--muted)] px-1.5 py-0.5 rounded font-bold uppercase">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                          <HardDrive className="w-3 h-3" />
                          <span>{config.bucket}</span>
                          <span className="opacity-50">•</span>
                          <span>{config.region}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {atLimit && !isSelectedConnected ? (
                <p className="text-xs text-[var(--muted)]">
                  Maximum of {maxConnections} S3 connections reached. Disconnect one to add another.
                </p>
              ) : null}
              <button
                onClick={handleConnect}
                disabled={!selectedId || loading || (atLimit && !isSelectedConnected)}
                className="w-full py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Plug className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                {loading ? "Connecting..." : connection?.connected ? (isSelectedConnected ? "Use Storage" : "Add Storage") : "Connect Storage"}
              </button>
              {connection?.connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 rounded-full font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {loading ? "Disconnecting..." : "Disconnect Storage"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
