import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CudaWhisperStatus,
  VulkanWhisperStatus,
  WhisperServerStatus,
} from "../../types/electron";
import { pickWhisperGpuBackend } from "../../utils/whisperGpuPack";
import { Button } from "../ui/button";

export default function HinaGpuSettings() {
  const [cuda, setCuda] = useState<CudaWhisperStatus | null>(null);
  const [vulkan, setVulkan] = useState<VulkanWhisperStatus | null>(null);
  const [server, setServer] = useState<WhisperServerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const operationRunning = useRef(false);
  const backend = pickWhisperGpuBackend(cuda, vulkan);
  const pack = backend === "cuda" ? cuda : backend === "vulkan" ? vulkan : null;
  const downloading = busy || !!pack?.downloading;

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    const [nextCuda, nextVulkan, nextServer] = await Promise.all([
      window.electronAPI?.getCudaWhisperStatus?.(),
      window.electronAPI?.getVulkanWhisperStatus?.(),
      window.electronAPI?.whisperServerStatus?.(),
    ]);
    if (id !== requestId.current) return;
    setCuda(nextCuda ?? null);
    setVulkan(nextVulkan ?? null);
    setServer(nextServer ?? null);
  }, []);

  useEffect(() => {
    const update = () => void refresh().catch((cause: unknown) => setError(String(cause)));
    update();
    const changed = window.electronAPI?.onWhisperGpuStatusChanged?.(update);
    const cudaFallback = window.electronAPI?.onCudaFallbackNotification?.(update);
    const vulkanFallback = window.electronAPI?.onGpuFallbackNotification?.(update);
    const timer = setInterval(update, 5000);
    const invalidatePendingReads = () => {
      requestId.current += 1;
    };
    return () => {
      invalidatePendingReads();
      clearInterval(timer);
      changed?.();
      cudaFallback?.();
      vulkanFallback?.();
    };
  }, [refresh]);

  useEffect(() => {
    const subscribe =
      backend === "cuda"
        ? window.electronAPI?.onCudaDownloadProgress
        : backend === "vulkan"
          ? window.electronAPI?.onVulkanWhisperDownloadProgress
          : undefined;
    return subscribe?.((data) => setProgress(data.percentage));
  }, [backend]);

  async function act(action: "install" | "remove" | "retry") {
    if (!backend || operationRunning.current) return;
    operationRunning.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setProgress(null);
    try {
      const api = window.electronAPI;
      const result =
        action === "retry"
          ? await api.whisperGpuRetry()
          : action === "remove"
            ? backend === "cuda"
              ? await api.deleteCudaWhisperBinary()
              : await api.deleteVulkanWhisperBinary()
            : backend === "cuda"
              ? await api.downloadCudaWhisperBinary()
              : await api.downloadVulkanWhisperBinary();
      if (!result.success)
        throw new Error("error" in result ? String(result.error) : "GPU operation failed");
      if (action !== "remove") {
        setNotice(
          "willRestart" in result && result.willRestart
            ? "Restarting the transcription engine with GPU acceleration."
            : "GPU acceleration will be used for the next dictation."
        );
      }
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      operationRunning.current = false;
      setBusy(false);
      setProgress(null);
    }
  }

  async function cancel() {
    try {
      const result =
        backend === "cuda"
          ? await window.electronAPI.cancelCudaWhisperDownload()
          : await window.electronAPI.cancelVulkanWhisperDownload();
      if (!result.success) throw new Error("Could not cancel GPU download");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const gpuName = backend === "vulkan" ? vulkan?.vulkan.deviceName : cuda?.gpuInfo.gpuName;
  const state = server?.gpuAccelerated
    ? `GPU acceleration active (${server.gpuBackend?.toUpperCase() ?? "GPU"})`
    : pack?.gpuFailed
      ? "GPU acceleration failed. Transcription is using the CPU."
      : pack?.needsUpdate
        ? "The GPU pack needs to be updated for this app version."
        : pack?.downloaded
          ? "GPU acceleration ready for the next dictation."
          : "Transcription is using the CPU.";

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">GPU acceleration</h3>
      <p role="status" className="text-xs text-muted-foreground">
        {state}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 break-words text-xs">
        <dt className="text-muted-foreground">Backend</dt>
        <dd>{backend?.toUpperCase() ?? "CPU"}</dd>
        <dt className="text-muted-foreground">GPU pack</dt>
        <dd>{pack?.downloaded ? "Installed" : "Not installed"}</dd>
        {gpuName && (
          <>
            <dt className="text-muted-foreground">Graphics card</dt>
            <dd>{gpuName}</dd>
          </>
        )}
        {cuda?.gpuInfo.driverVersion && (
          <>
            <dt className="text-muted-foreground">Driver</dt>
            <dd>{cuda.gpuInfo.driverVersion}</dd>
          </>
        )}
        {cuda?.gpuInfo.vramMb != null && (
          <>
            <dt className="text-muted-foreground">Video memory</dt>
            <dd>{Math.round(cuda.gpuInfo.vramMb)} MB</dd>
          </>
        )}
      </dl>
      {!backend && (
        <p className="text-xs text-muted-foreground">
          GPU packs are offered when a supported CUDA or Vulkan device is detected. CPU
          transcription remains available.
        </p>
      )}
      {pack?.gpuFailed && pack.gpuFailReason && (
        <p dir="ltr" className="break-words text-xs text-destructive">
          {pack.gpuFailReason}
        </p>
      )}
      {pack?.needsUpdate && (
        <p className="text-xs text-muted-foreground">Reinstall the pack to restore GPU support.</p>
      )}
      {downloading && (
        <p role="status" className="text-xs">
          {progress == null ? "Working…" : `Downloading: ${Math.round(progress)}%`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {backend && !downloading && (
          <Button variant="outline" size="sm" onClick={() => void act("install")}>
            {pack?.downloaded ? "Reinstall GPU pack" : "Install GPU pack"}
          </Button>
        )}
        {pack?.gpuFailed && !downloading && (
          <Button variant="outline" size="sm" onClick={() => void act("retry")}>
            Retry GPU
          </Button>
        )}
        {(pack?.downloaded || pack?.needsUpdate) && (
          <Button
            variant="outline"
            size="sm"
            disabled={downloading}
            onClick={() => void act("remove")}
          >
            Remove GPU pack
          </Button>
        )}
        {pack?.downloading && (
          <Button variant="outline" size="sm" onClick={() => void cancel()}>
            Cancel download
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={downloading}
          onClick={() => void refresh().catch((cause: unknown) => setError(String(cause)))}
        >
          Refresh status
        </Button>
      </div>
      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="break-words text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
