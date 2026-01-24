import { useState, useEffect } from "react";
import type { S3Config, S3ConnectionState } from "../types";
import { s3ListConfigs, s3Connect, s3Disconnect, s3GetCurrentConnection } from "../services/api";

interface S3ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
  userRole: string;
}

export function S3ConnectionModal({ isOpen, onClose, onConnected, userRole }: S3ConnectionModalProps) {
  const [configs, setConfigs] = useState<S3Config[]>([]);
  const [connection, setConnection] = useState<S3ConnectionState | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      loadConnection();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    try {
      const response = await s3ListConfigs();
      if (response.configs) {
        setConfigs(response.configs);
      }
    } catch {
      setError("Failed to load S3 configurations");
    }
  };

  const loadConnection = async () => {
    try {
      const response = await s3GetCurrentConnection();
      setConnection(response);
    } catch {
      setConnection(null);
    }
  };

  const handleConnect = async () => {
    if (!selectedId) return;

    setLoading(true);
    setError("");

    try {
      await s3Connect(selectedId);
      onConnected();
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
      await s3Disconnect();
      setConnection({ connected: false });
      onConnected();
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">S3 Connection</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}

        {connection?.connected ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Connected to S3</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {connection.config?.name} ({connection.config?.bucket})
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium disabled:opacity-50"
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {configs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No S3 configurations found.</p>
                {userRole === "admin" && (
                  <p className="text-sm mt-2">Ask an administrator to create one.</p>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select an S3 configuration to connect:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {configs.map((config) => (
                    <label
                      key={config.id}
                      className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedId === config.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="s3-config"
                        value={config.id}
                        checked={selectedId === config.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{config.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {config.bucket} ({config.region})
                        </p>
                      </div>
                      {config.isDefault && (
                        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                          Default
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleConnect}
                  disabled={!selectedId || loading}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50"
                >
                  {loading ? "Connecting..." : "Connect"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
