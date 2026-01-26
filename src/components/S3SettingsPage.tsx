import { useEffect, useState } from "react";
import {
  Cloud,
  Trash2,
  Edit2,
  Plus,
  CheckCircle,
  AlertCircle,
  Server,
  Globe,
  Database,
  ArrowLeft,
  Save,
  Loader2,
  X,
  HardDrive,
  Power
} from "lucide-react";
import {
  s3CreateConfig,
  s3DeleteConfig,
  s3ListConfigs,
  s3GetConfig,
  s3TestConnection,
  s3UpdateConfig,
} from "../services/api";
import type { S3Config, S3ConfigForm, ToastTone } from "../types";

interface S3SettingsPageProps {
  onBack: () => void;
  onToast: (message: string, tone?: ToastTone) => void;
  onConfigsChanged?: () => void;
}

interface PresetTemplate {
  name: string;
  region: string;
  endpoint: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const PRESETS: PresetTemplate[] = [
  {
    name: "AWS S3",
    region: "us-east-1",
    endpoint: "",
    label: "Amazon S3",
    icon: Cloud,
    description: "Standard AWS S3 storage",
  },
  {
    name: "Cloudflare R2",
    region: "auto",
    endpoint: "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
    label: "Cloudflare R2",
    icon: Globe,
    description: "Zero-egress object storage",
  },
  {
    name: "Backblaze B2",
    region: "us-west-004",
    endpoint: "https://s3.us-west-004.backblazeb2.com",
    label: "Backblaze B2",
    icon: Database,
    description: "Affordable cloud storage",
  },
  {
    name: "MinIO",
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    label: "MinIO",
    icon: Server,
    description: "Self-hosted object storage",
  },
];

const EMPTY_FORM: S3ConfigForm = {
  name: "",
  region: "us-east-1",
  endpoint: "",
  accessKeyId: "",
  secretAccessKey: "",
  bucket: "",
  prefix: "",
};

export function S3SettingsPage({ onBack, onToast, onConfigsChanged }: S3SettingsPageProps) {
  const [configs, setConfigs] = useState<S3Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState<S3ConfigForm>({ ...EMPTY_FORM });
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  useEffect(() => {
    void loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await s3ListConfigs();
      setConfigs(response.configs ?? []);
    } catch {
      onToast("Failed to load S3 configurations", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setSelectedPreset("");
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const handlePresetSelect = (preset: PresetTemplate) => {
    setForm((prev) => ({
      ...prev,
      region: preset.region,
      endpoint: preset.endpoint,
    }));
    setSelectedPreset(preset.label);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await s3UpdateConfig(editingId, form);
        onToast("S3 configuration updated", "success");
      } else {
        await s3CreateConfig(form);
        onToast("S3 configuration created", "success");
      }
      await loadConfigs();
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      onToast(err.message || "Failed to save configuration", "error");
    }
  };

  const handleEdit = async (config: S3Config) => {
    setEditingId(config.id);
    setShowForm(true);
    setForm({
      name: config.name,
      region: config.region,
      endpoint: config.endpoint || "",
      accessKeyId: "",
      secretAccessKey: "",
      bucket: config.bucket,
      prefix: "",
    });

    try {
      const detail = await s3GetConfig(config.id);
      const data = detail?.config ?? detail;
      setForm({
        name: data.name ?? config.name,
        region: data.region ?? config.region,
        endpoint: data.endpoint ?? config.endpoint ?? "",
        accessKeyId: data.accessKeyId ?? "",
        secretAccessKey: data.secretAccessKey ?? "",
        bucket: data.bucket ?? config.bucket,
        prefix: data.prefix ?? "",
      });
    } catch (err: any) {
      onToast(err?.message || "Failed to load configuration details", "error");
    }
  };

  const handleToggleActive = async (config: S3Config) => {
    try {
      const nextActive = config.active === false;
      await s3UpdateConfig(config.id, { active: nextActive });
      onToast(nextActive ? "Configuration activated" : "Configuration deactivated", "success");
      await loadConfigs();
      onConfigsChanged?.();
    } catch (err: any) {
      onToast(err.message || "Failed to update configuration", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this S3 configuration?")) {
      return;
    }

    try {
      await s3DeleteConfig(id);
      onToast("S3 configuration deleted", "success");
      await loadConfigs();
    } catch (err: any) {
      onToast(err.message || "Failed to delete configuration", "error");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await s3TestConnection(id);
      if (result?.error) {
        onToast(result.error, "error");
      }
      if (result?.success) {
        onToast("Connection successful!", "success");
      } else if (!result?.error) {
        onToast("Connection failed", "error");
      }
    } catch (err: any) {
      onToast(err.message || "Connection test failed", "error");
    } finally {
      setTestingId(null);
    }
  };

  const formIsValid =
    Boolean(form.name) &&
    Boolean(form.region) &&
    Boolean(form.accessKeyId) &&
    Boolean(form.secretAccessKey) &&
    Boolean(form.bucket);

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] p-4 animate-fadeUp">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="grid sm:flex items-center justify-between border-b border-[rgba(28,37,43,0.1)] pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <span className="cursor-pointer hover:text-[var(--ink)]" onClick={onBack}>
                Files
              </span>
              <span>/</span>
              <span className="font-medium text-[var(--ink)]">Settings</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--ink)] tracking-tight font-display">
              S3 Configuration
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-xl">
              Manage connection settings for AWS S3, Cloudflare R2, Backblaze B2, and other compatible services.
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--ink)] bg-[var(--card)] border border-[rgba(28,37,43,0.1)] rounded-full hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Files
          </button>
        </div>

        {/* Empty State / Initial View */}
        {!showForm && configs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--card)] border border-[rgba(28,37,43,0.08)] rounded-[var(--radius)] shadow-sm max-w-2xl mx-auto mt-12">
            <div className="p-4 bg-[rgba(28,37,43,0.04)] rounded-full mb-6">
              <Cloud className="w-10 h-10 text-[var(--muted)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--ink)] mb-2 font-display">No configurations yet</h2>
            <p className="text-[var(--muted)] mb-8 max-w-md">
              Connect your external storage buckets to manage files directly from the dashboard.
            </p>
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-full font-medium hover:translate-y-[-2px] hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              Add First Configuration
            </button>
          </div>
        )}

        {/* Main Content (when not empty or when creating) */}
        {(configs.length > 0 || showForm) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar / List */}
            {configs.length > 0 && (
              <div className={`space-y-6 ${showForm ? "lg:col-span-4" : "lg:col-span-12"}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--ink)]">Saved Configurations</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={loadConfigs}
                      disabled={loading}
                      className="p-2 text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-white rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Refresh list"
                    >
                      <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    {!showForm && (
                      <button
                        onClick={startCreate}
                        className="px-4 py-1.5 text-sm font-medium bg-[var(--accent)] text-white rounded-full hover:shadow-md transition-all"
                      >
                        New Config
                      </button>
                    )}
                  </div>
                </div>

                <div className={`grid gap-4 ${showForm ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className={`group relative p-5 bg-[var(--card)] border transition-all rounded-[var(--radius)] shadow-sm hover:shadow-md ${editingId === config.id
                        ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "border-[rgba(28,37,43,0.08)]"
                        }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[rgba(61,143,140,0.12)] rounded-xl">
                            <HardDrive className="w-5 h-5 text-[var(--accent-2)]" />
                          </div>
                          <div className="overflow-hidden">
                            <h3 className="font-bold text-[var(--ink)] truncate">{config.name}</h3>
                            <p className="text-xs text-[var(--muted)] truncate">{config.bucket}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {config.isDefault && (
                            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-2)] bg-[rgba(61,143,140,0.12)] rounded-full">
                              Default
                            </span>
                          )}
                          {config.active === false && (
                            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] bg-[rgba(28,37,43,0.08)] rounded-full">
                              Inactive
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(config.id)}
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)] mb-4">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 opacity-70" />
                          {config.region}
                        </div>
                        {config.endpoint && (
                          <div className="flex items-center gap-1.5 truncate max-w-full" title={config.endpoint}>
                            <Server className="w-3.5 h-3.5 opacity-70" />
                            <span className="truncate">
                              {(() => {
                                try {
                                  return new URL(config.endpoint).hostname;
                                } catch {
                                  return config.endpoint;
                                }
                              })()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-[rgba(28,37,43,0.06)]">
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <button
                            onClick={() => handleTest(config.id)}
                            disabled={testingId === config.id}
                            className={`flex-1 min-w-[86px] flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${testingId === config.id
                              ? "text-yellow-700 bg-yellow-100"
                              : "text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent)] hover:text-white"
                              }`}
                          >
                            {testingId === config.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Test
                          </button>
                          <button
                            onClick={() => handleEdit(config)}
                            className="flex-1 min-w-[86px] flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-[var(--accent-2)] bg-[var(--accent-2-soft)] hover:bg-[var(--accent-2)] hover:text-white rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(config)}
                            className={`flex-1 min-w-[98px] flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${config.active === false
                              ? "text-[var(--accent-2)] bg-[var(--accent-2-soft)] hover:bg-[var(--accent-2)] hover:text-white"
                              : "text-[var(--muted)] bg-[rgba(28,37,43,0.06)] hover:bg-[rgba(28,37,43,0.12)]"
                              }`}
                          >
                            <Power className="w-3 h-3" />
                            {config.active === false ? "Activate" : "Deactivate"}
                          </button>
                        </div>
                        
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Area */}
            {showForm && (
              <div className={`${configs.length > 0 ? "lg:col-span-8" : "lg:col-span-12"}`}>
                <div className="bg-[var(--card)] border border-[rgba(28,37,43,0.08)] rounded-[var(--radius)] shadow-lg overflow-hidden animate-fadeUp">
                  <div className="p-6 border-b border-[rgba(28,37,43,0.06)] flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--ink)] font-display">
                        {editingId ? "Edit Configuration" : "New Configuration"}
                      </h2>
                      <p className="text-sm text-[var(--muted)]">
                        Configure access credentials and bucket details.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        resetForm();
                        setShowForm(false);
                      }}
                      className="p-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[rgba(28,37,43,0.05)] rounded-full transition-colors"
                      style={{ backgroundColor: "transparent", borderColor: "transparent", boxShadow: "none" }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="p-6 md:p-8 space-y-8">
                    {/* Presets */}
                    {!editingId && (
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                          Quick Start Presets
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {PRESETS.map((preset) => {
                            const Icon = preset.icon;
                            const isActive = selectedPreset === preset.label;
                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => handlePresetSelect(preset)}
                                className={`flex flex-col items-center gap-3 p-4 text-center rounded-2xl border-2 transition-all ${isActive
                                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                                  : "border-[rgba(28,37,43,0.08)] hover:border-[rgba(28,37,43,0.15)] bg-transparent text-[var(--muted)]"
                                  }`}
                              >
                                <Icon className={`w-8 h-8 ${isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
                                <span className="text-sm font-bold text-[var(--ink)]">{preset.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--ink)]">
                            Configuration Name <span className="text-[var(--accent)]">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Production Assets"
                            className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[var(--ink)]">
                            Bucket Name <span className="text-[var(--accent)]">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.bucket}
                            onChange={(e) => setForm({ ...form, bucket: e.target.value })}
                            placeholder="e.g. my-app-uploads"
                            className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--ink)]">
                          Region <span className="text-[var(--accent)]">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.region}
                          onChange={(e) => setForm({ ...form, region: e.target.value })}
                          placeholder="e.g. us-east-1"
                          className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none font-mono text-sm"
                        />
                      </div>

                      <div className="p-6 bg-[rgba(28,37,43,0.03)] rounded-2xl space-y-6 border border-[rgba(28,37,43,0.06)]">
                        <div className="flex items-center gap-2 text-sm font-bold text-[var(--ink)] pb-3 border-b border-[rgba(28,37,43,0.06)]">
                          <AlertCircle className="w-4 h-4 text-[var(--muted)]" />
                          Security Credentials
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                              Access Key ID <span className="text-[var(--accent)]">*</span>
                            </label>
                            <input
                              type="text"
                              value={form.accessKeyId}
                              onChange={(e) => setForm({ ...form, accessKeyId: e.target.value })}
                              placeholder="AKIA..."
                              className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none font-mono text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                              Secret Access Key <span className="text-[var(--accent)]">*</span>
                            </label>
                            <input
                              type="password"
                              value={form.secretAccessKey}
                              onChange={(e) => setForm({ ...form, secretAccessKey: e.target.value })}
                              placeholder="••••••••"
                              className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none font-mono text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-2">
                        <label className="text-sm font-bold text-[var(--ink)]">
                          Advanced Options
                        </label>

                        <div className="grid grid-cols-1 gap-5">
                          <div className="space-y-2">
                            <label className="text-xs text-[var(--muted)]">
                              Custom Endpoint (Optional)
                            </label>
                            <input
                              type="text"
                              value={form.endpoint}
                              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                              placeholder="https://s3.custom-domain.com"
                              className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none font-mono text-sm"
                            />
                            <p className="text-[10px] text-[var(--muted)]">
                              Required for non-AWS providers like R2, MinIO, or B2.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-[var(--muted)]">
                              Path Prefix (Optional)
                            </label>
                            <input
                              type="text"
                              value={form.prefix}
                              onChange={(e) => setForm({ ...form, prefix: e.target.value })}
                              placeholder="uploads/"
                              className="w-full px-4 py-2.5 bg-white border border-[rgba(28,37,43,0.2)] rounded-xl focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] transition-all outline-none font-mono text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-[rgba(28,37,43,0.02)] border-t border-[rgba(28,37,43,0.06)] flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setShowForm(false);
                      }}
                      className="px-6 py-2.5 text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)] rounded-full hover:bg-[rgba(28,37,43,0.05)] transition-colors"
                      style={{ backgroundColor: "transparent" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={!formIsValid}
                      className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent)]/90 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {editingId ? "Save Changes" : "Create Configuration"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div >
  );
}
